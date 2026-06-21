#!/usr/bin/env node
import { cli, define } from "gunshi";

import { detectShell } from "./cli/detect-shell";
import type { Shell } from "./cli/shell-env";
import { formatShellEnv, SHELLS } from "./cli/shell-env";
import { buildInstanceEnv, resolveInstance } from "./instance";

const BIN_NAME = "vite-plugin-dev-server-gateway";

function isShell(value: string | undefined): value is Shell {
  return value !== undefined && (SHELLS as readonly string[]).includes(value);
}

/**
 * Parse a `MIN-MAX` port range, returning `undefined` when malformed or when `max < min`.
 */
function parsePortRange(value: string): [number, number] | undefined {
  const match = /^(\d+)-(\d+)$/.exec(value);
  if (match === null) {
    return undefined;
  }
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (min <= 0 || max < min) {
    return undefined;
  }
  return [min, max];
}

const envCommand = define({
  args: {
    cwd: {
      description: "Directory to resolve the preview against (default: current directory)",
      type: "string",
    },
    gatewayOrigin: {
      description:
        "Gateway origin to export as VITE_DEV_SERVER_GATEWAY_ORIGIN (where instances register)",
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
    portRange: {
      description:
        "Port range the gateway accepts, as MIN-MAX (default: 53000-53999, must match the plugin)",
      toKebab: true,
      type: "string",
    },
    shell: {
      description: `Target shell: ${SHELLS.join(" | ")} | auto (detect from the environment)`,
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
    const { cwd, gatewayOrigin, keyStrategy, mountPath, name, portRange, shell } = ctx.values;
    const target = shell === "auto" ? detectShell(process.env) : shell;
    if (!isShell(target)) {
      const reason =
        shell === "auto"
          ? "Could not detect the shell from the environment."
          : `Unknown shell "${shell}".`;
      process.stderr.write(`${reason} Use one of: ${SHELLS.join(", ")}\n`);
      process.exitCode = 1;
      return;
    }

    // Forward the range so the probed port lands inside the gateway's accepted range (D5). Without
    // this a non-default plugin portRange would silently get a port the gateway rejects.
    let resolvedRange: [number, number] | undefined;
    if (portRange !== undefined) {
      resolvedRange = parsePortRange(portRange);
      if (resolvedRange === undefined) {
        process.stderr.write(
          `Invalid --port-range "${portRange}". Expected MIN-MAX, e.g. 53000-53999.\n`,
        );
        process.exitCode = 1;
        return;
      }
    }

    const instance = await resolveInstance({
      cwd,
      keyStrategy,
      mountPath,
      name,
      portRange: resolvedRange,
    });
    const pairs = buildInstanceEnv({ gatewayOrigin, instance });
    process.stdout.write(`${formatShellEnv(target, pairs)}\n`);
  },
});

const mainCommand = define({
  description: "Resolve a preview identity and print shell env for launch-script integration",
  name: BIN_NAME,
  run: (ctx) => {
    ctx.log(
      `Usage: ${BIN_NAME} env <bash|zsh|fish|powershell|auto> [options]\n` +
        `Example: eval "$(${BIN_NAME} env auto)" && vite`,
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
