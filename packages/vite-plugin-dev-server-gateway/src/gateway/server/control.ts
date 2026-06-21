import type { IncomingMessage, ServerResponse } from "node:http";

import { CONTROL_PREFIX, NAME_PATTERN } from "../../constants";
import { isCanonicalBase } from "../../utils";
import { isPortInRange, stripQuery } from "../dispatch";
import type { Registry } from "../registry";
import type { RegisterPayload, RegistryEntry } from "../types";
import type { GatewayInfo } from "../types";

export interface ControlDeps {
  registry: Registry;
  portRange: readonly [number, number];
  mountPath: string;
  /**
   * The gateway's own server info, tracked apart from the instance registry.
   */
  getGatewayInfo: () => GatewayInfo | null;
}

/**
 * Handle the gateway's control endpoints under {@link CONTROL_PREFIX} (D2):
 *
 * - `POST /register` — register or heartbeat (idempotent upsert)
 * - `DELETE /register` — graceful deregister
 * - `GET /health` — gateway liveness probe for instance startup
 * - `GET /list` — instance registry snapshot as JSON
 * - `GET /config` — mount path and the gateway's own info for the DevTools client
 *
 * Returns true when the request was a control request (handled), false otherwise.
 */
export async function handleControlRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ControlDeps,
): Promise<boolean> {
  const pathname = stripQuery(req.url ?? "");
  if (pathname !== CONTROL_PREFIX && !pathname.startsWith(`${CONTROL_PREFIX}/`)) {
    return false;
  }

  const sub = pathname.slice(CONTROL_PREFIX.length);
  const method = req.method ?? "GET";

  if (sub === "/health" && method === "GET") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (sub === "/list" && method === "GET") {
    sendJson(res, 200, deps.registry.list());
    return true;
  }

  if (sub === "/config" && method === "GET") {
    sendJson(res, 200, { gateway: deps.getGatewayInfo(), mountPath: deps.mountPath });
    return true;
  }

  if (sub === "/events" && method === "GET") {
    handleEvents(req, res, deps);
    return true;
  }

  if (sub === "/register" && method === "POST") {
    await handleRegister(req, res, deps);
    return true;
  }

  if (sub === "/register" && method === "DELETE") {
    await handleDeregister(req, res, deps);
    return true;
  }

  sendJson(res, 404, { error: "unknown control endpoint" });
  return true;
}

/**
 * Server-Sent Events stream of the registry. Pushes the current list on connect and on every
 * registry change, so the index page and DevTools tab refresh on updates alone (no polling).
 */
function handleEvents(req: IncomingMessage, res: ServerResponse, deps: ControlDeps): void {
  // `X-Accel-Buffering: no` opts the stream out of proxy response buffering (nginx and most reverse
  // proxies honour it). A common HTTPS dev setup puts a TLS-terminating reverse proxy in front of the
  // plain-HTTP dev server; without this header the proxy buffers the long-lived stream and never
  // forwards a frame, so the browser's EventSource hangs and cancels after a timeout. `/config` works
  // through the same proxy only because it is a short response that ends immediately.
  //
  // No `Connection: keep-alive` header: it is the HTTP/1.1 default anyway, and HTTP/2 (which Vite uses
  // when the dev server itself serves HTTPS) forbids connection-specific headers (RFC 9113 §8.2.2) —
  // Node's http2 compat layer drops it with a warning, so setting it is pointless noise.
  res.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": "text/event-stream",
    "x-accel-buffering": "no",
  });
  // Flush the head before the first frame so the proxy and the browser commit to the stream up front.
  res.flushHeaders();

  const send = (entries: RegistryEntry[]): void => {
    res.write(`data: ${JSON.stringify(entries)}\n\n`);
  };

  send(deps.registry.list());
  const unsubscribe = deps.registry.subscribe(send);
  req.on("close", unsubscribe);
}

async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ControlDeps,
): Promise<void> {
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  const parsed = parsePayload(body, deps.portRange);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  deps.registry.upsert(parsed.payload);
  sendJson(res, 200, { ok: true });
}

async function handleDeregister(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ControlDeps,
): Promise<void> {
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const name = record["name"];
  if (typeof name === "string") {
    deps.registry.remove(name);
  }
  // Idempotent: deregistering an unknown name is still a success.
  sendJson(res, 200, { ok: true });
}

type ParseResult = { ok: true; payload: RegisterPayload } | { ok: false; error: string };

function parsePayload(body: unknown, range: readonly [number, number]): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { error: "body must be an object", ok: false };
  }

  const record = body as Record<string, unknown>;
  const { base, branch, name, port } = record;

  if (typeof name !== "string" || !NAME_PATTERN.test(name)) {
    return { error: "invalid name", ok: false };
  }
  if (typeof port !== "number" || !Number.isInteger(port) || !isPortInRange(port, range)) {
    return { error: "port out of range", ok: false };
  }
  // `base` arrives from a network POST and is rendered into the index page's `href`s verbatim, so
  // this is the untrusted boundary: reject anything that is not a canonical path-only base before it
  // can become a clickable `javascript:`/`//host` link.
  if (typeof base !== "string" || !isCanonicalBase(base)) {
    return { error: "invalid base", ok: false };
  }
  if (branch !== undefined && typeof branch !== "string") {
    return { error: "invalid branch", ok: false };
  }

  return { ok: true, payload: { base, branch, name, port } };
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw === "") {
        resolve(undefined);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        resolve(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
