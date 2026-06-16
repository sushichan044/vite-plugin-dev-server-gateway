/**
 * Payload an instance POSTs to the gateway on register and on every heartbeat (D2).
 */
export interface RegisterPayload {
  /**
   * URL slug.
   */
  name: string;
  /**
   * Port the instance bound. Must be inside the gateway's `portRange` (D5).
   */
  port: number;
  /**
   * Mount path for this preview, e.g. `/preview/<name>/` — exactly one trailing slash (D4).
   */
  base: string;
  /**
   * Git branch, when known.
   */
  branch?: string;
}

/**
 * A live preview in the gateway's in-memory registry, with bookkeeping for eviction and UI.
 */
export interface RegistryEntry {
  name: string;
  port: number;
  base: string;
  branch?: string;
  /**
   * First registration time (ms). Stable across heartbeats; used for uptime.
   */
  registeredAt: number;
  /**
   * Last heartbeat time (ms). Drives staleness eviction.
   */
  lastSeen: number;
}
