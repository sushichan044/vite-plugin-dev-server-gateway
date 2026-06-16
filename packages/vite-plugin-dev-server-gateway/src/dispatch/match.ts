/**
 * Extract the preview name from a request URL under the mount path, or null when the URL is not a
 * dispatch target (the index at the mount root, or an unrelated path).
 *
 * The instance serves under its own `base` (e.g. `/preview/<name>/`), so the matched URL is later
 * forwarded verbatim — this only needs to read the name to look up the port. See D5.
 */
export function matchPreviewName(url: string, mountPath: string): string | null {
  const prefix = mountPath.replace(/\/+$/, "");
  const pathname = url.split("?", 1)[0] ?? url;

  if (!pathname.startsWith(`${prefix}/`)) {
    return null;
  }

  const remainder = pathname.slice(prefix.length + 1);
  // `${prefix}/` with nothing after it is the index page, not a dispatch.
  if (remainder === "") {
    return null;
  }

  const slash = remainder.indexOf("/");
  const name = slash === -1 ? remainder : remainder.slice(0, slash);
  return name === "" ? null : name;
}

/**
 * True when the request URL targets the index page (`${mountPath}` or `${mountPath}/`).
 */
export function isIndexPath(url: string, mountPath: string): boolean {
  const prefix = mountPath.replace(/\/+$/, "");
  const pathname = url.split("?", 1)[0] ?? url;
  return pathname === prefix || pathname === `${prefix}/`;
}

/**
 * The port-range security gate: the gateway only ever proxies to ports inside this range (D5).
 */
export function isPortInRange(port: number, range: readonly [number, number]): boolean {
  return port >= range[0] && port <= range[1];
}
