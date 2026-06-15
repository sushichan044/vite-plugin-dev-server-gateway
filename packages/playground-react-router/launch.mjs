// Demonstrates D3 for a framework app: resolve identity, export it, then spawn the dev command.
import { spawn } from "node:child_process";

import { resolvePreview } from "vite-plugin-preview-hub";

const resolved = await resolvePreview();

const env = {
  ...process.env,
  PREVIEW_HUB_BASE: resolved.base,
  PREVIEW_HUB_PORT: String(resolved.port),
  PREVIEW_NAME: resolved.name,
};

console.log(
  `[preview-hub] launching "${resolved.name}" on port ${resolved.port} at ${resolved.base}/`,
);

const child = spawn("pnpm", ["exec", "react-router", "dev"], { env, stdio: "inherit" });
child.on("exit", (code) => {
  process.exit(code ?? 0);
});
