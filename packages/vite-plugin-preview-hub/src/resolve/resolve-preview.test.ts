import type { Server } from "node:net";
import { createServer } from "node:net";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { PortRangeExhaustedError } from "../errors";
import { stablePort } from "./port";
import { resolvePreview } from "./resolve-preview";

const openServers: Server[] = [];

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address !== null && typeof address !== "string" ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function occupy(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      openServers.push(server);
      resolve();
    });
  });
}

afterEach(() => {
  while (openServers.length > 0) {
    openServers.pop()?.close();
  }
});

describe("resolvePreview", () => {
  it("derives name and slash-free base from the strategy label", async () => {
    const result = await resolvePreview({
      keyStrategy: () => ({ key: "k", label: "My App" }),
      portRange: [53000, 53999],
    });

    expect(result.name).toBe("my-app");
    expect(result.base).toBe("/preview/my-app");
    expect(result.port).toBeGreaterThanOrEqual(53000);
    expect(result.port).toBeLessThanOrEqual(53999);
    expect(result.branch).toBeUndefined();
  });

  it("lets an explicit name override the strategy label", async () => {
    const result = await resolvePreview({
      keyStrategy: () => "ignored",
      name: "chosen",
      portRange: [53000, 53999],
    });

    expect(result.name).toBe("chosen");
    expect(result.base).toBe("/preview/chosen");
  });

  it("honors a custom mountPath and keeps the base slash-free", async () => {
    const result = await resolvePreview({
      keyStrategy: () => "k",
      mountPath: "/apps/",
      name: "foo",
      portRange: [53000, 53999],
    });

    expect(result.base).toBe("/apps/foo");
  });

  it("surfaces the branch from the strategy", async () => {
    const result = await resolvePreview({
      keyStrategy: () => ({ branch: "main", key: "k", label: "app" }),
      portRange: [53000, 53999],
    });

    expect(result.branch).toBe("main");
  });

  it("propagates port exhaustion as PortRangeExhaustedError", async () => {
    const free = await getFreePort();
    const preferred = stablePort("k", [free, free]);
    await occupy(preferred);

    await expect(
      resolvePreview({ keyStrategy: () => "k", portRange: [free, free] }),
    ).rejects.toThrow(PortRangeExhaustedError);
  });
});
