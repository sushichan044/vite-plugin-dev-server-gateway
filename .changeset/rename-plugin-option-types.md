---
"vite-plugin-dev-server-gateway": minor
---

**BREAKING**: Rename the plugin's public option surface for consistency.

- The options type is now `DevServerGatewayPluginOptions` (still re-exported as `DevServerGatewayOptions` from the package root for compatibility).
- The `devtools` option is renamed to `devTools` (camelCase) to match the rest of the option names. There is no alias — update `devServerGateway({ devtools: ... })` to `devServerGateway({ devTools: ... })`.
- The resolver and its result type are renamed (`resolveOptions` → `resolvePluginOptions`, `ResolvedGatewayOptions` → `ResolvedDevServerGatewayPluginOptions`); these are internal and do not affect typical usage.
