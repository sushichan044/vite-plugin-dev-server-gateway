#!/usr/bin/env node
import { cli, define } from "gunshi";

import type { Shell } from "./cli/shell-env";
import { buildPreviewEnv, formatShellEnv } from "./cli/shell-env";
import { resolvePreview } from "./resolve/resolve-preview";

const BIN_NAME = "vite-plugin-dev-server-gateway";
const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;

function isShell(value: string | undefined): value is Shell {
  return value !== undefined && (SHELLS as readonly string[]).includes(value);
}

const envCommand = define({
  args: {
    cwd: {
      description: "Directory to resolve the preview against (default: current directory)",
      type: "string",
    },
    gatewayOrigin: {
      description: "Gateway origin to export as PREVIEW_GATEWAY_ORIGIN (where instances register)",
      toKebab: true,
      type: "string",
    },
    keyStrategy: {
      choices: ["rootDir", "gitBranch"] as const,
      description: "How the preview derives its stable identity (default: rootDir)",
      toKebab: true,
      type: "enum",
    },
    mountPath: {
      description: "Mount path, must match the plugin's (default: /preview)",
      toKebab: true,
      type: "string",
    },
    name: {
      description: "Explicit URL slug (default: the key strategy label)",
      type: "string",
    },
    shell: {
      description: `Target shell: ${SHELLS.join(" | ")}`,
      required: true,
      type: "positional",
    },
  },
  description: "Print shell statements that set the preview env (eval/source the output)",
  name: "env",
  // The output is meant to be eval'd / sourced, so suppress gunshi's header banner. Validation
  // errors are also suppressed here and surfaced once by the top-level catch below (gunshi otherwise
  // both renders them and throws, printing twice).
  rendering: { header: null, validationErrors: null },
  run: async (ctx) => {
    const { cwd, gatewayOrigin, keyStrategy, mountPath, name, shell } = ctx.values;
    if (!isShell(shell)) {
      process.stderr.write(`Unknown shell "${shell}". Use one of: ${SHELLS.join(", ")}\n`);
      process.exitCode = 1;
      return;
    }

    const preview = await resolvePreview({ cwd, keyStrategy, mountPath, name });
    const pairs = buildPreviewEnv({ gatewayOrigin, preview });
    process.stdout.write(`${formatShellEnv(shell, pairs)}\n`);
  },
});

const mainCommand = define({
  description: "Resolve a preview identity and print shell env for launch-script integration",
  name: BIN_NAME,
  run: (ctx) => {
    ctx.log(
      `Usage: ${BIN_NAME} env <bash|zsh|fish|powershell> [options]\n` +
        `Example: eval "$(${BIN_NAME} env bash)" && vite`,
    );
  },
});

try {
  await cli(process.argv.slice(2), mainCommand, {
    name: BIN_NAME,
    subCommands: { env: envCommand },
  });
} catch (error) {
  // gunshi throws an AggregateError for arg-validation failures (e.g. a missing required positional
  // or a bad --key-strategy); surface the messages instead of an uncaught stack trace.
  const message =
    error instanceof AggregateError
      ? error.errors.map((e) => (e instanceof Error ? e.message : String(e))).join("\n")
      : error instanceof Error
        ? error.message
        : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
