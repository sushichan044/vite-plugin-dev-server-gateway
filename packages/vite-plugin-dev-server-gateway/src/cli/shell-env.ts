import type { ResolvedPreview } from "../types";

/**
 * Shells the `env` CLI can target. bash and zsh share POSIX syntax; fish and PowerShell differ.
 */
export const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;

export type Shell = (typeof SHELLS)[number];

export interface ShellEnvInput {
  preview: ResolvedPreview;
  /**
   * Exported as `PREVIEW_GATEWAY_ORIGIN` when set, so instances know where to register.
   */
  gatewayOrigin?: string;
}

/**
 * Build the ordered env var pairs the launch flow consumes — a lossless serialization of the
 * {@link ResolvedPreview} that {@link instanceFromEnv} reads back. `PREVIEW_NAME`,
 * `PREVIEW_GATEWAY_BASE`, and `PREVIEW_GATEWAY_PORT` are the essentials; `PREVIEW_GATEWAY_BRANCH`
 * (diagnostics) and `PREVIEW_GATEWAY_ORIGIN` are emitted only when known.
 */
export function buildPreviewEnv(input: ShellEnvInput): Array<[string, string]> {
  const { gatewayOrigin, preview } = input;

  const pairs: Array<[string, string]> = [
    ["PREVIEW_NAME", preview.name],
    ["PREVIEW_GATEWAY_BASE", preview.base],
    ["PREVIEW_GATEWAY_PORT", String(preview.port)],
  ];
  if (preview.diagnostics?.branch !== undefined) {
    pairs.push(["PREVIEW_GATEWAY_BRANCH", preview.diagnostics.branch]);
  }
  if (gatewayOrigin !== undefined) {
    pairs.push(["PREVIEW_GATEWAY_ORIGIN", gatewayOrigin]);
  }
  return pairs;
}

/**
 * Render env pairs as statements for the target shell, each value quoted with that shell's literal
 * escaping so it can be `eval`'d (bash/zsh), `source`'d (fish), or piped to `Invoke-Expression`
 * (PowerShell) without further processing.
 */
export function formatShellEnv(shell: Shell, pairs: Array<[string, string]>): string {
  return pairs.map(([key, value]) => formatLine(shell, key, value)).join("\n");
}

function formatLine(shell: Shell, key: string, value: string): string {
  switch (shell) {
    case "bash":
    case "zsh": {
      // POSIX single-quote: end the quote, emit an escaped quote, reopen — '\'' for each '.
      return `export ${key}='${value.replaceAll("'", "'\\''")}'`;
    }
    case "fish": {
      // Inside fish single quotes only \ and ' are special; escape backslashes first.
      const escaped = value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
      return `set -gx ${key} '${escaped}'`;
    }
    case "powershell": {
      // PowerShell single-quoted strings escape ' by doubling it.
      return `$env:${key} = '${value.replaceAll("'", "''")}'`;
    }
    default: {
      throw new Error(`Unsupported shell: ${shell satisfies never}`);
    }
  }
}
