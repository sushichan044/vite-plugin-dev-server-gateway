import type { IncomingMessage, Server } from "node:http";
import { createServer } from "node:http";

import type { ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupInstance } from "./instance";
import type { ResolvedHubOptions } from "./options";

interface ReceivedRequest {
  method: string;
  body: unknown;
}

let hub: Server;
let hubOrigin: string;
let received: ReceivedRequest[];
let httpServer: Server;
const envBackup = { ...process.env };

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

function options(overrides: Partial<ResolvedHubOptions> = {}): ResolvedHubOptions {
  return {
    devtools: true,
    heartbeatMs: 100_000,
    hubOrigin,
    mountPath: "/preview",
    portRange: [53_000, 53_999],
    role: "instance",
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
  hub = createServer((req, res) => {
    void (async () => {
      const body = await readBody(req);
      received.push({ body, method: req.method ?? "" });
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    })();
  });
  await new Promise<void>((resolve) => {
    hub.listen(0, "127.0.0.1", resolve);
  });
  const address = hub.address();
  const port = address !== null && typeof address !== "string" ? address.port : 0;
  hubOrigin = `http://127.0.0.1:${port}`;

  httpServer = createServer();

  process.env["PREVIEW_NAME"] = "app";
  process.env["PREVIEW_HUB_BASE"] = "/preview/app";
  process.env["PREVIEW_HUB_PORT"] = "53001";
  delete process.env["PREVIEW_HUB_BRANCH"];
});

afterEach(async () => {
  process.env = { ...envBackup };
  await new Promise<void>((resolve) => {
    hub.close(() => {
      resolve();
    });
  });
});

describe("setupInstance", () => {
  it("registers with the hub once the instance server is listening", async () => {
    setupInstance(fakeServer(), options());
    httpServer.emit("listening");

    await waitFor(() => received.length >= 1);

    const first = received[0];
    expect(first?.method).toBe("POST");
    expect(first?.body).toEqual({ base: "/preview/app", name: "app", port: 53_001 });
  });

  it("deregisters with the hub on shutdown", async () => {
    setupInstance(fakeServer(), options());
    httpServer.emit("listening");
    await waitFor(() => received.length >= 1);

    httpServer.emit("close");
    await waitFor(() => received.some((entry) => entry.method === "DELETE"));

    const deregister = received.find((entry) => entry.method === "DELETE");
    expect(deregister?.body).toEqual({ name: "app" });
  });

  it("skips registration when the required env vars are missing", async () => {
    delete process.env["PREVIEW_NAME"];

    setupInstance(fakeServer(), options());
    httpServer.emit("listening");
    await delay(100);

    expect(received).toHaveLength(0);
  });
});
