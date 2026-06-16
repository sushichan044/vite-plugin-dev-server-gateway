import { describe, expect, it } from "vite-plus/test";

import type { ResolvedPreview } from "../types";
import { resolveOptions } from "./options";

describe("resolveOptions", () => {
  it("applies the mount path and port range defaults", () => {
    const resolved = resolveOptions({});

    expect(resolved.mountPath).toBe("/preview");
    expect(resolved.portRange).toEqual([53_000, 53_999]);
  });

  it("passes the resolved preview through untouched", () => {
    const instance: ResolvedPreview = {
      base: "/preview/app",
      diagnostics: { branch: "feat/x" },
      name: "app",
      port: 53_001,
    };

    expect(resolveOptions({ instance }).instance).toBe(instance);
  });

  it("has no instance for the gateway role", () => {
    expect(resolveOptions({}).instance).toBeUndefined();
  });
});
