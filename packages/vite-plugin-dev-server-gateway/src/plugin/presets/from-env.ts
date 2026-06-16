import type { ResolvedPreview } from "../../types";

/**
 * Reconstruct a {@link ResolvedPreview} from the env our CLI (`vite-plugin-dev-server-gateway env
 * <shell>`) and `resolvePreview`-based launch scripts export. The common-case preset, so a config
 * rarely needs to spell the identity out by hand:
 *
 * ```ts
 * devServerGateway({ instance: instanceFromEnv() });
 * ```
 *
 * Returns `undefined` when the preview env is absent or malformed (so the plugin runs as the
 * gateway). Reads `PREVIEW_NAME`, `PREVIEW_GATEWAY_BASE`, and `PREVIEW_GATEWAY_PORT` as the
 * essentials and `PREVIEW_GATEWAY_BRANCH` as diagnostics. Want different env var names? Build the
 * {@link ResolvedPreview} by hand instead.
 */
export function instanceFromEnv(env: NodeJS.ProcessEnv = process.env): ResolvedPreview | undefined {
  const name = env["PREVIEW_NAME"];
  const base = env["PREVIEW_GATEWAY_BASE"];
  const port = Number(env["PREVIEW_GATEWAY_PORT"]);
  if (!name || !base || !Number.isInteger(port) || port <= 0) {
    return undefined;
  }

  const branch = env["PREVIEW_GATEWAY_BRANCH"];
  return {
    base,
    name,
    port,
    ...(branch ? { diagnostics: { branch } } : {}),
  };
}
