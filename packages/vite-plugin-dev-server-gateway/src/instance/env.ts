import { ensureTrailingSlash } from "../utils";
import type { Instance } from "./types";

/**
 * The single source of truth for the env var names the launch flow and the plugin agree on. Parsing
 * ({@link instanceFromEnv}) and serialization ({@link buildInstanceEnv}) both read from this map so
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
 * Reconstruct a {@link Instance} from the env our CLI (`vite-plugin-dev-server-gateway env
 * <shell>`) and `resolveInstance`-based launch scripts export. The common-case preset, so a config
 * rarely needs to spell the identity out by hand:
 *
 * ```ts
 * devServerGateway({ instance: instanceFromEnv() });
 * ```
 *
 * Returns `undefined` when the preview env is absent or malformed (so the plugin runs as the
 * gateway). Reads `VITE_DEV_SERVER_GATEWAY_NAME`, `VITE_DEV_SERVER_GATEWAY_BASE`, and
 * `VITE_DEV_SERVER_GATEWAY_PORT` as the essentials and `VITE_DEV_SERVER_GATEWAY_BRANCH` as
 * diagnostics. Want different env var names? Build the {@link Instance} by hand instead.
 */
export function instanceFromEnv(env: NodeJS.ProcessEnv = process.env): Instance | undefined {
  const name = env[ENV_KEYS.name];
  const base = env[ENV_KEYS.base];
  // Decimal-only: `Number` would otherwise accept exponential/hex/whitespace forms ("1e3" -> 1000,
  // "0x10" -> 16, " 53000 ") that a hand-written launch script could leak in. The env is a boundary,
  // so a malformed port must yield `undefined` (run as the gateway), not a surprising bind.
  const rawPort = env[ENV_KEYS.port];
  const port = rawPort !== undefined && /^\d+$/.test(rawPort) ? Number(rawPort) : Number.NaN;
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

export interface InstanceEnvInput {
  instance: Instance;
  /**
   * Exported as `VITE_DEV_SERVER_GATEWAY_ORIGIN` when set, so instances know where to register.
   */
  gatewayOrigin?: string;
}

/**
 * Build the ordered env var pairs the launch flow consumes — a lossless serialization of the
 * {@link Instance} that {@link instanceFromEnv} reads back. `VITE_DEV_SERVER_GATEWAY_NAME`,
 * `VITE_DEV_SERVER_GATEWAY_BASE`, and `VITE_DEV_SERVER_GATEWAY_PORT` are the essentials;
 * `VITE_DEV_SERVER_GATEWAY_BRANCH` (diagnostics) and `VITE_DEV_SERVER_GATEWAY_ORIGIN` are emitted
 * only when known.
 */
export function buildInstanceEnv(input: InstanceEnvInput): Array<[string, string]> {
  const { gatewayOrigin, instance } = input;

  const pairs: Array<[string, string]> = [
    [ENV_KEYS.name, instance.name],
    [ENV_KEYS.base, instance.base],
    [ENV_KEYS.port, String(instance.port)],
  ];
  if (instance.diagnostics?.branch !== undefined) {
    pairs.push([ENV_KEYS.branch, instance.diagnostics.branch]);
  }
  if (gatewayOrigin !== undefined) {
    pairs.push([ENV_KEYS.origin, gatewayOrigin]);
  }
  return pairs;
}
