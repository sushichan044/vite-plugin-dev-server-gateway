import type { JsonRenderSpec, ViteDevToolsNodeContext } from "@vitejs/devtools-kit";
import type { Plugin, ResolvedConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { previewHub } from "./plugin";

const MISSING_DIR = "/this/path/should/not/exist/preview-hub";

function applyConfigResolved(plugin: Plugin, root: string): void {
  const hook = plugin.configResolved;
  const fn = typeof hook === "function" ? hook : hook?.handler;
  fn?.call(undefined as never, { root } as unknown as ResolvedConfig);
}

function fakeCtx(): { ctx: ViteDevToolsNodeContext; registered: number } {
  const counter = { registered: 0 };
  const ui = {
    _stateKey: "preview-hub",
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

describe("previewHub", () => {
  it("exposes the plugin name", () => {
    expect(previewHub().name).toBe("vite-plugin-preview-hub");
  });

  it("registers the DevTools dock for the hub role by default", () => {
    const plugin = previewHub();
    applyConfigResolved(plugin, MISSING_DIR);

    const probe = fakeCtx();
    plugin.devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(1);
  });

  it("skips the DevTools dock when devtools is disabled", () => {
    const plugin = previewHub({ devtools: false });
    applyConfigResolved(plugin, MISSING_DIR);

    const probe = fakeCtx();
    plugin.devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(0);
  });

  it("skips the DevTools dock for the instance role", () => {
    const plugin = previewHub({ role: "instance" });
    applyConfigResolved(plugin, MISSING_DIR);

    const probe = fakeCtx();
    plugin.devtools?.setup(probe.ctx);

    expect(probe.registered).toBe(0);
  });
});
