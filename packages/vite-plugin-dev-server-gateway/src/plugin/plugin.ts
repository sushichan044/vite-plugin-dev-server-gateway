/// <reference types="@vitejs/devtools-kit" />
import type { Plugin, UserConfig } from "vite";

import { setupDevtools } from "../devtools/devtools";
import { PreviewRegistry } from "../registry/registry";
import type { DevServerGatewayOptions } from "../types";
import { ensureTrailingSlash } from "../utils";
import { setupGateway } from "./gateway";
import { setupInstance } from "./instance";
import { resolveOptions } from "./options";

/**
 * The dev-server-gateway Vite plugin. One plugin, two roles (D1): a `gateway` serves the registry,
 * index, and dispatch; an `instance` self-registers with the gateway. The role is decided by the
 * `instance` option — provide it to be an instance, omit it to be the gateway.
 *
 * The DevTools tab (D7) is additive: dispatch and the HTML index work without it. The `devtools`
 * hook only registers the tab for the gateway role when `devtools` is enabled.
 */
export function devServerGateway(options: DevServerGatewayOptions = {}): Plugin {
  const resolved = resolveOptions(options);
  const registry = new PreviewRegistry();
  const { instance } = resolved;

  return {
    config(): UserConfig | undefined {
      // Wire the carried `base`/`port` into Vite so what we register always matches what Vite serves
      // — no hand-wiring in the user's config. `mergeConfig` lets this win over their config
      // (vite/runConfigHook), and only the instance role returns anything, so the gateway keeps its
      // own `/` base and default port.
      if (instance === undefined) {
        return undefined;
      }
      return {
        base: ensureTrailingSlash(instance.base),
        server: { port: instance.port, strictPort: true },
      };
    },
    configureServer(server) {
      if (instance === undefined) {
        setupGateway(server, resolved, registry);
      } else {
        setupInstance(server, instance, resolved);
      }
    },
    devtools: {
      setup(ctx) {
        if (instance === undefined && resolved.devtools) {
          setupDevtools(ctx);
        }
      },
    },
    name: "vite-plugin-dev-server-gateway",
  };
}
