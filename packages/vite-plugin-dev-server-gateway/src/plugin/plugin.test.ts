import type { JsonRenderSpec, ViteDevToolsNodeContext } from "@vitejs/devtools-kit";
import type { Plugin, ResolvedConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { devServerGateway } from "./plugin";

const MISSING_DIR = "/this/path/should/not/exist/dev-server-gateway";

function applyConfigResolved(plugin: Plugin, root: string): void {
  const hook = plugin.configResolved;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  fn?.call(undefined as never, { root } as unknown as ResolvedConfig);
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
    const plugin = devServerGateway();
    applyConfigResolved(plugin, MISSING_DIR);

    const probe = fakeCtx();
    plugin.devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(1);
  });

  it("skips the DevTools dock when devtools is disabled", () => {
    const plugin = devServerGateway({ devtools: false });
    applyConfigResolved(plugin, MISSING_DIR);

    const probe = fakeCtx();
    plugin.devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(0);
  });

  it("skips the DevTools dock for the instance role", () => {
    const plugin = devServerGateway({ role: "instance" });
    applyConfigResolved(plugin, MISSING_DIR);

    const probe = fakeCtx();
    plugin.devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(0);
  });
});
