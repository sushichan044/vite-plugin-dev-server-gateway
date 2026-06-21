/**
 * Thrown when no free port is available within the configured range (D-failure: range exhausted).
 */
export class PortRangeExhaustedError extends Error {
  constructor(range: readonly [number, number]) {
    super(`No free port available in range ${range[0]}-${range[1]}`);
    this.name = "PortRangeExhaustedError";
  }
}

/**
 * Thrown when an explicit or derived name is not a valid slug.
 */
export class InvalidNameError extends Error {
  constructor(value: string) {
    super(
      `Invalid preview name: ${JSON.stringify(value)} (must match /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i)`,
    );
    this.name = "InvalidNameError";
  }
}

/**
 * Thrown when the `gitBranch` strategy cannot determine a usable branch (no repo / detached HEAD).
 */
export class GitBranchResolutionError extends Error {
  constructor(cwd: string, options?: ErrorOptions) {
    super(`Could not resolve a git branch in ${cwd} (no repository or detached HEAD)`, options);
    this.name = "GitBranchResolutionError";
  }
}
