import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { PortRangeExhaustedError } from "../errors";
import { stablePort } from "./port";
import { resolvePreview } from "./resolve-preview";

// ---- port-occupation helpers ------------------------------------------------

const openServers: Server[] = [];

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address !== null && typeof address !== "string" ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function occupy(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      openServers.push(server);
      resolve();
    });
  });
}

afterEach(() => {
  while (openServers.length > 0) {
    openServers.pop()?.close();
  }
});

// ---- fixtures ---------------------------------------------------------------

/**
 * A temporary directory whose basename is used as the rootDir label. Cleaned up after each test.
 */
const withTmpDir = test.extend<{ tmpDir: string }>({
  // eslint-disable-next-line no-empty-pattern
  tmpDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), "resolve-preview-test-"));
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

/**
 * A temporary git repository (git init + initial commit on "main"). Cleaned up after each test.
 */
const withGitRepo = test.extend<{ repoDir: string }>({
  // eslint-disable-next-line no-empty-pattern
  repoDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), "resolve-preview-git-"));
    execFileSync("git", ["init", "-b", "main"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    execFileSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: dir });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

// ---- tests ------------------------------------------------------------------

describe("resolvePreview", () => {
  withTmpDir(
    "derives name and a trailing-slash base from the strategy label",
    async ({ tmpDir }) => {
      // rootDir strategy: label = basename(cwd). The tmpDir basename starts with
      // "resolve-preview-test-" which is already slug-compatible.
      const result = await resolvePreview({
        keyStrategy: "rootDir",
        cwd: tmpDir,
        portRange: [53000, 53999],
      });

      // name is the slugified basename, base is /preview/<name>/ (one trailing slash)
      expect(result.name).toMatch(/^[a-z0-9-]+$/);
      expect(result.base).toBe(`/preview/${result.name}/`);
      expect(result.port).toBeGreaterThanOrEqual(53000);
      expect(result.port).toBeLessThanOrEqual(53999);
      expect(result.diagnostics).toBeUndefined();
    },
  );

  withTmpDir("lets an explicit name override the strategy label", async ({ tmpDir }) => {
    const result = await resolvePreview({
      keyStrategy: "rootDir",
      cwd: tmpDir,
      name: "chosen",
      portRange: [53000, 53999],
    });

    expect(result.name).toBe("chosen");
    expect(result.base).toBe("/preview/chosen/");
  });

  withTmpDir(
    "honors a custom mountPath and normalizes to one trailing slash",
    async ({ tmpDir }) => {
      const result = await resolvePreview({
        keyStrategy: "rootDir",
        cwd: tmpDir,
        mountPath: "/apps",
        name: "foo",
        portRange: [53000, 53999],
      });

      expect(result.base).toBe("/apps/foo/");
    },
  );

  withGitRepo("surfaces the branch from the strategy as diagnostics", async ({ repoDir }) => {
    const result = await resolvePreview({
      keyStrategy: "gitBranch",
      cwd: repoDir,
      portRange: [53000, 53999],
    });

    expect(result.diagnostics?.branch).toBe("main");
  });

  withTmpDir("propagates port exhaustion as PortRangeExhaustedError", async ({ tmpDir }) => {
    const free = await getFreePort();
    const preferred = stablePort(tmpDir, [free, free]);
    await occupy(preferred);

    await expect(
      resolvePreview({ keyStrategy: "rootDir", cwd: tmpDir, portRange: [free, free] }),
    ).rejects.toThrow(PortRangeExhaustedError);
  });
});
