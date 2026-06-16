// Demonstrates D3 for a framework app: resolve identity, export it, then spawn the dev command.
import { spawn } from "node:child_process";

import { resolvePreview } from "vite-plugin-dev-server-gateway";

const resolved = await resolvePreview();

const env = {
  ...process.env,
  VITE_DEV_SERVER_GATEWAY_BASE: resolved.base,
  VITE_DEV_SERVER_GATEWAY_PORT: String(resolved.port),
  VITE_DEV_SERVER_GATEWAY_NAME: resolved.name,
};

console.log(
  `[dev-server-gateway] launching "${resolved.name}" on port ${resolved.port} at ${resolved.base}/`,
);

const child = spawn("pnpm", ["exec", "react-router", "dev"], { env, stdio: "inherit" });
child.on("exit", (code) => {
  process.exit(code ?? 0);
});
