import { describe, expect, it, vi } from "vite-plus/test";

import { Registry } from "./registry";
import type { RegisterPayload } from "./types";

function payload(overrides: Partial<RegisterPayload> = {}): RegisterPayload {
  return { base: "/preview/app", name: "app", port: 53001, ...overrides };
}

describe("Registry", () => {
  it("upsert creates an entry with registeredAt and lastSeen", () => {
    const registry = new Registry({ now: () => 1000 });
    const entry = registry.upsert(payload());

    expect(entry.registeredAt).toBe(1000);
    expect(entry.lastSeen).toBe(1000);
    expect(registry.get("app")).toEqual(entry);
  });

  it("a heartbeat bumps lastSeen but keeps registeredAt", () => {
    let now = 1000;
    const registry = new Registry({ now: () => now });
    registry.upsert(payload());

    now = 6000;
    const entry = registry.upsert(payload());

    expect(entry.registeredAt).toBe(1000);
    expect(entry.lastSeen).toBe(6000);
  });

  it("list returns entries sorted by name", () => {
    const registry = new Registry();
    registry.upsert(payload({ base: "/preview/beta", name: "beta", port: 53002 }));
    registry.upsert(payload({ base: "/preview/alpha", name: "alpha", port: 53001 }));

    expect(registry.list().map((entry) => entry.name)).toEqual(["alpha", "beta"]);
  });

  it("remove deletes an entry and reports whether it existed", () => {
    const registry = new Registry();
    registry.upsert(payload());

    expect(registry.remove("app")).toBe(true);
    expect(registry.remove("app")).toBe(false);
    expect(registry.get("app")).toBeUndefined();
  });

  it("evictStale removes entries older than the window and returns their names", () => {
    let now = 1000;
    const registry = new Registry({ now: () => now });
    registry.upsert(payload({ base: "/preview/old", name: "old", port: 53001 }));

    now = 5000;
    registry.upsert(payload({ base: "/preview/fresh", name: "fresh", port: 53002 }));

    now = 10_000;
    // staleMs = 15000 -> cutoff 0; nothing stale yet
    expect(registry.evictStale(15_000)).toEqual([]);

    now = 17_000;
    // cutoff 2000: "old" (lastSeen 1000) is stale, "fresh" (5000) is not
    expect(registry.evictStale(15_000)).toEqual(["old"]);
    expect(registry.get("fresh")).toBeDefined();
  });

  it("notifies subscribers on a new registration", () => {
    const registry = new Registry();
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.upsert(payload());

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith([expect.objectContaining({ name: "app" })]);
  });

  it("notifies on every upsert, heartbeats included", () => {
    const registry = new Registry();
    registry.upsert(payload());
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.upsert(payload());
    registry.upsert(payload());

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies on removal and stops after unsubscribe", () => {
    const registry = new Registry();
    registry.upsert(payload());
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.remove("app");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    registry.upsert(payload());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
