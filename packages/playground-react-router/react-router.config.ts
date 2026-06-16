import type { Config } from "@react-router/dev/config";
import { instanceFromEnv } from "vite-plugin-dev-server-gateway";

// D4: the framework's router basename is the SAME preview `base` as Vite's, read via
// instanceFromEnv() rather than a raw env name. base already carries one trailing slash, so nested
// routes and generated links work when the app is mounted under `/preview/<name>/`.
const basename = instanceFromEnv()?.base ?? "/";

export default {
  basename,
  ssr: true,
} satisfies Config;
