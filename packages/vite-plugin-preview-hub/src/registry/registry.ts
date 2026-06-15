import type { RegisterPayload, RegistryEntry } from "./types";

/** Notified with the current entry list whenever the registry changes structurally. */
export type RegistryListener = (entries: RegistryEntry[]) => void;

export interface PreviewRegistryOptions {
  /** Clock injection for tests. @default Date.now */
  now?: () => number;
}

/**
 * The hub's single source of truth: an in-memory map of running previews (D2, D6).
 *
 * In-memory and not a file because separate processes share no memory and a file would litter,
 * race, and outlive a reboot. Memory is empty exactly when nothing is running.
 *
 * Listeners fire on every mutation — registration, heartbeat, and eviction — so subscribers (the
 * SSE stream behind the index page and DevTools tab) refresh on registry updates alone, with no
 * client-side polling.
 */
export class PreviewRegistry {
  readonly #entries = new Map<string, RegistryEntry>();
  readonly #listeners = new Set<RegistryListener>();
  readonly #now: () => number;

  constructor(options: PreviewRegistryOptions = {}) {
    this.#now = options.now ?? Date.now;
  }

  /** Insert or refresh an entry. New registrations keep `registeredAt`; heartbeats bump `lastSeen`. */
  upsert(payload: RegisterPayload): RegistryEntry {
    const timestamp = this.#now();
    const existing = this.#entries.get(payload.name);

    const entry: RegistryEntry = {
      base: payload.base,
      branch: payload.branch,
      lastSeen: timestamp,
      name: payload.name,
      port: payload.port,
      registeredAt: existing?.registeredAt ?? timestamp,
    };
    this.#entries.set(payload.name, entry);

    // Emit on every upsert, heartbeats included: subscribers (the SSE stream feeding the index page
    // and DevTools tab) treat each registration as the signal to refresh, so uptime advances at the
    // heartbeat cadence without any client-side polling.
    this.#emit();
    return entry;
  }

  get(name: string): RegistryEntry | undefined {
    return this.#entries.get(name);
  }

  /** All entries, sorted by name for stable rendering. */
  list(): RegistryEntry[] {
    return [...this.#entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get size(): number {
    return this.#entries.size;
  }

  /** Remove one entry (e.g. graceful deregister or dispatch connect failure). */
  remove(name: string): boolean {
    const removed = this.#entries.delete(name);
    if (removed) {
      this.#emit();
    }
    return removed;
  }

  /** Remove entries whose last heartbeat is older than `staleMs`. Returns the evicted names. */
  evictStale(staleMs: number): string[] {
    const cutoff = this.#now() - staleMs;
    const evicted: string[] = [];
    for (const entry of this.#entries.values()) {
      if (entry.lastSeen < cutoff) {
        this.#entries.delete(entry.name);
        evicted.push(entry.name);
      }
    }
    if (evicted.length > 0) {
      this.#emit();
    }
    return evicted;
  }

  /** Subscribe to structural changes. Returns an unsubscribe function. */
  subscribe(listener: RegistryListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #emit(): void {
    const entries = this.list();
    for (const listener of this.#listeners) {
      listener(entries);
    }
  }
}
