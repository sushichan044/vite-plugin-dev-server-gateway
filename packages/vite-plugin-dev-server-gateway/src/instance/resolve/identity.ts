import type { KeyStrategy } from "../types";
import { deriveName } from "./name";
import { resolveKey } from "./strategy";

/**
 * An instance's resolved identity: the URL slug, the optional git branch, and the stable key the
 * port is hashed from. Produced from a {@link KeyStrategy} by combining {@link resolveKey} and
 * {@link deriveName}.
 */
export interface ResolvedIdentity {
  /**
   * URL slug. The explicit `name` when given, otherwise the strategy label slugified.
   */
  name: string;
  /**
   * Stable value hashed into a port; carried for {@link resolveInstance}. Unused by callers that
   * already know their port (e.g. the gateway, which reads it from the bound socket).
   */
  key: string;
  /**
   * Git branch, when the strategy knows it.
   */
  branch?: string;
}

/**
 * Resolve an instance's identity without standing a server up or probing a port. The shared step
 * between {@link resolveInstance} (which adds a port and base) and the gateway (which labels itself
 * with the same derivation an instance uses). Throws {@link InvalidNameError} when the derived slug
 * is invalid, exactly as {@link deriveName} does.
 */
export function resolveIdentity(
  strategy: KeyStrategy,
  cwd: string,
  name?: string,
): ResolvedIdentity {
  const key = resolveKey(strategy, cwd);
  return { branch: key.branch, key: key.key, name: deriveName(name, key.label) };
}
