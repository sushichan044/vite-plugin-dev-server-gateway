import type { ViteDevServer } from "vite";

import { CONTROL_PREFIX } from "../constants";
import type { ResolvedPreview } from "../types";
import type { ResolvedGatewayOptions } from "./options";

const DEFAULT_HUB_ORIGIN = "http://localhost:5173";

/**
 * Wire the instance role from the resolved `instance` identity (D4): self-register and heartbeat to
 * the gateway, deregistering on shutdown.
 *
 * The heartbeat loop doubles as the retry loop — if the gateway is not up yet, a failed beat is
 * ignored and the next one succeeds once the gateway appears. No startup ordering requirement
 * (D2).
 */
export function setupInstance(
  server: ViteDevServer,
  instance: ResolvedPreview,
  options: ResolvedGatewayOptions,
): void {
  const { base, name, port } = instance;
  const branch = instance.diagnostics?.branch;
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
