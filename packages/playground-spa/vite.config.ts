import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { devServerGateway } from "vite-plugin-dev-server-gateway";

// Thread the resolved mount path into Vite's `base`, applying the same normalization at every
// consumption site (D4). Unset (the gateway) falls back to "/".
const base = process.env["PREVIEW_GATEWAY_BASE"]
  ? process.env["PREVIEW_GATEWAY_BASE"].replace(/\/?$/, "/")
  : "/";

const previewName = process.env["PREVIEW_NAME"] ?? "gateway";
const port = process.env["PREVIEW_GATEWAY_PORT"];

// Stamp the preview name into the served HTML so it is visible without running client JS — handy
// for confirming which instance a gateway request reached.
function injectPreviewName(name: string): Plugin {
  return {
    name: "playground:inject-preview-name",
    transformIndexHtml(html) {
      return html.replaceAll("%PREVIEW_NAME%", name);
    },
  };
}

export default defineConfig({
  base,
  plugins: [devServerGateway(), injectPreviewName(previewName)],
  server: {
    port: port !== undefined ? Number(port) : undefined,
    strictPort: port !== undefined,
  },
});
