import type { IncomingMessage, Server } from "node:http";
import { createServer } from "node:http";

import type { ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import type { ResolvedPreview } from "../types";
import { setupInstance } from "./instance";
import type { ResolvedGatewayOptions } from "./options";

interface ReceivedRequest {
  method: string;
  body: unknown;
}

let gateway: Server;
let gatewayOrigin: string;
let received: ReceivedRequest[];
let httpServer: Server;

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      resolve(raw === "" ? undefined : (JSON.parse(raw) as unknown));
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timed out");
    }
    // eslint-disable-next-line no-await-in-loop -- intentional polling loop
    await delay(10);
  }
}

const APP_INSTANCE: ResolvedPreview = {
  base: "/preview/app",
  name: "app",
  port: 53_001,
};

function options(overrides: Partial<ResolvedGatewayOptions> = {}): ResolvedGatewayOptions {
  return {
    devtools: true,
    heartbeatMs: 100_000,
    gatewayOrigin,
    instance: APP_INSTANCE,
    mountPath: "/preview",
    portRange: [53_000, 53_999],
    staleMs: 15_000,
    ...overrides,
  };
}

function fakeServer(): ViteDevServer {
  const stub = {
    config: { logger: { warn: () => undefined } },
    httpServer,
  };
  return stub as unknown as ViteDevServer;
}

beforeEach(async () => {
  received = [];
  gateway = createServer((req, res) => {
    void (async () => {
      const body = await readBody(req);
      received.push({ body, method: req.method ?? "" });
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    })();
  });
  await new Promise<void>((resolve) => {
    gateway.listen(0, "127.0.0.1", resolve);
  });
  const address = gateway.address();
  const port = address !== null && typeof address !== "string" ? address.port : 0;
  gatewayOrigin = `http://127.0.0.1:${port}`;

  httpServer = createServer();
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    gateway.close(() => {
      resolve();
    });
  });
});

describe("setupInstance", () => {
  it("registers with the gateway once the instance server is listening", async () => {
    setupInstance(fakeServer(), APP_INSTANCE, options());
    httpServer.emit("listening");

    await waitFor(() => received.length >= 1);

    const first = received[0];
    expect(first?.method).toBe("POST");
    expect(first?.body).toEqual({ base: "/preview/app", name: "app", port: 53_001 });
  });

  it("includes the diagnostics branch in the registration", async () => {
    setupInstance(fakeServer(), { ...APP_INSTANCE, diagnostics: { branch: "feat/x" } }, options());
    httpServer.emit("listening");

    await waitFor(() => received.length >= 1);

    expect(received[0]?.body).toEqual({
      base: "/preview/app",
      branch: "feat/x",
      name: "app",
      port: 53_001,
    });
  });

  it("deregisters with the gateway on shutdown", async () => {
    setupInstance(fakeServer(), APP_INSTANCE, options());
    httpServer.emit("listening");
    await waitFor(() => received.length >= 1);

    httpServer.emit("close");
    await waitFor(() => received.some((entry) => entry.method === "DELETE"));

    const deregister = received.find((entry) => entry.method === "DELETE");
    expect(deregister?.body).toEqual({ name: "app" });
  });
});
