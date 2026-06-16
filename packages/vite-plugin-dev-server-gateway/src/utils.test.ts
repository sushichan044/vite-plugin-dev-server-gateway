import { describe, expect, it } from "vite-plus/test";

import { ensureTrailingSlash, isCanonicalBase } from "./utils";

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

describe("isCanonicalBase", () => {
  it.each(["/", "/preview/app/", "/preview/my-app/"])("accepts the canonical path %s", (value) => {
    expect(isCanonicalBase(value)).toBe(true);
  });

  it.each([
    ["a non-path scheme", "javascript:alert(1)"],
    ["a protocol-relative host", "//evil.example.com/"],
    ["a missing trailing slash", "/preview/app"],
    ["more than one trailing slash", "/preview/app//"],
    ["a query string", "/preview/app/?x=1"],
    ["a fragment", "/preview/app/#h"],
  ])("rejects %s", (_label, value) => {
    expect(isCanonicalBase(value)).toBe(false);
  });
});
