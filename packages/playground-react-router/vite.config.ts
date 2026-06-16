import { reactRouter } from "@react-router/dev/vite";
import { DevTools } from "@vitejs/devtools";
import { defineConfig } from "vite";
import { devServerGateway, instanceFromEnv } from "vite-plugin-dev-server-gateway";

// Integrate via instanceFromEnv() instead of reading raw env names: the preview's identity is the
// single API, and its `base` already carries one trailing slash — the SAME canonical value
// react-router.config.ts uses (D4).
const instance = instanceFromEnv();
const base = instance?.base ?? "/";

export default defineConfig({
  base,
  plugins: [reactRouter(), DevTools(), devServerGateway({ instance })],
  server: {
    port: instance?.port,
    strictPort: instance !== undefined,
  },
  build: {
    rolldownOptions: {
      devtools: {},
    },
  },
});
