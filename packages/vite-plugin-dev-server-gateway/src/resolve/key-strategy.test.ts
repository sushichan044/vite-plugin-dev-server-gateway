import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { GitBranchResolutionError } from "../errors";
import type { PreviewKey } from "../types";
import { readGitBranch, resolveKey } from "./key-strategy";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const mockedExec = vi.mocked(execFileSync);

afterEach(() => {
  vi.resetAllMocks();
});

describe("resolveKey", () => {
  it("rootDir uses the directory as key and its basename as label", async () => {
    await expect(resolveKey("rootDir", "/home/me/projects/my-app")).resolves.toEqual({
      key: "/home/me/projects/my-app",
      label: "my-app",
    });
  });

  it("a custom function returning a string fills key and label from it", async () => {
    await expect(resolveKey(() => "custom-key", "/cwd")).resolves.toEqual({
      key: "custom-key",
      label: "custom-key",
    });
  });

  it("a custom function may return a full PreviewKey", async () => {
    const previewKey: PreviewKey = { branch: "main", key: "abc", label: "App" };
    await expect(resolveKey(() => previewKey, "/cwd")).resolves.toEqual(previewKey);
  });

  it("gitBranch uses the branch as key, label, and branch", async () => {
    mockedExec.mockReturnValue("feature/login\n");
    await expect(resolveKey("gitBranch", "/repo")).resolves.toEqual({
      branch: "feature/login",
      key: "feature/login",
      label: "feature/login",
    });
  });
});

describe("readGitBranch", () => {
  it("trims the branch output", () => {
    mockedExec.mockReturnValue("  main \n");
    expect(readGitBranch("/repo")).toBe("main");
  });

  it("throws on a detached HEAD", () => {
    mockedExec.mockReturnValue("HEAD\n");
    expect(() => readGitBranch("/repo")).toThrow(GitBranchResolutionError);
  });

  it("throws when git is not available or there is no repo", () => {
    mockedExec.mockImplementation(() => {
      throw new Error("not a git repository");
    });
    expect(() => readGitBranch("/repo")).toThrow(GitBranchResolutionError);
  });
});
