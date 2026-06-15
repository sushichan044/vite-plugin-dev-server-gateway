import type { ChildProcess } from "node:child_process";
import { request } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import type { ServerHandle } from "./harness";
import { startHub, startInstance, stop } from "./harness";

let hub: ServerHandle;
let app1: ServerHandle;
let app2: ServerHandle;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function listNames(hubOrigin: string): Promise<string[]> {
  const response = await fetch(`${hubOrigin}/__preview-hub/list`);
  const entries = (await response.json()) as Array<{ name: string }>;
  return entries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
}

async function waitForNames(hubOrigin: string, names: string[], timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- polling loop
    const current = new Set(await listNames(hubOrigin));
    if (names.every((name) => current.has(name))) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for registrations: ${names.join(", ")}`);
    }
    // eslint-disable-next-line no-await-in-loop -- polling loop
    await delay(200);
  }
}

/** Resolve the HTTP status of a WebSocket upgrade attempt (101 means the upgrade was proxied). */
function upgradeStatus(origin: string, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, {
      headers: {
        Connection: "Upgrade",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
        "Sec-WebSocket-Protocol": "vite-hmr",
        "Sec-WebSocket-Version": "13",
        Upgrade: "websocket",
      },
    });
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve(res.statusCode ?? 101);
    });
    req.on("response", (res) => {
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

function waitExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.once("exit", () => {
      resolve();
    });
  });
}

describe("preview hub dispatch (e2e)", () => {
  beforeAll(async () => {
    hub = await startHub();
    app1 = await startInstance("app-1", hub.origin);
    app2 = await startInstance("app-2", hub.origin, app1.port + 1);
    await waitForNames(hub.origin, ["app-1", "app-2"]);
  });

  afterAll(() => {
    stop(app1);
    stop(app2);
    stop(hub);
  });

  it("lists both running previews on the index page", async () => {
    const html = await (await fetch(`${hub.origin}/preview/`)).text();
    expect(html).toContain("app-1");
    expect(html).toContain("app-2");
  });

  it("reports both previews on the control list endpoint", async () => {
    expect(await listNames(hub.origin)).toEqual(["app-1", "app-2"]);
  });

  it("dispatches HTTP to the matching instance", async () => {
    const first = await (await fetch(`${hub.origin}/preview/app-1/`)).text();
    expect(first).toContain("Preview: app-1");

    const second = await (await fetch(`${hub.origin}/preview/app-2/`)).text();
    expect(second).toContain("Preview: app-2");
  });

  it("proxies the HMR websocket upgrade to the instance", async () => {
    expect(await upgradeStatus(hub.origin, "/preview/app-1/")).toBe(101);
  });

  it("evicts an instance that has gone away and returns a readable 502", async () => {
    stop(app1, "SIGKILL");
    await waitExit(app1.child);

    const response = await fetch(`${hub.origin}/preview/app-1/`);
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("Preview 'app-1' is not running");

    // The failed dispatch evicts the entry immediately, so the list drops it.
    await waitForNames(hub.origin, []);
    expect(await listNames(hub.origin)).toEqual(["app-2"]);
  });
});
