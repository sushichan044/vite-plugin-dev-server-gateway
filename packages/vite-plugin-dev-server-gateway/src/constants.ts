/**
 * Default mount path for the gateway and previews. Matches the mental model and current usage.
 */
export const DEFAULT_MOUNT_PATH = "/preview";

/**
 * Default port range: high and rarely contended; also bounds the dispatch security check (D5).
 */
export const DEFAULT_PORT_RANGE = [53000, 53999] as const satisfies [number, number];

/**
 * Fixed control path prefix, separate from the dispatch mount path.
 */
export const CONTROL_PREFIX = "/__dev-server-gateway";

/**
 * Default heartbeat / staleness windows (ms): a couple of missed beats before eviction.
 */
export const DEFAULT_HEARTBEAT_MS = 5000;
export const DEFAULT_STALE_MS = 15000;

/**
 * A valid preview name (URL slug).
 */
export const NAME_PATTERN = /^[a-z0-9-]+$/i;
