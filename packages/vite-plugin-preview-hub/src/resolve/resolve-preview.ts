import { DEFAULT_MOUNT_PATH, DEFAULT_PORT_RANGE } from "../constants";
import type { ResolvedPreview, ResolvePreviewOptions } from "../types";
import { resolveKey } from "./key-strategy";
import { deriveName } from "./name";
import { probeFreePort, stablePort } from "./port";

/**
 * Resolve a preview's identity, port, and base path.
 *
 * Called by the user's launch script (not the plugin) so its outputs are visible to every config
 * file Vite evaluates independently (D3). The script exports `base`/`port` to the environment and
 * spawns the dev command. Resolution runs before Vite boots; there is no second re-computation, so
 * the hub and instance cannot desync.
 */
export async function resolvePreview(
  options: ResolvePreviewOptions = {},
): Promise<ResolvedPreview> {
  const cwd = options.cwd ?? process.cwd();
  const mountPath = options.mountPath ?? DEFAULT_MOUNT_PATH;
  const portRange = options.portRange ?? DEFAULT_PORT_RANGE;
  const strategy = options.keyStrategy ?? "rootDir";

  const resolved = await resolveKey(strategy, cwd);
  const name = deriveName(options.name, resolved.label);

  const preferred = stablePort(resolved.key, portRange);
  const port = await probeFreePort(preferred, portRange);

  // Stored base is slash-free (D4); consumers normalize to exactly one trailing slash.
  const base = `${mountPath.replace(/\/+$/, "")}/${name}`;

  return { base, branch: resolved.branch, name, port };
}
