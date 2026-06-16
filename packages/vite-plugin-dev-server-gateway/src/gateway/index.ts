/**
 * The gateway concern's public surface. The plugin reaches the gateway role — the registry, the
 * dispatch/index/control server, and the DevTools tab — through this barrel; the folder's internals
 * (dispatch, server handlers, registry storage) stay private.
 */
export { setupDevtools } from "./devtools";
export { Registry } from "./registry";
export { setupGateway } from "./setup";
export type { SetupGatewayOptions } from "./setup";
