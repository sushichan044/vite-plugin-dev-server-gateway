import {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_MOUNT_PATH,
  DEFAULT_PORT_RANGE,
  DEFAULT_STALE_MS,
} from "../constants";
import { GATEWAY_ORIGIN_ENV } from "../presets/env";
import type { DevServerGatewayOptions, ResolvedPreview } from "../types";

/**
 * {@link DevServerGatewayOptions} with defaults applied (except `gatewayOrigin`, resolved later).
 */
export interface ResolvedGatewayOptions {
  instance: ResolvedPreview | undefined;
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
    gatewayOrigin: options.gatewayOrigin ?? process.env[GATEWAY_ORIGIN_ENV],
    heartbeatMs: options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS,
    instance: options.instance,
    mountPath: options.mountPath ?? DEFAULT_MOUNT_PATH,
    portRange: options.portRange ?? DEFAULT_PORT_RANGE,
    staleMs: options.staleMs ?? DEFAULT_STALE_MS,
  };
}
