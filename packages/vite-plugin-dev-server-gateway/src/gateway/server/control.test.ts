import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { Http2Server } from "node:http2";
import { connect as http2Connect, createServer as createHttp2Server } from "node:http2";

import { describe, expect, test } from "vite-plus/test";

import { Registry } from "../registry";
import type { GatewayInfo } from "../types";
import { handleControlRequest } from "./control";

interface ControlServer {
  origin: string;
  setGatewayInfo: (info: GatewayInfo | null) => void;
}

interface ControlContext {
  registry: Registry;
  server: ControlServer;
  origin: string;
  setGatewayInfo: (info: GatewayInfo | null) => void;
}

const it = test.extend<ControlContext>({
  // eslint-disable-next-line no-empty-pattern -- vitest fixtures must destructure; no deps here
  registry: async ({}, use) => {
    await use(new Registry());
  },
  // The live control server: the server closes over `gatewayInfo` so a test can flip it (via
  // setGatewayInfo) before hitting /config. Torn down after each test once `use` returns.
  server: async ({ registry }, use) => {
    let gatewayInfo: GatewayInfo | null = null;
    const server: Server = createServer((req, res) => {
      void (async () => {
        const handled = await handleControlRequest(req, res, {
          getGatewayInfo: () => gatewayInfo,
          mountPath: "/preview",
          portRange: [53_000, 53_999],
          registry,
        });
        if (!handled) {
          res.writeHead(404);
          res.end();
        }
      })();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    const port = address !== null && typeof address !== "string" ? address.port : 0;

    await use({
      origin: `http://127.0.0.1:${port}`,
      setGatewayInfo: (info) => {
        gatewayInfo = info;
      },
    });

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  },
  // Flattened off `server` so tests destructure `origin` / `setGatewayInfo` directly.
  origin: async ({ server }, use) => {
    await use(server.origin);
  },
  setGatewayInfo: async ({ server }, use) => {
    await use(server.setGatewayInfo);
  },
});

function register(origin: string, body: unknown): Promise<Response> {
  return fetch(`${origin}/__dev-server-gateway/register`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("handleControlRequest", () => {
  it("registers a valid payload and returns 200", async ({ origin, registry }) => {
    const res = await register(origin, { base: "/preview/app/", name: "app", port: 53_001 });

    expect(res.status).toBe(200);
    expect(registry.get("app")?.port).toBe(53_001);
  });

  it("rejects a port outside the range with 400 and does not register", async ({
    origin,
    registry,
  }) => {
    const res = await register(origin, { base: "/preview/app/", name: "app", port: 52_000 });

    expect(res.status).toBe(400);
    expect(registry.get("app")).toBeUndefined();
  });

  it("rejects an invalid name with 400", async ({ origin }) => {
    const res = await register(origin, {
      base: "/preview/app/",
      name: "not a slug!",
      port: 53_001,
    });

    expect(res.status).toBe(400);
  });

  it.for([
    ["a non-path scheme", "javascript:alert(1)"],
    ["a protocol-relative host", "//evil.example.com/"],
    ["a base without a trailing slash", "/preview/app"],
    ["a base with a query string", "/preview/app/?x=1"],
  ])(
    "rejects %s as base with 400 and does not register",
    async ([, base], { origin, registry }) => {
      const res = await register(origin, { base, name: "app", port: 53_001 });

      expect(res.status).toBe(400);
      expect(registry.get("app")).toBeUndefined();
    },
  );

  it("deregisters a name and is idempotent", async ({ origin, registry }) => {
    await register(origin, { base: "/preview/app/", name: "app", port: 53_001 });

    const res = await fetch(`${origin}/__dev-server-gateway/register`, {
      body: JSON.stringify({ name: "app" }),
      headers: { "content-type": "application/json" },
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(registry.get("app")).toBeUndefined();

    const again = await fetch(`${origin}/__dev-server-gateway/register`, {
      body: JSON.stringify({ name: "app" }),
      headers: { "content-type": "application/json" },
      method: "DELETE",
    });
    expect(again.status).toBe(200);
  });

  it("exposes the mount path and a null gateway before the gateway registers", async ({
    origin,
  }) => {
    const res = await fetch(`${origin}/__dev-server-gateway/config`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ gateway: null, mountPath: "/preview" });
  });

  it("includes the gateway's own info in the config once known", async ({
    origin,
    setGatewayInfo,
  }) => {
    setGatewayInfo({ base: "/", name: "my-app", port: 5173 });
    const res = await fetch(`${origin}/__dev-server-gateway/config`);
    await expect(res.json()).resolves.toEqual({
      gateway: { base: "/", name: "my-app", port: 5173 },
      mountPath: "/preview",
    });
  });

  it("answers the health probe", async ({ origin }) => {
    const res = await fetch(`${origin}/__dev-server-gateway/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("lists registered previews as JSON", async ({ origin }) => {
    await register(origin, { base: "/preview/app/", name: "app", port: 53_001 });

    const res = await fetch(`${origin}/__dev-server-gateway/list`);
    const body = (await res.json()) as Array<{ name: string }>;

    expect(body.map((entry) => entry.name)).toEqual(["app"]);
  });

  it("ignores non-control paths", async ({ origin }) => {
    const res = await fetch(`${origin}/something-else`);
    expect(res.status).toBe(404);
  });

  it("streams events with proxy buffering disabled so a reverse proxy forwards frames", async ({
    origin,
    registry,
  }) => {
    registry.upsert({ base: "/preview/app/", name: "app", port: 53_001 });

    const controller = new AbortController();
    const res = await fetch(`${origin}/__dev-server-gateway/events`, { signal: controller.signal });
    try {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");
      // The header that tells an intermediary reverse proxy not to buffer the long-lived stream.
      expect(res.headers.get("x-accel-buffering")).toBe("no");

      const reader = res.body!.getReader();
      const { value } = await reader.read();
      const frame = new TextDecoder().decode(value);
      expect(frame.startsWith("data: ")).toBe(true);
      const payload = JSON.parse(frame.slice("data: ".length).trim()) as Array<{ name: string }>;
      expect(payload.map((preview) => preview.name)).toEqual(["app"]);
    } finally {
      controller.abort();
    }
  });
});

// HTTP/2 is exercised over cleartext (h2c) — the forbidden-header rejection is a protocol-level
// behaviour of Node's http2 compat layer, identical with or without TLS, so no certificates are
// needed. This is the configuration Vite uses for the gateway whenever the dev server runs HTTPS.
describe("handleControlRequest over HTTP/2", () => {
  it("streams the events SSE without tripping the HTTP/2 forbidden-header rejection", async () => {
    const registry = new Registry();
    registry.upsert({ base: "/preview/app/", name: "app", port: 53_001 });

    const server: Http2Server = createHttp2Server((req, res) => {
      // The http2 compat objects expose the HTTP/1 API surface the handler uses; the static types
      // differ only in members we never touch, so the cast is safe.
      void handleControlRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        {
          getGatewayInfo: () => null,
          mountPath: "/preview",
          portRange: [53_000, 53_999],
          registry,
        },
      );
    });
    const port = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        resolve(address !== null && typeof address !== "string" ? address.port : 0);
      });
    });

    const client = http2Connect(`http://127.0.0.1:${port}`);
    try {
      const frame = await new Promise<{
        accelBuffering: string | undefined;
        connection: string | undefined;
        data: string;
        status: number;
      }>((resolve, reject) => {
        const req = client.request({ ":path": "/__dev-server-gateway/events" });
        let status = 0;
        let accelBuffering: string | undefined;
        let connection: string | undefined;
        let buffer = "";
        req.on("response", (headers) => {
          status = Number(headers[":status"] ?? 0);
          accelBuffering = headers["x-accel-buffering"] as string | undefined;
          connection = headers["connection"] as string | undefined;
        });
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          buffer += chunk;
          // The SSE stream stays open; resolve on the first complete frame, then close it.
          if (buffer.includes("\n\n")) {
            req.close();
            resolve({ accelBuffering, connection, data: buffer, status });
          }
        });
        req.on("error", reject);
        req.end();
      });

      expect(frame.status).toBe(200);
      expect(frame.accelBuffering).toBe("no");
      // HTTP/2 forbids connection-specific headers; the response must not carry one.
      expect(frame.connection).toBeUndefined();
      expect(frame.data.startsWith("data: ")).toBe(true);
      const payload = JSON.parse(frame.data.slice("data: ".length).trim()) as Array<{
        name: string;
      }>;
      expect(payload.map((preview) => preview.name)).toEqual(["app"]);
    } finally {
      client.close();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });
});
