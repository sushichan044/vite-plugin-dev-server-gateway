/**
 * A preview's identity, produced by a {@link KeyStrategy}.
 *
 * `key` is hashed into a stable port; `label` is the human source for the URL slug. They are kept
 * separate because the port key can be a long absolute path that makes a poor slug (D3).
 */
export interface PreviewKey {
  /** Stable value hashed into a port. Stays constant across restarts for the same checkout. */
  key: string;
  /** Short human label used as the default name when no explicit `name` is given. */
  label: string;
  /** Git branch, when the strategy knows it. Surfaced in the registry/UI. */
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

/** Inputs to {@link resolvePreview}, consumed by the user's launch script. */
export interface ResolvePreviewOptions {
  /** @default "rootDir" */
  keyStrategy?: KeyStrategy;
  /** Explicit URL slug. Overrides the strategy label. Must match `/^[a-z0-9-]+$/i`. */
  name?: string;
  /** @default "/preview" */
  mountPath?: string;
  /** Inclusive `[min, max]` port range. @default [53000, 53999] */
  portRange?: [number, number];
  /** @default process.cwd() */
  cwd?: string;
}

/** Result of {@link resolvePreview}; the launch script puts these into the environment. */
export interface ResolvedPreview {
  /** URL slug, e.g. `my-app`. */
  name: string;
  /** Probed free port within `portRange`. */
  port: number;
  /** Mount path for this preview, e.g. `/preview/my-app` — no trailing slash (D4). */
  base: string;
  /** Git branch, when known. */
  branch?: string;
}
