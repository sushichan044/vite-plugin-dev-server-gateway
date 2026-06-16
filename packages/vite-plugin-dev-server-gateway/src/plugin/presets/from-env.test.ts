import { describe, expect, it } from "vite-plus/test";

import { instanceFromEnv } from "./from-env";

const baseEnv = {
  PREVIEW_GATEWAY_BASE: "/preview/app",
  PREVIEW_GATEWAY_PORT: "53001",
  PREVIEW_NAME: "app",
};

describe("instanceFromEnv", () => {
  it("rebuilds the preview with a numeric port from the env", () => {
    expect(instanceFromEnv(baseEnv)).toEqual({
      base: "/preview/app",
      name: "app",
      port: 53_001,
    });
  });

  it("carries the branch as diagnostics when present", () => {
    const instance = instanceFromEnv({ ...baseEnv, PREVIEW_GATEWAY_BRANCH: "feat/x" });

    expect(instance?.diagnostics).toEqual({ branch: "feat/x" });
  });

  it("omits diagnostics when no branch is in the env", () => {
    expect(instanceFromEnv(baseEnv)).not.toHaveProperty("diagnostics");
  });

  it("returns undefined (gateway) when the name is absent", () => {
    expect(
      instanceFromEnv({ PREVIEW_GATEWAY_BASE: "/preview/app", PREVIEW_GATEWAY_PORT: "53001" }),
    ).toBeUndefined();
  });

  it("returns undefined (gateway) when the base is absent", () => {
    expect(instanceFromEnv({ PREVIEW_GATEWAY_PORT: "53001", PREVIEW_NAME: "app" })).toBeUndefined();
  });

  it("returns undefined when the port is not a positive integer", () => {
    expect(instanceFromEnv({ ...baseEnv, PREVIEW_GATEWAY_PORT: "nope" })).toBeUndefined();
  });
});
