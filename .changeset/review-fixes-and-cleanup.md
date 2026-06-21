---
"vite-plugin-dev-server-gateway": minor
---

Add a `--port-range` option to the `env` CLI command and fix several edge-case bugs surfaced by a full-package review.

- **`env --port-range <MIN-MAX>`**: the CLI now forwards the port range to `resolveInstance`, so a plugin configured with a non-default `portRange` no longer silently resolves a port the gateway's range gate rejects. It must match the plugin's `portRange`.
- **Gateway dispatch 502**: when a downstream instance dies mid-response, the gateway aborts the already-streamed response instead of appending the `Preview '<name>' is not running` text onto a partially-sent body (which produced a corrupted response).
- **`mountPath` validation**: `resolveOptions` now rejects `"/"` and non-absolute mount paths. `"/"` collapsed the dispatch prefix to an empty string, making every request look like a dispatch target.
- **Instance env port parsing**: `VITE_DEV_SERVER_GATEWAY_PORT` is parsed as a decimal-only integer, so values like `"1e3"`, `"0x10"`, or `" 53000 "` are rejected at the env boundary instead of coercing to a surprising port.
- **Preview name validation**: names must now be a clean slug — leading/trailing dashes and dash-only names (e.g. `-abc`, `--`) are rejected, where previously they were accepted and produced malformed URLs.
- **HMR WebSocket proxy**: a client-side socket error now tears down the client socket as well as the target, avoiding a leaked client connection.
