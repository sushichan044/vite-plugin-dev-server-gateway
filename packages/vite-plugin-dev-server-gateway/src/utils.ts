export function ensureTrailingSlash(raw: string | undefined): string {
  // Collapse any run of trailing slashes to exactly one (not just guarantee "at least one"): callers
  // rely on this as the single canonical `base` form, and a hand-written launch script can feed in
  // values like "/preview/app//" through the env boundary.
  return raw ? raw.replace(/\/*$/, "/") : "/";
}
