/**
 * Normalize a mount base path to Vite's canonical form: exactly one trailing slash.
 *
 * WHY: Vite's `base` and a framework router's `basename` both expect `/foo/`. Applying the same
 * total transform at every consumption site (`.replace(/\/?$/, "/")`) means no consumer can inherit
 * a malformed value, and the explicit `/` fallback for the unset (hub) case stays visible. See
 * design D4.
 */
export function normalizeBase(raw: string | undefined): string {
  return raw ? raw.replace(/\/?$/, "/") : "/";
}
