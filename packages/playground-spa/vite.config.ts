import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { devServerGateway, instanceFromEnv } from "vite-plugin-dev-server-gateway";

// The launch flow exports the resolved preview; the preset reads it back. Absent (the gateway)
// leaves the plugin in gateway mode. The plugin wires `base` / `server.port` from it.
const instance = instanceFromEnv();

// Stamp the preview name into the served HTML so it is visible without running client JS — handy
// for confirming which instance a gateway request reached.
function injectPreviewName(previewName: string): Plugin {
  return {
    name: "playground:inject-preview-name",
    transformIndexHtml(html) {
      return html.replaceAll("%PREVIEW_NAME%", previewName);
    },
  };
}

export default defineConfig({
  plugins: [devServerGateway({ instance }), injectPreviewName(instance?.name ?? "gateway")],
});
