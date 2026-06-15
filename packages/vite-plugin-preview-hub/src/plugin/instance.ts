import type { ViteDevServer } from "vite";

import { CONTROL_PREFIX } from "../constants";
import type { ResolvedHubOptions } from "./options";

const DEFAULT_HUB_ORIGIN = "http://localhost:5173";

/**
 * Wire the instance role: read the identity the launch script exported (D4), then self-register and
 * heartbeat to the hub, deregistering on shutdown.
 *
 * The heartbeat loop doubles as the retry loop — if the hub is not up yet, a failed beat is ignored
 * and the next one succeeds once the hub appears. No startup ordering requirement (D2).
 */
export function setupInstance(server: ViteDevServer, options: ResolvedHubOptions): void {
  const name = process.env["PREVIEW_NAME"];
  const base = process.env["PREVIEW_HUB_BASE"];
  const portValue = process.env["PREVIEW_HUB_PORT"];

  if (
    name === undefined ||
    name === "" ||
    base === undefined ||
    base === "" ||
    portValue === undefined
  ) {
    server.config.logger.warn(
      "[preview-hub] instance role, but PREVIEW_NAME / PREVIEW_HUB_BASE / PREVIEW_HUB_PORT are not all set; skipping registration",
    );
    return;
  }

  const port = Number(portValue);
  if (!Number.isInteger(port)) {
    server.config.logger.warn(`[preview-hub] invalid PREVIEW_HUB_PORT: ${portValue}`);
    return;
  }

  const branch = process.env["PREVIEW_HUB_BRANCH"];
  const hubOrigin = options.hubOrigin ?? DEFAULT_HUB_ORIGIN;
  const registerUrl = `${hubOrigin}${CONTROL_PREFIX}/register`;
  const registerBody = JSON.stringify({ base, branch, name, port });

  const sendHeartbeat = async (): Promise<void> => {
    try {
      await fetch(registerUrl, {
        body: registerBody,
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    } catch {
      // Hub not reachable yet; the next heartbeat retries.
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
