import { describe, expect, it } from "vite-plus/test";

import { buildInstanceEnv, instanceFromEnv } from "./env";
import type { Instance } from "./types";

const baseEnv = {
  VITE_DEV_SERVER_GATEWAY_BASE: "/preview/app",
  VITE_DEV_SERVER_GATEWAY_PORT: "53001",
  VITE_DEV_SERVER_GATEWAY_NAME: "app",
};

describe("instanceFromEnv", () => {
  it("rebuilds the preview with a numeric port from the env", () => {
    expect(instanceFromEnv(baseEnv)).toEqual({
      base: "/preview/app/",
      name: "app",
      port: 53_001,
    });
  });

  it("normalizes the base to exactly one trailing slash", () => {
    expect(
      instanceFromEnv({ ...baseEnv, VITE_DEV_SERVER_GATEWAY_BASE: "/preview/app/" })?.base,
    ).toBe("/preview/app/");
  });

  it("carries the branch as diagnostics when present", () => {
    const instance = instanceFromEnv({ ...baseEnv, VITE_DEV_SERVER_GATEWAY_BRANCH: "feat/x" });

    expect(instance?.diagnostics).toEqual({ branch: "feat/x" });
  });

  it("omits diagnostics when no branch is in the env", () => {
    expect(instanceFromEnv(baseEnv)).not.toHaveProperty("diagnostics");
  });

  it("returns undefined (gateway) when the name is absent", () => {
    expect(
      instanceFromEnv({
        VITE_DEV_SERVER_GATEWAY_BASE: "/preview/app",
        VITE_DEV_SERVER_GATEWAY_PORT: "53001",
      }),
    ).toBeUndefined();
  });

  it("returns undefined (gateway) when the base is absent", () => {
    expect(
      instanceFromEnv({
        VITE_DEV_SERVER_GATEWAY_PORT: "53001",
        VITE_DEV_SERVER_GATEWAY_NAME: "app",
      }),
    ).toBeUndefined();
  });

  it("returns undefined when the port is not a positive integer", () => {
    expect(instanceFromEnv({ ...baseEnv, VITE_DEV_SERVER_GATEWAY_PORT: "nope" })).toBeUndefined();
  });
});

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return { base: "/preview/app-a/", name: "app-a", port: 53_012, ...overrides };
}

describe("buildInstanceEnv", () => {
  it("emits the essential name, base, and port in launch order", () => {
    expect(buildInstanceEnv({ instance: makeInstance() })).toEqual([
      ["VITE_DEV_SERVER_GATEWAY_NAME", "app-a"],
      ["VITE_DEV_SERVER_GATEWAY_BASE", "/preview/app-a/"],
      ["VITE_DEV_SERVER_GATEWAY_PORT", "53012"],
    ]);
  });

  it("includes the diagnostics branch only when known", () => {
    const pairs = buildInstanceEnv({
      instance: makeInstance({ diagnostics: { branch: "feat/x" } }),
    });
    expect(pairs).toContainEqual(["VITE_DEV_SERVER_GATEWAY_BRANCH", "feat/x"]);
  });

  it("includes the gateway origin only when provided", () => {
    const pairs = buildInstanceEnv({
      gatewayOrigin: "http://localhost:5173",
      instance: makeInstance(),
    });
    expect(pairs).toContainEqual(["VITE_DEV_SERVER_GATEWAY_ORIGIN", "http://localhost:5173"]);
  });
});
