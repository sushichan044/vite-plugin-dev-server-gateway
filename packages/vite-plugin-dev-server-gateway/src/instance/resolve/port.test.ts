import type { Server } from "node:net";
import { createServer } from "node:net";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { PortRangeExhaustedError } from "../../errors";
import { hashKey, probeFreePort, stablePort } from "./port";

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

describe("hashKey", () => {
  it("is deterministic for the same key", () => {
    expect(hashKey("a/b/c")).toBe(hashKey("a/b/c"));
  });

  it("differs for different keys", () => {
    expect(hashKey("one")).not.toBe(hashKey("two"));
  });
});

describe("stablePort", () => {
  it("returns a port within the inclusive range", () => {
    const port = stablePort("some/key", [53000, 53999]);
    expect(port).toBeGreaterThanOrEqual(53000);
    expect(port).toBeLessThanOrEqual(53999);
  });

  it("is stable across calls", () => {
    expect(stablePort("k", [53000, 53999])).toBe(stablePort("k", [53000, 53999]));
  });

  it("handles a single-port range", () => {
    expect(stablePort("k", [53123, 53123])).toBe(53123);
  });
});

describe("probeFreePort", () => {
  it("returns the preferred port when it is free", async () => {
    const port = await getFreePort();
    await expect(probeFreePort(port, [port, port + 20])).resolves.toBe(port);
  });

  it("skips an occupied preferred port and returns a free one in range", async () => {
    const port = await getFreePort();
    await occupy(port);

    const result = await probeFreePort(port, [port, port + 50]);
    expect(result).not.toBe(port);
    expect(result).toBeGreaterThan(port);
    expect(result).toBeLessThanOrEqual(port + 50);
  });

  it("throws when the whole range is exhausted", async () => {
    const port = await getFreePort();
    await occupy(port);

    await expect(probeFreePort(port, [port, port])).rejects.toThrow(PortRangeExhaustedError);
  });
});
