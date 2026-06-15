import type { ViteDevServer } from "vite";

import { CONTROL_PREFIX } from "../constants";
import type { ResolvedGatewayOptions } from "./options";

const DEFAULT_HUB_ORIGIN = "http://localhost:5173";

/**
 * Wire the instance role: read the identity the launch script exported (D4), then self-register and
 * heartbeat to the gateway, deregistering on shutdown.
 *
 * The heartbeat loop doubles as the retry loop — if the gateway is not up yet, a failed beat is
 * ignored and the next one succeeds once the gateway appears. No startup ordering requirement
 * (D2).
 */
export function setupInstance(server: ViteDevServer, options: ResolvedGatewayOptions): void {
  const name = process.env["PREVIEW_NAME"];
  const base = process.env["PREVIEW_GATEWAY_BASE"];
  const portValue = process.env["PREVIEW_GATEWAY_PORT"];

  if (
    name === undefined ||
    name === "" ||
    base === undefined ||
    base === "" ||
    portValue === undefined
  ) {
    server.config.logger.warn(
      "[dev-server-gateway] instance role, but PREVIEW_NAME / PREVIEW_GATEWAY_BASE / PREVIEW_GATEWAY_PORT are not all set; skipping registration",
    );
    return;
  }

  const port = Number(portValue);
  if (!Number.isInteger(port)) {
    server.config.logger.warn(`[dev-server-gateway] invalid PREVIEW_GATEWAY_PORT: ${portValue}`);
    return;
  }

  const branch = process.env["PREVIEW_GATEWAY_BRANCH"];
  const gatewayOrigin = options.gatewayOrigin ?? DEFAULT_HUB_ORIGIN;
  const registerUrl = `${gatewayOrigin}${CONTROL_PREFIX}/register`;
  const registerBody = JSON.stringify({ base, branch, name, port });

  const sendHeartbeat = async (): Promise<void> => {
    try {
      await fetch(registerUrl, {
        body: registerBody,
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    } catch {
      // Gateway not reachable yet; the next heartbeat retries.
    }
  };

  const deregister = async (): Promise<void> => {
    try {
      await fetch(registerUrl, {
        body: JSON.stringify({ name }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      });
    } catch {
      // Best effort on shutdown.
    }
  };

  let timer: NodeJS.Timeout | undefined;

  server.httpServer?.once("listening", () => {
    void sendHeartbeat();
    timer = setInterval(() => {
      void sendHeartbeat();
    }, options.heartbeatMs);
    timer.unref();
  });

  server.httpServer?.once("close", () => {
    if (timer !== undefined) {
      clearInterval(timer);
    }
    void deregister();
  });
}
