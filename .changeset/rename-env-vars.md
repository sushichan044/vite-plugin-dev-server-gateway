---
"vite-plugin-dev-server-gateway": minor
---

**BREAKING**: Rename the launch-flow env vars to a consistent `VITE_DEV_SERVER_GATEWAY_*` prefix and centralize them as a single source of truth.

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

- If you launch previews via the CLI (`eval "$(vite-plugin-dev-server-gateway env bash)" && vite`), no change is needed — the CLI emits the new names automatically.
- If you wrote a custom Node launch script that sets the env vars by hand, rename them to the `VITE_DEV_SERVER_GATEWAY_*` form.
- If a framework config (e.g. React Router's `basename`) read a raw env var like `process.env["PREVIEW_GATEWAY_BASE"]`, switch to the `instanceFromEnv()` API instead of referencing raw names:

  ```ts
  import { instanceFromEnv } from "vite-plugin-dev-server-gateway";

  const basename = instanceFromEnv()?.base ?? "/";
  ```

**BREAKING**: `ResolvedPreview.base` now carries exactly one trailing slash (e.g. `/preview/my-app/`), normalized once at the producer (`resolvePreview` / `instanceFromEnv`). Consumers use it verbatim. The `ensureTrailingSlash` helper is no longer exported — `base` is already in canonical form, so a config can use `instanceFromEnv()?.base ?? "/"` directly for a Vite `base` or a router `basename`.
