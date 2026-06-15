import type { Server } from "node:http";
import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { PreviewRegistry } from "../registry/registry";
import type { RegistryEntry } from "../registry/types";
import { proxyHttp, send502 } from "./proxy";

const openServers: Server[] = [];

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      openServers.push(server);
      const address = server.address();
      resolve(address !== null && typeof address !== "string" ? address.port : 0);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

async function getClosedPort(): Promise<number> {
  const probe = createServer();
  const port = await new Promise<number>((resolve) => {
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      resolve(address !== null && typeof address !== "string" ? address.port : 0);
    });
  });
  await new Promise<void>((resolve) => {
    probe.close(() => {
      resolve();
    });
  });
  return port;
}

function entry(port: number): RegistryEntry {
  return { base: "/preview/app", lastSeen: 0, name: "app", port, registeredAt: 0 };
}

afterEach(async () => {
  const servers = openServers.splice(0);
  await Promise.all(servers.map((server) => close(server)));
});

describe("proxyHttp", () => {
  it("forwards the request to the preview and pipes the response back", async () => {
    const targetPort = await listen(
      createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("hello from preview");
      }),
    );

    const hubPort = await listen(
      createServer((req, res) => {
        proxyHttp(entry(targetPort), req, res, () => {
          send502(res, "app");
        });
      }),
    );

    const res = await fetch(`http://127.0.0.1:${hubPort}/preview/app/`);
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("hello from preview");
  });

  it("evicts and returns a readable 502 when the preview is down", async () => {
    const registry = new PreviewRegistry();
    registry.upsert({ base: "/preview/app", name: "app", port: 53_001 });
    const deadPort = await getClosedPort();

    const hubPort = await listen(
      createServer((req, res) => {
        proxyHttp(entry(deadPort), req, res, () => {
          registry.remove("app");
          send502(res, "app");
        });
      }),
    );

    const res = await fetch(`http://127.0.0.1:${hubPort}/preview/app/`);
    expect(res.status).toBe(502);
    await expect(res.text()).resolves.toContain("Preview 'app' is not running");
    expect(registry.get("app")).toBeUndefined();
  });
});
