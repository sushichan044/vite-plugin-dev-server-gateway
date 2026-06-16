import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import type { Duplex } from "node:stream";

import type { RegistryEntry } from "../registry/types";

// Target "localhost" rather than a hardcoded IPv4 address: Vite's default dev host is `localhost`,
// which resolves to ::1 on many machines. Node's autoSelectFamily (default on Node 20+) then tries
// both ::1 and 127.0.0.1, so dispatch reaches the instance regardless of which loopback it bound.
const LOOPBACK = "localhost";

/**
 * Forward an HTTP request to the preview at `entry.port`, piping the response back.
 */
export function proxyHttp(
  entry: RegistryEntry,
  req: IncomingMessage,
  res: ServerResponse,
  onError: (error: Error) => void,
): void {
  const proxyReq = httpRequest(
    {
      headers: req.headers,
      host: LOOPBACK,
      method: req.method,
      path: req.url,
      port: entry.port,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", onError);
  req.pipe(proxyReq);
}

/**
 * Pipe an HMR WebSocket upgrade to the preview at `entry.port` over a raw socket.
 *
 * The upgrade request line and headers are already consumed from the client socket, so they are
 * re-sent to the target before piping both directions. A single name-based match covers HTTP and
 * HMR because the instance's `base` already prefixes its HMR path (D5).
 */
export function proxyWs(
  entry: RegistryEntry,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  onError: (error: Error) => void,
): void {
  const target = netConnect(entry.port, LOOPBACK);

  target.on("connect", () => {
    target.write(serializeRequestHead(req.method, req.url, req.headers));
    if (head.length > 0) {
      target.write(head);
    }
    socket.pipe(target);
    target.pipe(socket);
  });

  target.on("error", onError);
  socket.on("error", () => {
    target.destroy();
  });
}

function serializeRequestHead(
  method: string | undefined,
  url: string | undefined,
  headers: IncomingHttpHeaders,
): string {
  let block = `${method ?? "GET"} ${url ?? "/"} HTTP/1.1\r\n`;
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        block += `${key}: ${item}\r\n`;
      }
    } else if (value !== undefined) {
      block += `${key}: ${value}\r\n`;
    }
  }
  return `${block}\r\n`;
}

/**
 * Send a readable 502 telling the user which preview isn't running.
 */
export function send502(res: ServerResponse, name: string): void {
  if (!res.headersSent) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
  }
  res.end(`Preview '${name}' is not running`);
}

/**
 * Tear down a WebSocket upgrade with a 502 written to the raw socket.
 */
export function destroyWsWith502(socket: Duplex): void {
  socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
  socket.destroy();
}
