export function ensureTrailingSlash(raw: string | undefined): string {
  return raw ? raw.replace(/\/?$/, "/") : "/";
}

export function removeTrailingSlash(raw: string | undefined): string {
  return raw?.replace(/\/+$/, "") || "/";
}
