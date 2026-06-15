import { describe, expect, it } from "vite-plus/test";

import { normalizeBase } from "./base";

describe("normalizeBase", () => {
  it("adds a trailing slash when it is missing", () => {
    expect(normalizeBase("/preview/foo")).toBe("/preview/foo/");
  });

  it("keeps exactly one trailing slash when one is already present", () => {
    expect(normalizeBase("/preview/foo/")).toBe("/preview/foo/");
  });

  it("falls back to the root path for undefined", () => {
    expect(normalizeBase(undefined)).toBe("/");
  });

  it("falls back to the root path for an empty string", () => {
    expect(normalizeBase("")).toBe("/");
  });
});
