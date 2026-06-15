import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { resolveRole } from "./role";

const MISSING_DIR = "/this/path/should/not/exist/dev-server-gateway";

describe("resolveRole", () => {
  it("returns an explicit gateway role even when env signals an instance", () => {
    expect(resolveRole("gateway", { PREVIEW_NAME: "x" }, MISSING_DIR)).toBe("gateway");
  });

  it("returns an explicit instance role", () => {
    expect(resolveRole("instance", {}, MISSING_DIR)).toBe("instance");
  });

  it("auto resolves to instance when PREVIEW_NAME is set", () => {
    expect(resolveRole("auto", { PREVIEW_NAME: "app" }, MISSING_DIR)).toBe("instance");
  });

  it("auto resolves to instance when PREVIEW_GATEWAY_BASE is set", () => {
    expect(resolveRole("auto", { PREVIEW_GATEWAY_BASE: "/preview/app" }, MISSING_DIR)).toBe(
      "instance",
    );
  });

  it("auto resolves to gateway when nothing signals an instance", () => {
    expect(resolveRole("auto", {}, MISSING_DIR)).toBe("gateway");
  });

  it("auto resolves to instance inside a linked worktree (.git is a file)", () => {
    const dir = mkdtempSync(join(tmpdir(), "dev-server-gateway-"));
    writeFileSync(join(dir, ".git"), "gitdir: /elsewhere\n");
    try {
      expect(resolveRole("auto", {}, dir)).toBe("instance");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("auto resolves to gateway in a normal checkout (.git is a directory)", () => {
    const dir = mkdtempSync(join(tmpdir(), "dev-server-gateway-"));
    mkdirSync(join(dir, ".git"));
    try {
      expect(resolveRole("auto", {}, dir)).toBe("gateway");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
