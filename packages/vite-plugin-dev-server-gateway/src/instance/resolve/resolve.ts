import { DEFAULT_MOUNT_PATH, DEFAULT_PORT_RANGE } from "../../constants";
import { ensureTrailingSlash } from "../../utils";
import type { Instance, ResolveInstanceOptions } from "../types";
import { resolveIdentity } from "./identity";
import { probeFreePort, stablePort } from "./port";

/**
 * Resolve a preview's identity, port, and base path.
 *
 * Called by the user's launch script (not the plugin) so its outputs are visible to every config
 * file Vite evaluates independently (D3). The script exports `base`/`port` to the environment and
 * spawns the dev command. Resolution runs before Vite boots; there is no second re-computation, so
 * the gateway and instance cannot desync.
 */
export async function resolveInstance(options: ResolveInstanceOptions = {}): Promise<Instance> {
  const cwd = options.cwd ?? process.cwd();
  const mountPath = options.mountPath ?? DEFAULT_MOUNT_PATH;
  const portRange = options.portRange ?? DEFAULT_PORT_RANGE;
  const strategy = options.keyStrategy ?? "rootDir";

  const identity = resolveIdentity(strategy, cwd, options.name);

  const preferred = stablePort(identity.key, portRange);
  const port = await probeFreePort(preferred, portRange);

  // base carries exactly one trailing slash, normalized here at the single producer so every
  // consumer (Vite `base`, a framework router's basename, the index links) uses it verbatim (D4).
  const base = `${ensureTrailingSlash(mountPath)}${identity.name}/`;

  return {
    base,
    name: identity.name,
    port,
    ...(identity.branch === undefined ? {} : { diagnostics: { branch: identity.branch } }),
  };
}
