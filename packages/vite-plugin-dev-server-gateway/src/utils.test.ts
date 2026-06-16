import { describe, expect, it } from "vite-plus/test";

import { ensureTrailingSlash, removeTrailingSlash } from "./utils";

describe("ensureTrailingSlash", () => {
  it("adds a trailing slash when it is missing", () => {
    expect(ensureTrailingSlash("/preview/foo")).toBe("/preview/foo/");
  });

  it("keeps exactly one trailing slash when one is already present", () => {
    expect(ensureTrailingSlash("/preview/foo/")).toBe("/preview/foo/");
  });

  it("falls back to the root path for undefined", () => {
    expect(ensureTrailingSlash(undefined)).toBe("/");
  });

  it("falls back to the root path for an empty string", () => {
    expect(ensureTrailingSlash("")).toBe("/");
  });
});

describe("removeTrailingSlash", () => {
  it("removes a single trailing slash", () => {
    expect(removeTrailingSlash("/preview/foo/")).toBe("/preview/foo");
  });

  it("removes multiple trailing slashes", () => {
    expect(removeTrailingSlash("/preview/foo///")).toBe("/preview/foo");
  });

  it("does not modify a path with no trailing slash", () => {
    expect(removeTrailingSlash("/preview/foo")).toBe("/preview/foo");
  });

  it("falls back to the root path for undefined", () => {
    expect(removeTrailingSlash(undefined)).toBe("/");
  });

  it("falls back to the root path for an empty string", () => {
    expect(removeTrailingSlash("")).toBe("/");
  });
});
