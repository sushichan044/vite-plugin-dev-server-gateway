import { describe, expect, it } from "vite-plus/test";

import { ensureTrailingSlash } from "./utils";

describe("ensureTrailingSlash", () => {
  it("adds a trailing slash when it is missing", () => {
    expect(ensureTrailingSlash("/preview/foo")).toBe("/preview/foo/");
  });

  it("keeps exactly one trailing slash when one is already present", () => {
    expect(ensureTrailingSlash("/preview/foo/")).toBe("/preview/foo/");
  });

  it("collapses multiple trailing slashes to exactly one", () => {
    expect(ensureTrailingSlash("/preview/foo//")).toBe("/preview/foo/");
  });

  it("falls back to the root path for undefined", () => {
    expect(ensureTrailingSlash(undefined)).toBe("/");
  });

  it("falls back to the root path for an empty string", () => {
    expect(ensureTrailingSlash("")).toBe("/");
  });
});
