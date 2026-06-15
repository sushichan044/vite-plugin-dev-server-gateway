import {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_MOUNT_PATH,
  DEFAULT_PORT_RANGE,
  DEFAULT_STALE_MS,
} from "../constants";

/** Which role the plugin plays. `auto` is a heuristic; explicit values always win (D1). */
export type GatewayRole = "gateway" | "instance" | "auto";

/** Options for the {@link devServerGateway} plugin. All optional; defaults cover the common case. */
export interface DevServerGatewayOptions {
  /** @default "auto" */
  role?: GatewayRole;
  /** Must match the value used at resolve time. @default "/preview" */
  mountPath?: string;
  /** Bounds the dispatch security check (D5). @default [53000, 53999] */
  portRange?: [number, number];
  /** Where instances register. @default env PREVIEW_GATEWAY_ORIGIN, else the Vite server origin */
  gatewayOrigin?: string;
  /** Heartbeat interval (ms). @default 5000 */
  heartbeatMs?: number;
  /** Eviction window (ms): a couple of missed beats. @default 15000 */
  staleMs?: number;
  /** Register a Vite DevTools tab for the registry (D7). @default true */
  devtools?: boolean;
}

/** {@link DevServerGatewayOptions} with defaults applied (except `gatewayOrigin`, resolved later). */
export interface ResolvedGatewayOptions {
  role: GatewayRole;
  mountPath: string;
  portRange: [number, number];
  gatewayOrigin: string | undefined;
  heartbeatMs: number;
  staleMs: number;
  devtools: boolean;
}

export function resolveOptions(options: DevServerGatewayOptions): ResolvedGatewayOptions {
  return {
    devtools: options.devtools ?? true,
    heartbeatMs: options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS,
    gatewayOrigin: options.gatewayOrigin ?? process.env["PREVIEW_GATEWAY_ORIGIN"],
    mountPath: options.mountPath ?? DEFAULT_MOUNT_PATH,
    portRange: options.portRange ?? DEFAULT_PORT_RANGE,
    role: options.role ?? "auto",
    staleMs: options.staleMs ?? DEFAULT_STALE_MS,
  };
}
