/**
 * A preview's identity, produced by a {@link KeyStrategy}.
 *
 * `key` is hashed into a stable port; `label` is the human source for the URL slug. They are kept
 * separate because the port key can be a long absolute path that makes a poor slug (D3).
 */
export interface PreviewKey {
  /**
   * Stable value hashed into a port. Stays constant across restarts for the same checkout.
   */
  key: string;
  /**
   * Short human label used as the default name when no explicit `name` is given.
   */
  label: string;
  /**
   * Git branch, when the strategy knows it. Surfaced in the registry/UI.
   */
  branch?: string;
}

/**
 * How a preview derives its stable identity.
 *
 * - `"rootDir"` (default): key is the project root dir, label its basename. Maps 1:1 to a checkout
 *   and needs no git.
 * - `"gitBranch"`: key and label are the current branch. Opt-in per-branch previews.
 * - A function: full control. May return a bare key string or a {@link PreviewKey}.
 */
export type KeyStrategy =
  | "rootDir"
  | "gitBranch"
  | ((cwd: string) => PreviewKey | Promise<PreviewKey | string> | string);

/**
 * Inputs to {@link resolvePreview}, consumed by the user's launch script.
 */
export interface ResolvePreviewOptions {
  /**
   * @default "rootDir"
   */
  keyStrategy?: KeyStrategy;
  /**
   * Explicit URL slug. Overrides the strategy label. Must match `/^[a-z0-9-]+$/i`.
   */
  name?: string;
  /**
   * @default "/preview"
   */
  mountPath?: string;
  /**
   * Inclusive `[min, max]` port range.
   *
   * @default [53000, 53999]
   */
  portRange?: [number, number];
  /**
   * @default process.cwd()
   */
  cwd?: string;
}

/**
 * Display-only metadata about a preview, surfaced in the registry index and DevTools tab. It never
 * affects how the dev server is stood up or how requests are routed — kept apart from the fields a
 * preview needs to run.
 */
export interface PreviewDiagnostics {
  /**
   * Git branch, shown in the "Branch" column.
   */
  branch?: string;
}

/**
 * A fully resolved preview: everything needed to stand the dev server up, route to it, and describe
 * it. The single currency between the launch flow and the plugin — {@link resolvePreview} and
 * {@link instanceFromEnv} both produce it, and the plugin's `instance` option consumes it.
 *
 * `base` is carried (not re-derived) so other config files — a framework router's `basename`, etc.
 * — can read the same value the gateway routes on.
 */
export interface ResolvedPreview {
  /**
   * URL slug, e.g. `my-app`. Routes as `<mountPath>/my-app`.
   */
  name: string;
  /**
   * Probed free port within the range.
   */
  port: number;
  /**
   * Mount path for this preview, e.g. `/preview/my-app` — no trailing slash (D4).
   */
  base: string;
  /**
   * Display-only metadata; never affects serving or routing.
   */
  diagnostics?: PreviewDiagnostics;
}

/**
 * Options for the `devServerGateway` plugin. All optional; defaults cover the common case.
 */
export interface DevServerGatewayOptions {
  /**
   * The resolved preview this process serves. Provide it to run as an instance (the plugin wires
   * `base` / `server.port` and registers with the gateway); omit it to run the gateway. Build it
   * with `instanceFromEnv()`, hand it the result of {@link resolvePreview}, or construct it
   * directly.
   */
  instance?: ResolvedPreview;
  /**
   * Must match the value used at resolve time. @default "/preview"
   */
  mountPath?: string;
  /**
   * Bounds the dispatch security check (D5). @default [53000, 53999]
   */
  portRange?: [number, number];
  /**
   * Where instances register. @default env PREVIEW_GATEWAY_ORIGIN, else the Vite server origin
   */
  gatewayOrigin?: string;
  /**
   * Heartbeat interval (ms). @default 5000
   */
  heartbeatMs?: number;
  /**
   * Eviction window (ms): a couple of missed beats. @default 15000
   */
  staleMs?: number;
  /**
   * Register a Vite DevTools tab for the registry (D7). @default true
   */
  devtools?: boolean;
}
