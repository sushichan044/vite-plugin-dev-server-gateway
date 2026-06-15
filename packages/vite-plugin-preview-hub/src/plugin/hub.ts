import type { ViteDevServer } from "vite";

import { isIndexPath, isPortInRange, matchPreviewName } from "../dispatch/match";
import type { PreviewRegistry } from "../registry/registry";
import { handleControlRequest } from "../server/control";
import { renderIndexHtml } from "../server/index-page";
import { destroyWsWith502, proxyHttp, proxyWs, send502 } from "../server/proxy";
import type { ResolvedHubOptions } from "./options";

/**
 * Wire the hub role onto a Vite dev server: control endpoints, the HTML index, name-based dispatch
 * (HTTP + HMR upgrade), and the stale-eviction timer. All read the one in-memory registry (D6).
 */
export function setupHub(
  server: ViteDevServer,
  options: ResolvedHubOptions,
  registry: PreviewRegistry,
): void {
  const { mountPath, portRange, staleMs } = options;

  const interval = setInterval(
    () => {
      registry.evictStale(staleMs);
    },
    Math.max(1000, Math.floor(staleMs / 3)),
  );
  interval.unref();
  server.httpServer?.once("close", () => {
    clearInterval(interval);
  });

  // Added in the hook body so it runs before Vite's internal middlewares (SPA fallback etc.),
  // letting dispatch paths reach the proxy instead of being swallowed by Vite.
  server.middlewares.use((req, res, next) => {
    void (async () => {
      const url = req.url ?? "";

      if (await handleControlRequest(req, res, { mountPath, portRange, registry })) {
        return;
      }

      if (isIndexPath(url, mountPath)) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderIndexHtml(registry.list()));
        return;
      }

      const name = matchPreviewName(url, mountPath);
      if (name === null) {
        next();
        return;
      }

      const entry = registry.get(name);
      if (entry === undefined || !isPortInRange(entry.port, portRange)) {
        send502(res, name);
        return;
      }

      proxyHttp(entry, req, res, () => {
        registry.remove(name);
        send502(res, name);
      });
    })();
  });

  server.httpServer?.on("upgrade", (req, socket, head) => {
    const name = matchPreviewName(req.url ?? "", mountPath);
    if (name === null) {
      // Not a preview upgrade: leave it for Vite's own HMR WebSocket listener.
      return;
    }

    const entry = registry.get(name);
    if (entry === undefined || !isPortInRange(entry.port, portRange)) {
      destroyWsWith502(socket);
      return;
    }

    proxyWs(entry, req, socket, head, () => {
      registry.remove(name);
      destroyWsWith502(socket);
    });
  });
}
