---
"vite-plugin-dev-server-gateway": minor
---

**BREAKING**: Unify the "preview" vocabulary on "instance" and reorganize the source tree by concern.

The codebase used two names — `preview` and `instance` — for the same thing (`ResolvedPreview` was produced for the plugin's `instance` option, read back by `instanceFromEnv`), and the code for a single concern was spread across many directories. The public API is now consistent and each concern owns its own folder, reached only through a high-level barrel.

Renamed public API (no backward-compatible aliases):

| Old                     | New                     |
| ----------------------- | ----------------------- |
| `resolvePreview`        | `resolveInstance`       |
| `ResolvedPreview`       | `Instance`              |
| `PreviewDiagnostics`    | `InstanceDiagnostics`   |
| `PreviewKey`            | `InstanceKey`           |
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
