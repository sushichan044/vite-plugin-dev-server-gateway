export function ensureTrailingSlash(raw: string | undefined): string {
  // Collapse any run of trailing slashes to exactly one (not just guarantee "at least one"): callers
  // rely on this as the single canonical `base` form, and a hand-written launch script can feed in
  // values like "/preview/app//" through the env boundary.
  return raw ? raw.replace(/\/*$/, "/") : "/";
}

/**
 * Whether `value` is a canonical `base` (D4): an absolute, path-only string with exactly one
 * trailing slash. The index page renders `base` into `href`s verbatim, so any ingress that accepts
 * a `base` from outside this module's producers must reject non-path values (`javascript:…`,
 * protocol-relative `//host`) and query/fragment-carrying paths before they become clickable
 * links.
 */
export function isCanonicalBase(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    value.endsWith("/") &&
    !value.endsWith("//") &&
    !/[?#]/.test(value)
  );
}
