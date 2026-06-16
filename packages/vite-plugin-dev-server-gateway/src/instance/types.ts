/**
 * A preview's identity, produced by a {@link KeyStrategy}.
 *
 * `key` is hashed into a stable port; `label` is the human source for the URL slug. They are kept
 * separate because the port key can be a long absolute path that makes a poor slug (D3).
 */
export interface InstanceKey {
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
 */
export type KeyStrategy = "rootDir" | "gitBranch";

/**
 * Inputs to {@link resolveInstance}, consumed by the user's launch script.
 */
export interface ResolveInstanceOptions {
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
export interface InstanceDiagnostics {
  /**
   * Git branch, shown in the "Branch" column.
   */
  branch?: string;
}

/**
 * A fully resolved preview: everything needed to stand the dev server up, route to it, and describe
 * it. The single currency between the launch flow and the plugin — {@link resolveInstance} and
 * {@link instanceFromEnv} both produce it, and the plugin's `instance` option consumes it.
 *
 * `base` is carried (not re-derived) so other config files — a framework router's `basename`, etc.
 * — can read the same value the gateway routes on.
 */
export interface Instance {
  /**
   * URL slug, e.g. `my-app`. Routes as `<mountPath>/my-app`.
   */
  name: string;
  /**
   * Probed free port within the range.
   */
  port: number;
  /**
   * Mount path for this preview, e.g. `/preview/my-app/` — exactly one trailing slash (D4).
   */
  base: string;
  /**
   * Display-only metadata; never affects serving or routing.
   */
  diagnostics?: InstanceDiagnostics;
}
