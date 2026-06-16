import { execFileSync } from "node:child_process";
import { basename } from "node:path";

import { GitBranchResolutionError } from "../../errors";
import type { KeyStrategy, InstanceKey } from "../types";

/**
 * Read the current git branch via `git`, throwing when there is no repo or HEAD is detached.
 */
export function readGitBranch(cwd: string): string {
  let branch: string;
  try {
    branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
    }).trim();
  } catch (cause) {
    throw new GitBranchResolutionError(cwd, { cause });
  }

  // `HEAD` means detached; empty means an unexpected git state. Neither yields a stable key.
  if (branch === "" || branch === "HEAD") {
    throw new GitBranchResolutionError(cwd);
  }
  return branch;
}

/**
 * Resolve a {@link KeyStrategy} into a concrete {@link InstanceKey} for the given working dir.
 */
export function resolveKey(strategy: KeyStrategy, cwd: string): InstanceKey {
  if (strategy === "rootDir") {
    return { key: cwd, label: basename(cwd) };
  }

  const branch = readGitBranch(cwd);
  return { branch, key: branch, label: branch };
}
