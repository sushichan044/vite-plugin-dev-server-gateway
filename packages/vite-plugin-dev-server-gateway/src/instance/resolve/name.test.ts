import { describe, expect, it } from "vite-plus/test";

import { InvalidNameError } from "../../errors";
import { deriveName, slugify } from "./name";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric runs with a single dash", () => {
    expect(slugify("My App")).toBe("my-app");
    expect(slugify("feat/new_thing")).toBe("feat-new-thing");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("__edge__")).toBe("edge");
  });

  it("returns an empty string when there is nothing slug-worthy", () => {
    expect(slugify("///")).toBe("");
  });
});

describe("deriveName", () => {
  it("returns an explicit valid name verbatim", () => {
    expect(deriveName("my-app", "ignored-label")).toBe("my-app");
  });

  it("slugifies the strategy label when no explicit name is given", () => {
    expect(deriveName(undefined, "My App")).toBe("my-app");
  });

  it("slugifies a branch-style label", () => {
    expect(deriveName(undefined, "feature/login")).toBe("feature-login");
  });

  it("throws when an explicit name is not a valid slug", () => {
    expect(() => deriveName("not a slug!", "label")).toThrow(InvalidNameError);
  });

  it("rejects explicit names with leading/trailing dashes or only dashes", () => {
    expect(() => deriveName("-abc", "label")).toThrow(InvalidNameError);
    expect(() => deriveName("abc-", "label")).toThrow(InvalidNameError);
    expect(() => deriveName("--", "label")).toThrow(InvalidNameError);
  });

  it("throws when the label slugifies to nothing", () => {
    expect(() => deriveName(undefined, "///")).toThrow(InvalidNameError);
  });

  it("is idempotent for an already-slug label", () => {
    expect(deriveName(undefined, "already-slug")).toBe("already-slug");
  });
});
