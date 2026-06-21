import {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_MOUNT_PATH,
  DEFAULT_PORT_RANGE,
  DEFAULT_STALE_MS,
} from "../constants";
import { GATEWAY_ORIGIN_ENV } from "../instance";
import type { Instance } from "../instance";

/**
 * Options for the `devServerGateway` plugin. All optional; defaults cover the common case.
 */
export interface DevServerGatewayPluginOptions {
  /**
   * The resolved instance this process serves. Provide it to run as an instance (the plugin wires
   * `base` / `server.port` and registers with the gateway); omit it to run the gateway. Build it
   * with `instanceFromEnv()`, hand it the result of {@link resolveInstance}, or construct it
   * directly.
   */
  instance?: Instance;
  /**
   * Must match the value used at resolve time.
   *
   * @default "/preview"
   */
  mountPath?: string;
  /**
   * Avaiable port range for instances.
   *
   * @default [53000, 53999]
   */
  portRange?: [number, number];
  /**
   * Where instances register.
   *
   * @default VITE_DEV_SERVER_GATEWAY_ORIGIN, else the Vite server origin
   */
  gatewayOrigin?: string;
  /**
   * Heartbeat interval (ms).
   *
   * @default 5000
   */
  heartbeatMs?: number;
  /**
   * Eviction window (ms): a couple of missed beats.
   *
   * @default 15000
   */
  staleMs?: number;
  /**
   * Enable integration with {@link https://devtools.vite.dev/ @vitejs/devtools}.
   *
   * `@vitejs/devtools` must be installed.
   *
   * @default true
   */
  devTools?: boolean;
}

/**
 * {@link DevServerGatewayPluginOptions} with defaults applied (except `gatewayOrigin`, resolved
 * later).
 */
export interface ResolvedDevServerGatewayPluginOptions {
  instance: Instance | undefined;
  mountPath: string;
  portRange: [number, number];
  gatewayOrigin: string | undefined;
  heartbeatMs: number;
  staleMs: number;
  devTools: boolean;
}

export function resolvePluginOptions(
  options: DevServerGatewayPluginOptions,
): ResolvedDevServerGatewayPluginOptions {
  return {
    devTools: options.devTools ?? true,
    gatewayOrigin: options.gatewayOrigin ?? process.env[GATEWAY_ORIGIN_ENV],
    heartbeatMs: options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS,
    instance: options.instance,
    mountPath: options.mountPath ?? DEFAULT_MOUNT_PATH,
    portRange: options.portRange ?? DEFAULT_PORT_RANGE,
    staleMs: options.staleMs ?? DEFAULT_STALE_MS,
  };
}
