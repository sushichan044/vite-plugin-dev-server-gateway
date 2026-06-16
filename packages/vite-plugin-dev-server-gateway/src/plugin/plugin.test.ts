import type { JsonRenderSpec, ViteDevToolsNodeContext } from "@vitejs/devtools-kit";
import type { Plugin, UserConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { devServerGateway } from "./plugin";

function callConfig(plugin: Plugin): UserConfig | undefined {
  const hook = plugin.config;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  return fn?.call(undefined as never, {}, { command: "serve", mode: "development" }) as
    | UserConfig
    | undefined;
}

function fakeCtx(): { ctx: ViteDevToolsNodeContext; registered: number } {
  const counter = { registered: 0 };
  const ui = {
    _stateKey: "dev-server-gateway",
    updateSpec: () => undefined,
    updateState: () => undefined,
  };
  const ctx = {
    createJsonRenderer: (_spec: JsonRenderSpec) => ui,
    docks: {
      register: () => {
        counter.registered += 1;
        return { update: () => undefined };
      },
    },
    viteServer: undefined,
  };
  return {
    ctx: ctx as unknown as ViteDevToolsNodeContext,
    get registered() {
      return counter.registered;
    },
  };
}

describe("devServerGateway", () => {
  it("exposes the plugin name", () => {
    expect(devServerGateway().name).toBe("vite-plugin-dev-server-gateway");
  });

  it("registers the DevTools dock for the gateway role by default", () => {
    const probe = fakeCtx();
    devServerGateway().devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(1);
  });

  it("skips the DevTools dock when devtools is disabled", () => {
    const probe = fakeCtx();
    devServerGateway({ devtools: false }).devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(0);
  });

  it("skips the DevTools dock for the instance role", () => {
    const probe = fakeCtx();
    devServerGateway({
      instance: { base: "/preview/app/", name: "app", port: 53_001 },
    }).devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(0);
  });

  it("wires the carried base (one trailing slash) and a strict server port for an instance", () => {
    const config = callConfig(
      devServerGateway({ instance: { base: "/preview/app/", name: "app", port: 53_001 } }),
    );

    expect(config).toEqual({
      base: "/preview/app/",
      server: { port: 53_001, strictPort: true },
    });
  });

  it("leaves Vite config untouched for the gateway role", () => {
    expect(callConfig(devServerGateway())).toBeUndefined();
  });
});
