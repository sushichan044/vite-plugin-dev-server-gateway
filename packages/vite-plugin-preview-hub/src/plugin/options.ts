import {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_MOUNT_PATH,
  DEFAULT_PORT_RANGE,
  DEFAULT_STALE_MS,
} from "../constants";

/** Which role the plugin plays. `auto` is a heuristic; explicit values always win (D1). */
export type PreviewRole = "hub" | "instance" | "auto";

/** Options for the {@link previewHub} plugin. All optional; defaults cover the common case. */
export interface PreviewHubOptions {
  /** @default "auto" */
  role?: PreviewRole;
  /** Must match the value used at resolve time. @default "/preview" */
  mountPath?: string;
  /** Bounds the dispatch security check (D5). @default [53000, 53999] */
  portRange?: [number, number];
  /** Where instances register. @default env PREVIEW_HUB_ORIGIN, else the Vite server origin */
  hubOrigin?: string;
  /** Heartbeat interval (ms). @default 5000 */
  heartbeatMs?: number;
  /** Eviction window (ms): a couple of missed beats. @default 15000 */
  staleMs?: number;
  /** Register a Vite DevTools tab for the registry (D7). @default true */
  devtools?: boolean;
}

/** {@link PreviewHubOptions} with defaults applied (except `hubOrigin`, resolved later). */
export interface ResolvedHubOptions {
  role: PreviewRole;
  mountPath: string;
  portRange: [number, number];
  hubOrigin: string | undefined;
  heartbeatMs: number;
  staleMs: number;
  devtools: boolean;
}

export function resolveOptions(options: PreviewHubOptions): ResolvedHubOptions {
  return {
    devtools: options.devtools ?? true,
    heartbeatMs: options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS,
    hubOrigin: options.hubOrigin ?? process.env["PREVIEW_HUB_ORIGIN"],
    mountPath: options.mountPath ?? DEFAULT_MOUNT_PATH,
    portRange: options.portRange ?? DEFAULT_PORT_RANGE,
    role: options.role ?? "auto",
    staleMs: options.staleMs ?? DEFAULT_STALE_MS,
  };
}
