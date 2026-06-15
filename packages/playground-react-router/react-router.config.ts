import type { Config } from "@react-router/dev/config";

// D4: the framework's router basename is threaded from the SAME env var, with the SAME normalization
// one-liner used for Vite's `base`. This is the line that makes nested routes and generated links
// work when the app is mounted under `/preview/<name>/`.
const basename = process.env["PREVIEW_GATEWAY_BASE"]
  ? process.env["PREVIEW_GATEWAY_BASE"].replace(/\/?$/, "/")
  : "/";

export default {
  basename,
  ssr: true,
} satisfies Config;
