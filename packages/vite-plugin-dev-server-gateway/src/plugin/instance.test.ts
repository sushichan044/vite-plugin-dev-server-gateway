import type { IncomingMessage, Server } from "node:http";
import { createServer } from "node:http";

import type { ViteDevServer } from "vite";
import { describe, expect, test } from "vite-plus/test";

import type { ResolvedPreview } from "../types";
import { setupInstance } from "./instance";
import type { ResolvedGatewayOptions } from "./options";

interface ReceivedRequest {
  method: string;
  body: unknown;
}

interface InstanceContext {
  received: ReceivedRequest[];
  gatewayOrigin: string;
  httpServer: Server;
}

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

function options(
  gatewayOrigin: string,
  overrides: Partial<ResolvedGatewayOptions> = {},
): ResolvedGatewayOptions {
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

function fakeServer(httpServer: Server): ViteDevServer {
  const stub = {
    config: { logger: { warn: () => undefined } },
    httpServer,
  };
  return stub as unknown as ViteDevServer;
}

const it = test.extend<InstanceContext>({
  // eslint-disable-next-line no-empty-pattern -- vitest fixtures must destructure; no deps here
  received: async ({}, use) => {
    await use([]);
  },
  // Fake gateway that records every register/deregister it receives into the shared `received`
  // array, so a test can assert on what the instance sent. Depends on `received` to share it.
  gatewayOrigin: async ({ received }, use) => {
    const gateway = createServer((req, res) => {
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

    await use(`http://127.0.0.1:${port}`);

    await new Promise<void>((resolve) => {
      gateway.close(() => {
        resolve();
      });
    });
  },
  // The instance's own server: never bound, only used to drive the "listening" / "close" lifecycle
  // events setupInstance hooks onto.
  // eslint-disable-next-line no-empty-pattern -- vitest fixtures must destructure; no deps here
  httpServer: async ({}, use) => {
    const server = createServer();
    await use(server);
  },
});

describe("setupInstance", () => {
  it("registers with the gateway once the instance server is listening", async ({
    gatewayOrigin,
    httpServer,
    received,
  }) => {
    setupInstance(fakeServer(httpServer), APP_INSTANCE, options(gatewayOrigin));
    httpServer.emit("listening");

    await waitFor(() => received.length >= 1);

    const first = received[0];
    expect(first?.method).toBe("POST");
    expect(first?.body).toEqual({ base: "/preview/app", name: "app", port: 53_001 });
  });

  it("includes the diagnostics branch in the registration", async ({
    gatewayOrigin,
    httpServer,
    received,
  }) => {
    setupInstance(
      fakeServer(httpServer),
      { ...APP_INSTANCE, diagnostics: { branch: "feat/x" } },
      options(gatewayOrigin),
    );
    httpServer.emit("listening");

    await waitFor(() => received.length >= 1);

    expect(received[0]?.body).toEqual({
      base: "/preview/app",
      branch: "feat/x",
      name: "app",
      port: 53_001,
    });
  });

  it("deregisters with the gateway on shutdown", async ({
    gatewayOrigin,
    httpServer,
    received,
  }) => {
    setupInstance(fakeServer(httpServer), APP_INSTANCE, options(gatewayOrigin));
    httpServer.emit("listening");
    await waitFor(() => received.length >= 1);

    httpServer.emit("close");
    await waitFor(() => received.some((entry) => entry.method === "DELETE"));

    const deregister = received.find((entry) => entry.method === "DELETE");
    expect(deregister?.body).toEqual({ name: "app" });
  });
});
