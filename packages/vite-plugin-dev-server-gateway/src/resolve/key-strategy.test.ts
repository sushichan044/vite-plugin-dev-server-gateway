import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { GitBranchResolutionError } from "../errors";
import { readGitBranch, resolveKey } from "./key-strategy";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const mockedExec = vi.mocked(execFileSync);

afterEach(() => {
  vi.resetAllMocks();
});

describe("resolveKey", () => {
  it("rootDir uses the directory as key and its basename as label", () => {
    expect(resolveKey("rootDir", "/home/me/projects/my-app")).toEqual({
      key: "/home/me/projects/my-app",
      label: "my-app",
    });
  });

  it("gitBranch uses the branch as key, label, and branch", () => {
    mockedExec.mockReturnValue("feature/login\n");
    expect(resolveKey("gitBranch", "/repo")).toEqual({
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
