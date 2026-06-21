# vite-plugin-dev-server-gateway

## 0.1.0
### Minor Changes



- [#8](https://github.com/sushichan044/vite-plugin-dev-server-gateway/pull/8) [`300e76d`](https://github.com/sushichan044/vite-plugin-dev-server-gateway/commit/300e76d141221d37fa478a8e61aaa5404402f31f) Thanks [@sushichan044](https://github.com/sushichan044)! - **BREAKING**: Unify the "preview" vocabulary on "instance" and reorganize the source tree by concern.
  
  The codebase used two names — `preview` and `instance` — for the same thing (`ResolvedPreview` was produced for the plugin's `instance` option, read back by `instanceFromEnv`), and the code for a single concern was spread across many directories. The public API is now consistent and each concern owns its own folder, reached only through a high-level barrel.
  
  Renamed public API (no backward-compatible aliases):
  
  | Old                     | New                      |
  | ----------------------- | ------------------------ |
  | `resolvePreview`        | `resolveInstance`        |
  | `ResolvedPreview`       | `Instance`               |
  | `PreviewDiagnostics`    | `InstanceDiagnostics`    |
  | `PreviewKey`            | `InstanceKey`            |
  | `ResolvePreviewOptions` | `ResolveInstanceOptions` |
  
  `instanceFromEnv`, `devServerGateway`, `DevServerGatewayOptions`, and `KeyStrategy` are unchanged. The exported env var names (`VITE_DEV_SERVER_GATEWAY_*`), the default mount path (`/preview`), and all runtime behavior are unchanged.
  
  Migration: rename the imported symbols above. For example:
  
  ```ts
  // before
  import { resolvePreview, type ResolvedPreview } from "vite-plugin-dev-server-gateway";
  const preview: ResolvedPreview = await resolvePreview();
  
  // after
  import { resolveInstance, type Instance } from "vite-plugin-dev-server-gateway";
  const instance: Instance = await resolveInstance();
  ```


- [#6](https://github.com/sushichan044/vite-plugin-dev-server-gateway/pull/6) [`b4e5f67`](https://github.com/sushichan044/vite-plugin-dev-server-gateway/commit/b4e5f67888c716aafd26b83585098883b7c98bc6) Thanks [@sushichan044](https://github.com/sushichan044)! - **BREAKING**: Rename the launch-flow env vars to a consistent `VITE_DEV_SERVER_GATEWAY_*` prefix and centralize them as a single source of truth.
  
  The env var names the CLI exports and the plugin reads were inconsistent (`PREVIEW_NAME` lacked the `GATEWAY` prefix the rest shared) and duplicated across the parse and serialize paths. They are now defined once and renamed:
  
  | Old                      | New                              |
  | ------------------------ | -------------------------------- |
  | `PREVIEW_NAME`           | `VITE_DEV_SERVER_GATEWAY_NAME`   |
  | `PREVIEW_GATEWAY_BASE`   | `VITE_DEV_SERVER_GATEWAY_BASE`   |
  | `PREVIEW_GATEWAY_PORT`   | `VITE_DEV_SERVER_GATEWAY_PORT`   |
  | `PREVIEW_GATEWAY_BRANCH` | `VITE_DEV_SERVER_GATEWAY_BRANCH` |
  | `PREVIEW_GATEWAY_ORIGIN` | `VITE_DEV_SERVER_GATEWAY_ORIGIN` |
  
  There is no backward-compatible alias — the old names are removed.
  
  Migration:
  
  - When launching previews via the CLI (`eval "$(vite-plugin-dev-server-gateway env bash)" && vite`), no change is needed — the CLI emits the new names automatically.
  - If you wrote a custom Node launch script that sets the env vars by hand, rename them to the `VITE_DEV_SERVER_GATEWAY_*` form.
  - For framework configs (e.g. React Router's `basename`) that read a raw env var like `process.env["PREVIEW_GATEWAY_BASE"]`, switch to the `instanceFromEnv()` API instead of referencing raw names:
  
    ```ts
    import { instanceFromEnv } from "vite-plugin-dev-server-gateway";
  
    const basename = instanceFromEnv()?.base ?? "/";
    ```
  
  **BREAKING**: `ResolvedPreview.base` now carries exactly one trailing slash (e.g. `/preview/my-app/`), normalized once at the producer (`resolvePreview` / `instanceFromEnv`). Consumers use it verbatim. The `ensureTrailingSlash` helper is no longer exported — `base` is already in canonical form, so a config can use `instanceFromEnv()?.base ?? "/"` directly for a Vite `base` or a router `basename`.


- [#16](https://github.com/sushichan044/vite-plugin-dev-server-gateway/pull/16) [`fedc9df`](https://github.com/sushichan044/vite-plugin-dev-server-gateway/commit/fedc9df659d7a49cbf245ca73609fb8b3747af37) Thanks [@sushichan044](https://github.com/sushichan044)! - Add a `--port-range` option to the `env` CLI command and fix several edge-case bugs surfaced by a full-package review.
  
  - **`env --port-range <MIN-MAX>`**: the CLI now forwards the port range to `resolveInstance`, so a plugin configured with a non-default `portRange` no longer silently resolves a port the gateway's range gate rejects. It must match the plugin's `portRange`.
  - **Gateway dispatch 502**: when a downstream instance dies mid-response, the gateway aborts the already-streamed response instead of appending the `Preview '<name>' is not running` text onto a partially-sent body (which produced a corrupted response).
  - **`mountPath` validation**: `resolveOptions` now rejects `"/"` and non-absolute mount paths. `"/"` collapsed the dispatch prefix to an empty string, making every request look like a dispatch target.
  - **Instance env port parsing**: `VITE_DEV_SERVER_GATEWAY_PORT` is parsed as a decimal-only integer, so values like `"1e3"`, `"0x10"`, or `" 53000 "` are rejected at the env boundary instead of coercing to a surprising port.
  - **Preview name validation**: names must now be a clean slug — leading/trailing dashes and dash-only names (e.g. `-abc`, `--`) are rejected, where previously they were accepted and produced malformed URLs.
  - **HMR WebSocket proxy**: a client-side socket error now tears down the client socket as well as the target, avoiding a leaked client connection.

### Patch Changes



- [#15](https://github.com/sushichan044/vite-plugin-dev-server-gateway/pull/15) [`626fc66`](https://github.com/sushichan044/vite-plugin-dev-server-gateway/commit/626fc669b2bf007eb373271ab2ede0e7abd44dec) Thanks [@sushichan044](https://github.com/sushichan044)! - Fix the gateway behind HTTPS dev environments.
  
  - **SSE events behind a reverse proxy**: the registry SSE stream (`/__dev-server-gateway/events`, used by the DevTools panel and the index page) now sends `X-Accel-Buffering: no` and flushes its headers. A common HTTPS setup terminates TLS in a reverse proxy in front of a plain-HTTP dev server; without this the proxy buffers the long-lived stream and never forwards a frame, so the DevTools panel's `EventSource` hangs and is cancelled after a timeout while `/config` (a short response) still works.
  - **Instance proxying over HTTP/2**: when Vite itself serves HTTPS it runs over HTTP/2. The gateway now strips HTTP/2 pseudo-headers (`:authority`, `:path`, …) and hop-by-hop headers when forwarding a request to an instance, and strips hop-by-hop headers (e.g. `transfer-encoding`) from the instance response before writing it back. Previously these tripped `ERR_INVALID_HTTP_TOKEN` / `ERR_HTTP2_INVALID_CONNECTION_HEADERS` and broke instance dispatch under HTTP/2.

## 0.0.2
### Patch Changes



- [`3f7cdd4`](https://github.com/sushichan044/vite-plugin-dev-server-gateway/commit/3f7cdd45551a6850a1c5f5f449785e4bdc489286) Thanks [@sushichan044](https://github.com/sushichan044)! - First release
