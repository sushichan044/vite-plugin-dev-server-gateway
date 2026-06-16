/**
 * The instance concern's public surface. Everything another concern needs about an instance — its
 * identity type, how to derive it, how it round-trips through the environment, and how it wires
 * itself onto a dev server — is reached through this barrel; the folder's internals stay private.
 */
export { buildInstanceEnv, GATEWAY_ORIGIN_ENV, instanceFromEnv } from "./env";
export type { InstanceEnvInput } from "./env";
export { resolveIdentity } from "./resolve/identity";
export { resolveInstance } from "./resolve/resolve";
export { setupInstance } from "./setup";
export type { SetupInstanceOptions } from "./setup";
export type {
  Instance,
  InstanceDiagnostics,
  InstanceKey,
  KeyStrategy,
  ResolveInstanceOptions,
} from "./types";
