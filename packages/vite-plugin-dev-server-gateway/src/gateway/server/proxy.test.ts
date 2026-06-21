import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer, request as httpRequest } from "node:http";
import type { Http2Server } from "node:http2";
import { connect as http2Connect, createServer as createHttp2Server } from "node:http2";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { Registry } from "../registry";
import type { RegistryEntry } from "../types";
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
    const registry = new Registry();
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

describe("send502", () => {
  it("does not append the 502 message to an already-committed response", async () => {
    const port = await listen(
      createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.write("streamed-body");
        // The downstream failed mid-stream: headers and part of the body are already on the wire,
        // so appending the 502 text would corrupt the response. send502 must abort instead.
        send502(res, "app");
      }),
    );

    const body = await new Promise<string>((resolve) => {
      const req = httpRequest(`http://127.0.0.1:${port}/`, (res) => {
        let received = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          received += chunk;
        });
        res.on("end", () => {
          resolve(received);
        });
        res.on("close", () => {
          resolve(received);
        });
      });
      req.on("error", () => {
        resolve("");
      });
      req.end();
    });

    expect(body).not.toContain("Preview 'app' is not running");
  });
});

// Vite serves the gateway over HTTP/2 whenever the dev server uses HTTPS. Exercised over cleartext
// (h2c) since the forbidden-header rejection is a protocol behaviour independent of TLS.
describe("proxyHttp over an HTTP/2 gateway", () => {
  it("forwards both ways, stripping headers HTTP/2 forbids", async () => {
    let receivedHeaders: IncomingHttpHeaders = {};
    const targetPort = await listen(
      createServer((req, res) => {
        receivedHeaders = req.headers;
        // The downstream HTTP/1.1 instance emits a connection-specific header; piping it verbatim
        // into the HTTP/2 client response would otherwise be rejected.
        res.writeHead(200, { connection: "keep-alive", "content-type": "text/plain" });
        res.end("hello from preview");
      }),
    );

    const gateway: Http2Server = createHttp2Server((req, res) => {
      // The http2 compat objects expose the HTTP/1 API surface proxyHttp uses; the static types
      // differ only in members it never touches, so the cast is safe.
      const proxyReq = req as unknown as IncomingMessage;
      const proxyRes = res as unknown as ServerResponse;
      proxyHttp(entry(targetPort), proxyReq, proxyRes, () => {
        send502(proxyRes, "app");
      });
    });
    const gatewayPort = await new Promise<number>((resolve) => {
      gateway.listen(0, "127.0.0.1", () => {
        const address = gateway.address();
        resolve(address !== null && typeof address !== "string" ? address.port : 0);
      });
    });

    const client = http2Connect(`http://127.0.0.1:${gatewayPort}`);
    try {
      const result = await new Promise<{
        body: string;
        connection: string | undefined;
        status: number;
      }>((resolve, reject) => {
        const req = client.request({ ":path": "/preview/app/" });
        let status = 0;
        let connection: string | undefined;
        let body = "";
        req.on("response", (headers) => {
          status = Number(headers[":status"] ?? 0);
          connection = headers["connection"] as string | undefined;
        });
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          body += chunk;
        });
        req.on("end", () => {
          resolve({ body, connection, status });
        });
        req.on("error", reject);
        req.end();
      });

      expect(result.status).toBe(200);
      expect(result.body).toBe("hello from preview");
      // The hop-by-hop `connection` header the downstream set must be stripped from the client
      // response, not just implicitly dropped by the HTTP/2 layer rejecting it.
      expect(result.connection).toBeUndefined();
      // The downstream HTTP/1.1 server must not receive HTTP/2 pseudo-headers (`:authority`, …).
      expect(Object.keys(receivedHeaders).some((key) => key.startsWith(":"))).toBe(false);
    } finally {
      client.close();
      await new Promise<void>((resolve) => {
        gateway.close(() => {
          resolve();
        });
      });
    }
  });
});
