import { describe, expect, it } from "vite-plus/test";

import { isIndexPath, isPortInRange, matchInstanceName } from "./dispatch";

describe("matchInstanceName", () => {
  it("extracts the name from a nested path", () => {
    expect(matchInstanceName("/preview/foo/bar", "/preview")).toBe("foo");
  });

  it("extracts the name when there is no trailing path", () => {
    expect(matchInstanceName("/preview/foo", "/preview")).toBe("foo");
  });

  it("ignores the query string", () => {
    expect(matchInstanceName("/preview/foo/?token=abc", "/preview")).toBe("foo");
  });

  it("returns null for the index path", () => {
    expect(matchInstanceName("/preview/", "/preview")).toBeNull();
  });

  it("returns null for the mount root without a trailing slash", () => {
    expect(matchInstanceName("/preview", "/preview")).toBeNull();
  });

  it("returns null for an unrelated path", () => {
    expect(matchInstanceName("/other/foo", "/preview")).toBeNull();
  });

  it("tolerates a mount path given with a trailing slash", () => {
    expect(matchInstanceName("/preview/foo/bar", "/preview/")).toBe("foo");
  });
});

describe("isIndexPath", () => {
  it("matches the mount root with and without a trailing slash", () => {
    expect(isIndexPath("/preview", "/preview")).toBe(true);
    expect(isIndexPath("/preview/", "/preview")).toBe(true);
  });

  it("does not match a dispatch path", () => {
    expect(isIndexPath("/preview/foo", "/preview")).toBe(false);
  });

  it("ignores the query string", () => {
    expect(isIndexPath("/preview/?x=1", "/preview")).toBe(true);
  });
});

describe("isPortInRange", () => {
  it("accepts the inclusive bounds", () => {
    expect(isPortInRange(53000, [53000, 53999])).toBe(true);
    expect(isPortInRange(53999, [53000, 53999])).toBe(true);
  });

  it("rejects ports outside the range", () => {
    expect(isPortInRange(52999, [53000, 53999])).toBe(false);
    expect(isPortInRange(54000, [53000, 53999])).toBe(false);
  });
});
