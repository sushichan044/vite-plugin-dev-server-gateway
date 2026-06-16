import { describe, expect, it } from "vite-plus/test";

import { formatShellEnv, Shell, SHELLS } from "./shell-env";

describe("formatShellEnv", () => {
  const pairs: Array<[string, string]> = [
    ["VITE_DEV_SERVER_GATEWAY_NAME", "app-a"],
    ["VITE_DEV_SERVER_GATEWAY_PORT", "53012"],
  ];

  const exts = {
    bash: "bash",
    zsh: "zsh",
    fish: "fish",
    powershell: "ps1",
  } as const satisfies Record<Shell, string>;

  it.each(SHELLS)("renders env assignments for %s", (shell) => {
    const result = formatShellEnv(shell, pairs);
    expect(result).toMatchFileSnapshot(`./__snapshots__/env.snap.${exts[shell]}`);
  });

  it("escapes single quotes for the POSIX shells", () => {
    expect(formatShellEnv("bash", [["K", "a'b"]])).toBe("export K='a'\\''b'");
  });

  it("escapes backslashes and single quotes for fish", () => {
    expect(formatShellEnv("fish", [["K", "a'b\\c"]])).toBe("set -gx K 'a\\'b\\\\c'");
  });

  it("doubles single quotes for PowerShell", () => {
    expect(formatShellEnv("powershell", [["K", "a'b"]])).toBe("$env:K = 'a''b'");
  });
});
