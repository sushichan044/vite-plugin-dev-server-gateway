import { describe, expect, it } from "vite-plus/test";

import type { Instance } from "../instance";
import { resolveOptions } from "./options";

describe("resolveOptions", () => {
  it("applies the mount path and port range defaults", () => {
    const resolved = resolveOptions({});

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

    expect(resolveOptions({ instance }).instance).toBe(instance);
  });

  it("has no instance for the gateway role", () => {
    expect(resolveOptions({}).instance).toBeUndefined();
  });

  it("accepts a custom non-root mount path", () => {
    expect(resolveOptions({ mountPath: "/app" }).mountPath).toBe("/app");
  });

  it("rejects a mount path that is not a non-root absolute path", () => {
    // "/" collapses to an empty dispatch prefix that would match every request path.
    expect(() => resolveOptions({ mountPath: "/" })).toThrow();
    expect(() => resolveOptions({ mountPath: "//host" })).toThrow();
    expect(() => resolveOptions({ mountPath: "preview" })).toThrow();
  });
});
