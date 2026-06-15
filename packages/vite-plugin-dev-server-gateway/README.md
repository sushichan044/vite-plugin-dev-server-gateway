# vite-plugin-dev-server-gateway

> Fan out to many running Vite dev servers behind one origin, with a live index of every preview.

When you run several Vite dev servers at once — multiple apps in a monorepo, the same app checked
out into several git worktrees, one server per branch — you normally end up juggling a handful of
`localhost:51xx` ports and guessing which one is which. This plugin puts all of them behind a single
origin and gives you one place to see and open every running preview.

## What this plugin can do

- **Serve many dev servers behind one origin.** Each running server registers itself with a central
  _gateway_, which reverse-proxies requests to the right one by name: `/preview/my-app/` reaches one
  server, `/preview/other-app/` reaches another — all on the gateway's single port.

- **Proxy HMR, not just pages.** Dispatch covers the WebSocket upgrade too, so Hot Module
  Replacement keeps working for every preview reached through the gateway.

- **Show a live index of every preview.** Visit the gateway's mount path (`/preview` by default) for a
  self-contained HTML page listing every running preview — name, git branch, port, and an "open in
  new tab" link. The list updates over Server-Sent Events as servers come and go; no reload, no
  polling. The gateway itself is shown in its own "Gateway" section, separate from the "Previews"
  instances — it is tracked apart from the registry, so it always appears and never collides with a
  preview of the same name.

