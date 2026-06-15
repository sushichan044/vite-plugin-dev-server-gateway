import { statSync } from "node:fs";
import { join } from "node:path";

import type { GatewayRole } from "./options";

/**
 * Resolve the effective role. An explicit `gateway`/`instance` always wins. Otherwise `auto` is a
 * heuristic (D1): instance when the launch script has exported preview env vars, or when running
 * inside a linked git worktree; gateway otherwise.
 *
 * Pure over its inputs (env + cwd are passed in) so it is testable without mutating the process.
 */
export function resolveRole(
  explicit: GatewayRole,
  env: NodeJS.ProcessEnv,
  cwd: string,
): "gateway" | "instance" {
  if (explicit === "gateway" || explicit === "instance") {
    return explicit;
  }

  // The launch script (D3/D4) sets these before spawning an instance's dev command.
  if (isNonEmpty(env["PREVIEW_NAME"]) || isNonEmpty(env["PREVIEW_GATEWAY_BASE"])) {
    return "instance";
  }

  if (isLinkedWorktree(cwd)) {
    return "instance";
  }

  return "gateway";
}

function isNonEmpty(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

/**
 * A linked git worktree has `.git` as a file (a pointer to the main worktree), whereas a normal
 * checkout has `.git` as a directory. Cheap, synchronous, and needs no `git` on PATH.
 *
 * WHY NOT also treat submodules specially: a submodule also has a `.git` file, so a submodule used
 * as a dev root is misclassified as an instance — documented; use an explicit `role` there.
 */
function isLinkedWorktree(cwd: string): boolean {
  try {
    return statSync(join(cwd, ".git")).isFile();
  } catch {
    return false;
  }
}
