import type { ViteDevToolsNodeContext } from "@vitejs/devtools-kit";
import { describe, expect, it } from "vite-plus/test";

import { setupDevtools } from "./devtools";

interface RegisteredDock {
  type: string;
  id: string;
  renderer?: { importFrom: string; importName: string };
}

function fakeCtx(): { ctx: ViteDevToolsNodeContext; registered: RegisteredDock[] } {
  const registered: RegisteredDock[] = [];
  const ctx = {
    docks: {
      register: (entry: RegisteredDock) => {
        registered.push(entry);
        return { update: () => undefined };
      },
    },
  };
  return { ctx: ctx as unknown as ViteDevToolsNodeContext, registered };
}

describe("setupDevtools", () => {
  it("registers a custom-render dock backed by the client script", () => {
    const { ctx, registered } = fakeCtx();
    setupDevtools(ctx);

    expect(registered).toHaveLength(1);
    expect(registered[0]?.type).toBe("custom-render");
    expect(registered[0]?.renderer).toEqual({
      importFrom: "vite-plugin-dev-server-gateway/devtools-client",
      importName: "default",
    });
  });
});
