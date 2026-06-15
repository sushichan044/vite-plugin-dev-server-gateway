/// <reference types="@vitejs/devtools-kit" />
import type { Plugin } from "vite";

import { setupDevtools } from "../devtools/devtools";
import { PreviewRegistry } from "../registry/registry";
import { setupHub } from "./hub";
import { setupInstance } from "./instance";
import type { PreviewHubOptions } from "./options";
import { resolveOptions } from "./options";
import { resolveRole } from "./role";

/**
 * The preview-hub Vite plugin. One plugin, two roles (D1): a `hub` serves the registry, index, and
 * dispatch; an `instance` self-registers with the hub. The role is resolved once in
 * `configResolved` and frozen.
 *
 * The DevTools tab (D7) is additive: dispatch and the HTML index work without it. The `devtools`
 * hook only registers the tab for the hub role when `devtools` is enabled.
 */
export function previewHub(options: PreviewHubOptions = {}): Plugin {
  const resolved = resolveOptions(options);
  const registry = new PreviewRegistry();
  let role: "hub" | "instance" = "hub";

  return {
    configResolved(config) {
      role = resolveRole(resolved.role, process.env, config.root);
    },
    configureServer(server) {
      if (role === "hub") {
        setupHub(server, resolved, registry);
      } else {
        setupInstance(server, resolved);
      }
    },
    devtools: {
      setup(ctx) {
        if (role === "hub" && resolved.devtools) {
          setupDevtools(ctx);
        }
      },
    },
    name: "vite-plugin-preview-hub",
  };
}
