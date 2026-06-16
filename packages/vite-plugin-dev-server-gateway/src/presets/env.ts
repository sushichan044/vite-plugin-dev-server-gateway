import type { ResolvedPreview } from "../types";
import { ensureTrailingSlash } from "../utils";

/**
 * The single source of truth for the env var names the launch flow and the plugin agree on. Parsing
 * ({@link instanceFromEnv}) and serialization ({@link buildPreviewEnv}) both read from this map so
 * the two can never drift to different names. Kept internal — consumers integrate via
 * {@link instanceFromEnv}, not by referencing raw names.
 */
const ENV_KEYS = {
  name: "VITE_DEV_SERVER_GATEWAY_NAME",
  base: "VITE_DEV_SERVER_GATEWAY_BASE",
  port: "VITE_DEV_SERVER_GATEWAY_PORT",
  branch: "VITE_DEV_SERVER_GATEWAY_BRANCH",
  origin: "VITE_DEV_SERVER_GATEWAY_ORIGIN",
} as const;

/**
 * Env var name the plugin reads to learn where instances register. Exposed for
 * {@link resolveOptions} to share the same literal as the launch flow.
 */
export const GATEWAY_ORIGIN_ENV = ENV_KEYS.origin;

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
 * gateway). Reads `VITE_DEV_SERVER_GATEWAY_NAME`, `VITE_DEV_SERVER_GATEWAY_BASE`, and
 * `VITE_DEV_SERVER_GATEWAY_PORT` as the essentials and `VITE_DEV_SERVER_GATEWAY_BRANCH` as
 * diagnostics. Want different env var names? Build the {@link ResolvedPreview} by hand instead.
 */
export function instanceFromEnv(env: NodeJS.ProcessEnv = process.env): ResolvedPreview | undefined {
  const name = env[ENV_KEYS.name];
  const base = env[ENV_KEYS.base];
  const port = Number(env[ENV_KEYS.port]);
  if (!name || !base || !Number.isInteger(port) || port <= 0) {
    return undefined;
  }

  const branch = env[ENV_KEYS.branch];
  return {
    // Normalize here too (env is a boundary a hand-written launch script can set): base always
    // carries exactly one trailing slash, so consumers use it verbatim.
    base: ensureTrailingSlash(base),
    name,
    port,
    ...(branch ? { diagnostics: { branch } } : {}),
  };
}

export interface ShellEnvInput {
  preview: ResolvedPreview;
  /**
   * Exported as `VITE_DEV_SERVER_GATEWAY_ORIGIN` when set, so instances know where to register.
   */
  gatewayOrigin?: string;
}

/**
 * Build the ordered env var pairs the launch flow consumes — a lossless serialization of the
 * {@link ResolvedPreview} that {@link instanceFromEnv} reads back. `VITE_DEV_SERVER_GATEWAY_NAME`,
 * `VITE_DEV_SERVER_GATEWAY_BASE`, and `VITE_DEV_SERVER_GATEWAY_PORT` are the essentials;
 * `VITE_DEV_SERVER_GATEWAY_BRANCH` (diagnostics) and `VITE_DEV_SERVER_GATEWAY_ORIGIN` are emitted
 * only when known.
 */
export function buildPreviewEnv(input: ShellEnvInput): Array<[string, string]> {
  const { gatewayOrigin, preview } = input;

  const pairs: Array<[string, string]> = [
    [ENV_KEYS.name, preview.name],
    [ENV_KEYS.base, preview.base],
    [ENV_KEYS.port, String(preview.port)],
  ];
  if (preview.diagnostics?.branch !== undefined) {
    pairs.push([ENV_KEYS.branch, preview.diagnostics.branch]);
  }
  if (gatewayOrigin !== undefined) {
    pairs.push([ENV_KEYS.origin, gatewayOrigin]);
  }
  return pairs;
}
