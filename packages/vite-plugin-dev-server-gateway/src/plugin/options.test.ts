import { describe, expect, it } from "vite-plus/test";

import type { Instance } from "../instance";
import { resolvePluginOptions } from "./options";

describe("resolveOptions", () => {
  it("applies the mount path and port range defaults", () => {
    const resolved = resolvePluginOptions({});

    expect(resolved.mountPath).toBe("/preview");
    expect(resolved.portRange).toEqual([53_000, 53_999]);
  });

  it("passes the resolved preview through untouched", () => {
    const instance: Instance = {
      base: "/preview/app",
      diagnostics: { branch: "feat/x" },
      name: "app",
      port: 53_001,
    };

    expect(resolvePluginOptions({ instance }).instance).toBe(instance);
  });

  it("has no instance for the gateway role", () => {
    expect(resolvePluginOptions({}).instance).toBeUndefined();
  });
});