- **Add a Vite DevTools tab.** When [Vite DevTools](https://github.com/vitejs/devtools) is present,
  the gateway registers a tab showing the same live registry (with the same "Gateway" / "Previews" split),
  so the preview list lives right next to your other dev tooling.

- **Wire up launch scripts from any shell.** A `vite-plugin-dev-server-gateway env <shell>` CLI
  resolves a preview's identity and prints the matching environment for `bash`, `zsh`, `fish`, or
  `powershell`, so you can `eval`/`source` it from a launch script without writing a Node wrapper.

- **Need no startup ordering.** Previews self-register and heartbeat on a timer; if the gateway isn't up
  yet, the next heartbeat retries. The gateway evicts entries that stop heart­beating. Start the gateway and
  previews in any order, kill and restart them freely — the index reflects reality within a few
  seconds.

- **Give each preview a stable, collision-free URL and port.** A _key strategy_ derives a
  deterministic name and port for each preview, so the same checkout keeps the same address across
  restarts. Built-in strategies:
  - `"rootDir"` (default) — one preview per project directory; no git required.
  - `"gitBranch"` — one preview per branch; great with worktrees.
  - a custom function — full control over the name/port key.

  Ports are derived from the key but probed for availability, so previews never fight over a port.

- **Configure itself.** The single `devServerGateway()` plugin plays one of two roles — _gateway_ or
  _instance_ — and resolves which automatically: it acts as an instance when a launch script has
  exported preview env vars or when it's running inside a linked git worktree, and as the gateway
  otherwise. You can always pin the role explicitly.

- **Stay bounded for safety.** The gateway only dispatches to ports inside a configured range
  (`[53000, 53999]` by default), so a stray registration can't make it proxy to an arbitrary port.

## Install

```bash
npm install -D vite-plugin-dev-server-gateway
# or: pnpm add -D vite-plugin-dev-server-gateway
```

Requires Vite `^7 || ^8` and Node `>=22.12`.

## Usage

### 1. Add the plugin to every app

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { devServerGateway } from "vite-plugin-dev-server-gateway";

// The launch script exports the preview's base path; thread it into Vite's `base`.
// Unset (i.e. the gateway) falls back to "/".
const base = process.env.PREVIEW_GATEWAY_BASE
  ? process.env.PREVIEW_GATEWAY_BASE.replace(/\/?$/, "/")
  : "/";

const port = process.env.PREVIEW_GATEWAY_PORT;

export default defineConfig({
  base,
  plugins: [devServerGateway()],
  server: {
    port: port ? Number(port) : undefined,
    strictPort: Boolean(port),
  },
});
```

### 2. Launch previews with the CLI

The plugin deliberately keeps preview resolution out of itself: the resolved identity must be in the
environment _before_ Vite boots, so every config file Vite evaluates can see it. The
`vite-plugin-dev-server-gateway env <shell>` CLI resolves that identity and prints the env as
statements for your shell, ready to `eval`/`source`:

```bash
# bash / zsh
eval "$(vite-plugin-dev-server-gateway env bash)" && vite

# fish
vite-plugin-dev-server-gateway env fish | source; and vite

# PowerShell
vite-plugin-dev-server-gateway env powershell | Invoke-Expression; vite
```

A typical `package.json` script for a preview instance:

```jsonc
{
  "scripts": {
    "dev:instance": "eval \"$(vite-plugin-dev-server-gateway env bash)\" && vite",
  },
}
```

Run the gateway once (a plain `vite`), and each preview via its instance script. Then open the gateway's
origin at `/preview` to see them all. This works the same for framework dev servers — swap `vite`
for `react-router dev`, etc.

> **Windows:** the `bash`/`zsh` output targets POSIX shells, including Git Bash. From native
> PowerShell, pipe `env powershell` to `Invoke-Expression`. The `fish` output is sourced with
> `| source`.

The CLI prints env; it does not spawn the dev command. If you prefer a Node launch script that
resolves and spawns in one process, call `resolvePreview()` directly:

```js
// launch.mjs
import { spawn } from "node:child_process";
import { resolvePreview } from "vite-plugin-dev-server-gateway";

const resolved = await resolvePreview();

const env = {
  ...process.env,
  PREVIEW_NAME: resolved.name,
  PREVIEW_GATEWAY_BASE: resolved.base,
  PREVIEW_GATEWAY_PORT: String(resolved.port),
  ...(resolved.branch ? { PREVIEW_GATEWAY_BRANCH: resolved.branch } : {}),
};

spawn("pnpm", ["exec", "vite"], { env, stdio: "inherit" }).on("exit", (code) =>
  process.exit(code ?? 0),
);
```

## API

### `devServerGateway(options?)`

The Vite plugin. All options are optional.

| Option          | Default                                                   | Description                                                               |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `role`          | `"auto"`                                                  | `"gateway"`, `"instance"`, or `"auto"` (heuristic; explicit always wins). |
| `mountPath`     | `"/preview"`                                              | Mount path for the index and dispatch. Must match resolve-time value.     |
| `portRange`     | `[53000, 53999]`                                          | Inclusive `[min, max]`; bounds the dispatch port check.                   |
| `gatewayOrigin` | `PREVIEW_GATEWAY_ORIGIN` env, else the Vite server origin | Where instances register.                                                 |
| `heartbeatMs`   | `5000`                                                    | Heartbeat interval.                                                       |
| `staleMs`       | `15000`                                                   | Eviction window — a couple of missed beats.                               |
| `devtools`      | `true`                                                    | Register the Vite DevTools tab on the gateway.                            |

### `resolvePreview(options?)`

Resolves a preview's identity for the launch script. Returns `{ name, port, base, branch }`.

| Option        | Default          | Description                                                       |
| ------------- | ---------------- | ----------------------------------------------------------------- |
| `keyStrategy` | `"rootDir"`      | `"rootDir"`, `"gitBranch"`, or a `(cwd) => PreviewKey \| string`. |
| `name`        | strategy label   | Explicit URL slug. Must match `/^[a-z0-9-]+$/i`.                  |
| `mountPath`   | `"/preview"`     | Must match the plugin's `mountPath`.                              |
| `portRange`   | `[53000, 53999]` | Inclusive `[min, max]` to pick a stable, free port from.          |
| `cwd`         | `process.cwd()`  | Directory the strategy resolves against.                          |

### CLI

`vite-plugin-dev-server-gateway env <bash|zsh|fish|powershell>` resolves a preview and prints
`export` / `set -gx` / `$env:` statements for that shell. Each value is quoted with the shell's own
escaping, so the output is safe to `eval` (bash/zsh), `source` (fish), or pipe to
`Invoke-Expression` (PowerShell).

It emits `PREVIEW_NAME`, `PREVIEW_GATEWAY_BASE`, and `PREVIEW_GATEWAY_PORT`, plus `PREVIEW_GATEWAY_BRANCH` when
the branch is known and `PREVIEW_GATEWAY_ORIGIN` when `--gateway-origin` is passed. Flags map to
`resolvePreview` options:

| Flag               | Description                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| `--name`           | Explicit URL slug (default: the key strategy label).                             |
| `--mount-path`     | Mount path; must match the plugin's (default: `/preview`).                       |
| `--key-strategy`   | `rootDir` or `gitBranch` (default: `rootDir`).                                   |
| `--cwd`            | Directory to resolve against (default: current directory).                       |
| `--gateway-origin` | Gateway origin to export as `PREVIEW_GATEWAY_ORIGIN` (where instances register). |

## How it works

```
browser
  │
  ▼  one origin
gateway  (one Vite dev server)
  ├─ GET /preview           → live index of every running preview (SSE)
  ├─ GET /preview/app-a/    → reverse-proxy to the "app-a" instance  (HTTP + HMR)
  └─ GET /preview/app-b/    → reverse-proxy to the "app-b" instance  (HTTP + HMR)

instances self-register over POST /__dev-server-gateway and heartbeat:
  • app-a  — its own Vite dev server on :53001
  • app-b  — its own Vite dev server on :53002
```

Instances `POST` to the gateway's control endpoints (under `/__dev-server-gateway`) to register and heartbeat,
and `DELETE` to deregister on shutdown. The gateway keeps an in-memory registry, evicts stale entries,
and uses it to render the index, drive the SSE stream and DevTools tab, and route incoming requests.

## License

See the repository.
