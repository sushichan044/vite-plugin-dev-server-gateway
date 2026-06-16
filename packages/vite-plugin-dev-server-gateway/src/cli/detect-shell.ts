import type { Shell } from "./shell-env";

// Env vars that name the invoking shell, in priority order: npm exposes the configured script-shell
// when run via a package script; SHELL is the POSIX login shell; ComSpec is Windows' fallback.
const SHELL_HINT_VARS = ["npm_config_script_shell", "SHELL", "ComSpec"] as const;

/**
 * Best-effort detection of the shell `env auto` should target, by scanning the hint vars in
 * priority order and matching the first value that names a supported shell. A var set to an
 * unsupported shell (e.g. ComSpec's cmd.exe) is skipped, not treated as a failure. Returns
 * `undefined` when nothing matches, so the caller can ask for an explicit shell instead of guessing
 * wrong.
 *
 * Matching is substring-based so full paths like `/usr/bin/zsh` resolve without parsing.
 */
export function detectShell(env: NodeJS.ProcessEnv): Shell | undefined {
  for (const name of SHELL_HINT_VARS) {
    const hint = env[name]?.toLowerCase();
    if (hint === undefined || hint === "") {
      continue;
    }
    if (hint.includes("pwsh") || hint.includes("powershell")) {
      return "powershell";
    }
    if (hint.includes("zsh")) {
      return "zsh";
    }
    if (hint.includes("bash")) {
      return "bash";
    }
    if (hint.includes("fish")) {
      return "fish";
    }
  }
  return undefined;
}
