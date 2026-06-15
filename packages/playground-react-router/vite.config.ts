import { reactRouter } from "@react-router/dev/vite";
import { DevTools } from "@vitejs/devtools";
import { defineConfig } from "vite";
import { previewHub } from "vite-plugin-preview-hub";

// The SAME normalization one-liner as react-router.config.ts (D4): one canonical form everywhere.
const base = process.env["PREVIEW_HUB_BASE"]
  ? process.env["PREVIEW_HUB_BASE"].replace(/\/?$/, "/")
  : "/";

const port = process.env["PREVIEW_HUB_PORT"];

export default defineConfig({
  base,
  plugins: [reactRouter(), DevTools(), previewHub()],
  server: {
    port: port !== undefined ? Number(port) : undefined,
    strictPort: port !== undefined,
  },
  build: {
    rolldownOptions: {
      devtools: {},
    },
  },
});
