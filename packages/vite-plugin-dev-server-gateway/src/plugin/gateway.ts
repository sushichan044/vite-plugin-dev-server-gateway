import type { ViteDevServer } from "vite";

import { isIndexPath, isPortInRange, matchPreviewName } from "../dispatch/match";
import type { PreviewRegistry } from "../registry/registry";
import { resolveKey } from "../resolve/key-strategy";
import { deriveName } from "../resolve/name";
import { handleControlRequest } from "../server/control";
import type { GatewayInfo } from "../server/gateway-info";
import { renderIndexHtml } from "../server/index-page";
import { destroyWsWith502, proxyHttp, proxyWs, send502 } from "../server/proxy";
import type { ResolvedGatewayOptions } from "./options";

/**
 * Wire the gateway role onto a Vite dev server: control endpoints, the HTML index, name-based
 * dispatch (HTTP + HMR upgrade), and the stale-eviction timer. The registry tracks the instances;
 * the gateway's own identity is held separately (it is not a registry entry — see
 * {@link GatewayInfo}).
 */
export function setupGateway(
  server: ViteDevServer,
  options: ResolvedGatewayOptions,
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

  // Resolved once the port is bound. The gateway is shown in the UI apart from the instances, sourced
  // from here rather than the registry, so an instance can never collide with or evict it.
  // `gatewayInfoReady` lets the index handler wait out the brief startup window before first render.
  let gatewayInfo: GatewayInfo | null = null;
  let markGatewayInfoReady = (): void => {};
  const gatewayInfoReady = new Promise<void>((resolve) => {
    markGatewayInfoReady = resolve;
  });
  if (server.httpServer) {
    server.httpServer.once("listening", () => {
      void buildGatewayInfo(server).then((info) => {
        gatewayInfo = info;
        markGatewayInfoReady();
      });
    });
  } else {
    markGatewayInfoReady();
  }
  const getGatewayInfo = (): GatewayInfo | null => gatewayInfo;

  // Added in the hook body so it runs before Vite's internal middlewares (SPA fallback etc.),
  // letting dispatch paths reach the proxy instead of being swallowed by Vite.
  server.middlewares.use((req, res, next) => {
    void (async () => {
      const url = req.url ?? "";

      if (
        await handleControlRequest(req, res, { getGatewayInfo, mountPath, portRange, registry })
      ) {
        return;
      }

      if (isIndexPath(url, mountPath)) {
        // Wait out the startup window so the first render already includes the gateway.
        await gatewayInfoReady;
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderIndexHtml(getGatewayInfo(), registry.list()));
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

/**
 * Build the gateway's own {@link GatewayInfo}. Its identity comes from the same `rootDir` derivation
 * an instance uses, its port from the bound socket, and its base is `/` (the gateway serves its own
 * app at the origin root). Falls back to the name `gateway` if the root dir does not yield a valid
 * slug, and to `null` when the port is not knowable.
 */
async function buildGatewayInfo(server: ViteDevServer): Promise<GatewayInfo | null> {
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === "string") {
    return null;
  }

  let name = "gateway";
  let branch: string | undefined;
  try {
    const key = await resolveKey("rootDir", server.config.root);
    name = deriveName(undefined, key.label);
    branch = key.branch;
  } catch {
    // Keep the "gateway" fallback when the root dir basename is not a valid slug.
  }

  return { base: "/", branch, name, port: address.port };
}
