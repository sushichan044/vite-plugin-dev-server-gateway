/// <reference types="@vitejs/devtools-kit" />
import type { Plugin } from "vite";

import { setupDevtools } from "../devtools/devtools";
import { PreviewRegistry } from "../registry/registry";
import { setupGateway } from "./gateway";
import { setupInstance } from "./instance";
import type { DevServerGatewayOptions } from "./options";
import { resolveOptions } from "./options";
import { resolveRole } from "./role";

/**
 * The dev-server-gateway Vite plugin. One plugin, two roles (D1): a `gateway` serves the registry,
 * index, and dispatch; an `instance` self-registers with the gateway. The role is resolved once in
 * `configResolved` and frozen.
 *
 * The DevTools tab (D7) is additive: dispatch and the HTML index work without it. The `devtools`
 * hook only registers the tab for the gateway role when `devtools` is enabled.
 */
export function devServerGateway(options: DevServerGatewayOptions = {}): Plugin {
  const resolved = resolveOptions(options);
  const registry = new PreviewRegistry();
  let role: "gateway" | "instance" = "gateway";

  return {
    configResolved(config) {
      role = resolveRole(resolved.role, process.env, config.root);
    },
    configureServer(server) {
      if (role === "gateway") {
        setupGateway(server, resolved, registry);
      } else {
        setupInstance(server, resolved);
      }
    },
    devtools: {
      setup(ctx) {
        if (role === "gateway" && resolved.devtools) {
          setupDevtools(ctx);
        }
      },
    },
    name: "vite-plugin-dev-server-gateway",
  };
}
