# vite-plugin-dev-server-gateway

> Run many Vite dev servers at once, behind one origin, with a live index of every preview.

When you run several dev servers side by side — multiple apps in a monorepo, or the same app
checked out into several git worktrees — you normally juggle a handful of `localhost` ports and
guess which is which. This plugin puts all of them behind a single origin (`/preview/my-app/`,
`/preview/other-app/`, …) and gives you one page that lists every running preview.

Requires Vite `^7 || ^8` and Node `>=22.12`.

## Getting Started

Install:

```bash
npm install -D vite-plugin-dev-server-gateway
# or: pnpm add -D vite-plugin-dev-server-gateway
```

Add the plugin to every app's `vite.config.ts`.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { devServerGateway, instanceFromEnv } from "vite-plugin-dev-server-gateway";

export default defineConfig({
  plugins: [devServerGateway({ instance: instanceFromEnv() })],
});
```

`instanceFromEnv()` reads the standard env our CLI exports. To use your own env var names.

Add an instance launch script to `package.json`. The CLI resolves the preview's identity into the
environment _before_ Vite boots, so every config file Vite evaluates can see it:

```jsonc
{
  "scripts": {
    "dev:instance": "eval \"$(vite-plugin-dev-server-gateway env bash)\" && vite",
  },
}
```

Now run the gateway once with a plain `vite`, start each preview with `pnpm dev:instance`, and open
the gateway's origin at `/preview`. The page lists every running preview — name, git branch, port,
and an "open in new tab" link — and updates over Server-Sent Events as servers come and go.

The single `devServerGateway()` plugin plays one of two roles, decided by the `instance` option:
pass it to run as a preview _instance_ (the plugin wires `base`/`server.port` and registers with the
gateway); omit it to run the _gateway_.

## Usage

### Launching previews

The CLI prints shell statements that set the preview env; it does not spawn the dev command, so you
`eval`/`source` it and then run your dev server. This works for any framework dev server — swap
`vite` for `react-router dev`, etc.

```bash
# bash / zsh
eval "$(vite-plugin-dev-server-gateway env bash)" && vite

# fish
vite-plugin-dev-server-gateway env fish | source; and vite

# PowerShell (also for Git Bash, use the bash output instead)
vite-plugin-dev-server-gateway env powershell | Invoke-Expression; vite
```

`env <shell>` emits `VITE_DEV_SERVER_GATEWAY_NAME`, `VITE_DEV_SERVER_GATEWAY_BASE`,
`VITE_DEV_SERVER_GATEWAY_PORT`, plus `VITE_DEV_SERVER_GATEWAY_BRANCH` when the branch is known and
`VITE_DEV_SERVER_GATEWAY_ORIGIN` when `--gateway-origin` is passed. Each value is quoted with the
shell's own escaping. Flags:

| Flag               | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `--name`           | Explicit URL slug (default: the key strategy label).                   |
| `--key-strategy`   | `rootDir` or `gitBranch` (default: `rootDir`).                         |
| `--mount-path`     | Mount path; must match the plugin's `mountPath` (default: `/preview`). |
| `--cwd`            | Directory to resolve against (default: current directory).             |
| `--gateway-origin` | Gateway origin to export as `VITE_DEV_SERVER_GATEWAY_ORIGIN`.          |

If you prefer a Node launch script that resolves and spawns in one process, call `resolveInstance()`
directly instead of the CLI. It returns an `Instance`; export it so `instanceFromEnv()` reads
it back:

```js
// launch.mjs
import { spawn } from "node:child_process";
import { resolveInstance } from "vite-plugin-dev-server-gateway";

const resolved = await resolveInstance();
const env = {
  ...process.env,
  VITE_DEV_SERVER_GATEWAY_NAME: resolved.name,
  VITE_DEV_SERVER_GATEWAY_BASE: resolved.base,
  VITE_DEV_SERVER_GATEWAY_PORT: String(resolved.port),
  ...(resolved.diagnostics?.branch
    ? { VITE_DEV_SERVER_GATEWAY_BRANCH: resolved.diagnostics.branch }
    : {}),
};
spawn("pnpm", ["exec", "vite"], { env, stdio: "inherit" }).on("exit", (code) =>
  process.exit(code ?? 0),
);
```

### Key strategies

A _key strategy_ derives a deterministic name and port for each preview, so the same checkout keeps
the same address across restarts. Ports are derived from the key but probed for availability, so
previews never fight over a port.

- `"rootDir"` (default) — one preview per project directory; no git required.
- `"gitBranch"` — one preview per branch; great with worktrees.

### Plugin options

See `DevServerGatewayOptions` in `src/plugin/options.ts`.

## How it works

```
browser
  │
  ▼  one origin
gateway  (one Vite dev server)
  ├─ GET /preview           → live index of every running preview
  ├─ GET /preview/app-a/    → reverse-proxy to the "app-a" instance
  └─ GET /preview/app-b/    → reverse-proxy to the "app-b" instance

instances self-register over POST /__dev-server-gateway and heartbeat:
  • app-a  — its own Vite dev server on :53001
  • app-b  — its own Vite dev server on :53002
```

Instances `POST` to the gateway's control endpoints (under `/__dev-server-gateway`) to register and
heartbeat, and `DELETE` to deregister on shutdown. The gateway keeps an in-memory registry, evicts
entries that stop heartbeating, and uses it to render the index, drive the SSE stream and DevTools
tab, and route incoming requests.

This means **no startup ordering**: if the gateway isn't up yet, the next heartbeat retries; start,
kill, and restart the gateway and previews freely, and the index reflects reality within a few
seconds. For safety, the gateway only dispatches to ports inside `portRange`, so a stray
registration can't make it proxy to an arbitrary port.

## License

MIT
