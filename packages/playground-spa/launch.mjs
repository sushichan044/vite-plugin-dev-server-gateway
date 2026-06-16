// Demonstrates D3: the user owns the launch script. It resolves the preview identity, exports it to
// the environment so every config file Vite evaluates can see it, then spawns the dev command.
import { spawn } from "node:child_process";

import { resolvePreview } from "vite-plugin-dev-server-gateway";

const resolved = await resolvePreview();

const env = {
  ...process.env,
  PREVIEW_GATEWAY_BASE: resolved.base,
  PREVIEW_GATEWAY_PORT: String(resolved.port),
  PREVIEW_NAME: resolved.name,
  ...(resolved.diagnostics?.branch ? { PREVIEW_GATEWAY_BRANCH: resolved.diagnostics.branch } : {}),
};

console.log(
  `[dev-server-gateway] launching "${resolved.name}" on port ${resolved.port} at ${resolved.base}/`,
);

const child = spawn("pnpm", ["exec", "vite"], { env, stdio: "inherit" });
child.on("exit", (code) => {
  process.exit(code ?? 0);
});
