export function ensureTrailingSlash(raw: string | undefined): string {
  return raw ? raw.replace(/\/?$/, "/") : "/";
}
