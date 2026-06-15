import { describe, expect, it } from "vite-plus/test";

import type { ResolvedPreview } from "../types";
import { buildPreviewEnv, formatShellEnv } from "./shell-env";

function preview(overrides: Partial<ResolvedPreview> = {}): ResolvedPreview {
  return { base: "/preview/app-a", name: "app-a", port: 53_012, ...overrides };
}

describe("buildPreviewEnv", () => {
  it("emits the core trio in launch order", () => {
    expect(buildPreviewEnv({ preview: preview() })).toEqual([
      ["PREVIEW_NAME", "app-a"],
      ["PREVIEW_GATEWAY_BASE", "/preview/app-a"],
      ["PREVIEW_GATEWAY_PORT", "53012"],
    ]);
  });

  it("includes the branch only when known", () => {
    const pairs = buildPreviewEnv({ preview: preview({ branch: "feat/x" }) });
    expect(pairs).toContainEqual(["PREVIEW_GATEWAY_BRANCH", "feat/x"]);
  });

  it("includes the gateway origin only when provided", () => {
    const pairs = buildPreviewEnv({ gatewayOrigin: "http://localhost:5173", preview: preview() });
    expect(pairs).toContainEqual(["PREVIEW_GATEWAY_ORIGIN", "http://localhost:5173"]);
  });
});

describe("formatShellEnv", () => {
  const pairs: Array<[string, string]> = [
    ["PREVIEW_NAME", "app-a"],
    ["PREVIEW_GATEWAY_BASE", "/preview/app-a"],
  ];

  it("renders POSIX exports for bash and zsh", () => {
    const expected = "export PREVIEW_NAME='app-a'\nexport PREVIEW_GATEWAY_BASE='/preview/app-a'";
    expect(formatShellEnv("bash", pairs)).toBe(expected);
    expect(formatShellEnv("zsh", pairs)).toBe(expected);
  });

  it("renders fish set -gx statements", () => {
    expect(formatShellEnv("fish", pairs)).toBe(
      "set -gx PREVIEW_NAME 'app-a'\nset -gx PREVIEW_GATEWAY_BASE '/preview/app-a'",
    );
  });

  it("renders PowerShell env assignments", () => {
    expect(formatShellEnv("powershell", pairs)).toBe(
      "$env:PREVIEW_NAME = 'app-a'\n$env:PREVIEW_GATEWAY_BASE = '/preview/app-a'",
    );
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
