import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import type { Duplex } from "node:stream";

import type { RegistryEntry } from "../types";

// Target "localhost" rather than a hardcoded IPv4 address: Vite's default dev host is `localhost`,
// which resolves to ::1 on many machines. Node's autoSelectFamily (default on Node 20+) then tries
// both ::1 and 127.0.0.1, so dispatch reaches the instance regardless of which loopback it bound.
const LOOPBACK = "localhost";

// HTTP/2 forbids these connection-specific (hop-by-hop) headers (RFC 9113 §8.2.2); Node's http2
// compat layer throws ERR_HTTP2_INVALID_CONNECTION_HEADERS if they reach writeHead. Vite serves the
// gateway over HTTP/2 whenever the dev server uses HTTPS without `server.proxy`, so headers crossing
// the proxy must be cleaned even though the downstream instance speaks HTTP/1.1.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "te",
  "transfer-encoding",
  "upgrade",
]);

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
      headers: filterHeaders(req.headers, true),
      host: LOOPBACK,
      method: req.method,
      path: req.url,
      port: entry.port,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, filterHeaders(proxyRes.headers, false));
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", onError);
  req.pipe(proxyReq);
}

/**
 * Drop hop-by-hop headers before a request/response crosses the proxy. Set `dropPseudo` for
 * requests to also strip the HTTP/2 pseudo-headers (`:authority`, `:path`, …) the http2 compat
 * layer leaves in `req.headers`: those `:`-prefixed names are invalid HTTP/1.1 header tokens and
 * the downstream instance speaks HTTP/1.1. Responses keep `dropPseudo` off — there are no
 * pseudo-headers to remove on the way back, only hop-by-hop ones the (possibly HTTP/2) client
 * connection forbids.
 */
function filterHeaders(headers: IncomingHttpHeaders, dropPseudo: boolean): IncomingHttpHeaders {
  const forwarded: IncomingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (HOP_BY_HOP.has(key) || (dropPseudo && key.startsWith(":"))) {
      continue;
    }
    forwarded[key] = value;
  }
  return forwarded;
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

  // Tear both halves down together: a failure on either side leaves the other end's socket/fd open
  // otherwise. onError (target side) writes the 502 and destroys the client socket; a client-side
  // error just destroys the target — the client socket is already broken.
  target.on("error", onError);
  socket.on("error", () => {
    target.destroy();
    socket.destroy();
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
  if (res.headersSent) {
    // The downstream already streamed part of a response before it failed; appending the 502 text
    // would corrupt that body, so abort the connection instead of writing onto a committed response.
    res.destroy();
    return;
  }
  res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
  res.end(`Preview '${name}' is not running`);
}

/**
 * Tear down a WebSocket upgrade with a 502 written to the raw socket.
 */
export function destroyWsWith502(socket: Duplex): void {
  socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
  socket.destroy();
}
