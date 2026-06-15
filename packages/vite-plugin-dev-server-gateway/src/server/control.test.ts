import type { Server } from "node:http";
import { createServer } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { PreviewRegistry } from "../registry/registry";
import { handleControlRequest } from "./control";
import type { GatewayInfo } from "./gateway-info";

let server: Server;
let origin: string;
let registry: PreviewRegistry;
let gatewayInfo: GatewayInfo | null;

beforeEach(async () => {
  registry = new PreviewRegistry();
  gatewayInfo = null;
  server = createServer((req, res) => {
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
  origin = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

function register(body: unknown): Promise<Response> {
  return fetch(`${origin}/__dev-server-gateway/register`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("handleControlRequest", () => {
  it("registers a valid payload and returns 200", async () => {
    const res = await register({ base: "/preview/app", name: "app", port: 53_001 });

    expect(res.status).toBe(200);
    expect(registry.get("app")?.port).toBe(53_001);
  });

  it("rejects a port outside the range with 400 and does not register", async () => {
    const res = await register({ base: "/preview/app", name: "app", port: 52_000 });

    expect(res.status).toBe(400);
    expect(registry.get("app")).toBeUndefined();
  });

  it("rejects an invalid name with 400", async () => {
    const res = await register({ base: "/preview/app", name: "not a slug!", port: 53_001 });

    expect(res.status).toBe(400);
  });

  it("deregisters a name and is idempotent", async () => {
    await register({ base: "/preview/app", name: "app", port: 53_001 });

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

  it("exposes the mount path and a null gateway before the gateway registers", async () => {
    const res = await fetch(`${origin}/__dev-server-gateway/config`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ gateway: null, mountPath: "/preview" });
  });

  it("includes the gateway's own info in the config once known", async () => {
    gatewayInfo = { base: "/", name: "my-app", port: 5173 };
    const res = await fetch(`${origin}/__dev-server-gateway/config`);
    await expect(res.json()).resolves.toEqual({
      gateway: { base: "/", name: "my-app", port: 5173 },
      mountPath: "/preview",
    });
  });

  it("answers the health probe", async () => {
    const res = await fetch(`${origin}/__dev-server-gateway/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("lists registered previews as JSON", async () => {
    await register({ base: "/preview/app", name: "app", port: 53_001 });

    const res = await fetch(`${origin}/__dev-server-gateway/list`);
    const body = (await res.json()) as Array<{ name: string }>;

    expect(body.map((entry) => entry.name)).toEqual(["app"]);
  });

  it("ignores non-control paths", async () => {
    const res = await fetch(`${origin}/something-else`);
    expect(res.status).toBe(404);
  });
});
