/**
 * The gateway's own server, surfaced in the UI separately from the instance registry.
 *
 * The gateway is not a registry entry: its existence is guaranteed (it _is_ the server hosting the
 * registry) and it never heartbeats, so it is tracked apart from the instances that come and go. It
 * is delivered to clients via `GET /config` and server-rendered into the index page.
 */
export interface GatewayInfo {
  name: string;
  /**
   * Always `/`: the gateway serves its own app at the origin root.
   */
  base: string;
  port: number;
  branch?: string;
}
