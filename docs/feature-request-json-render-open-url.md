# Feature request draft — open a URL / link in a new tab from a `json-render` dock

> Draft for an issue against [`vitejs/devtools`](https://github.com/vitejs/devtools) using the
> "🚀 New feature proposal" template (`enhancement`). Sections below map 1:1 to the template fields.
>
> Suggested title: **`json-render`: a way to open a URL (new tab) from a panel — Link element or client `open-url` action**

## Clear and concise description of the problem

As a developer building a Vite DevTools plugin, I want a `json-render` panel to let the user **open a URL in a new browser tab** (e.g. a row in a `DataTable` that links to a running app), so that I can ship a list-with-links UI while staying on the zero-effort, natively-themed `json-render` surface.

Today this is not possible with `json-render`:

- The built-in component registry has **no link/anchor component**. The registered set is exactly
  `Stack, Card, Text, Badge, Button, Icon, Divider, TextInput, KeyValueTable, DataTable, CodeBlock, Progress, Tree`
  ([`packages/core/src/client/webcomponents/json-render/registry.ts`](https://github.com/vitejs/devtools/blob/main/packages/core/src/client/webcomponents/json-render/registry.ts)), and none of those components emit an `<a href target="_blank">` (no `href` / `target` / `window.open` anywhere in the json-render component sources).
- The only interactive element, `Button`, dispatches its `press` action to a **server-side RPC**: in [`ViewJsonRender.vue`](https://github.com/vitejs/devtools/blob/main/packages/core/src/client/webcomponents/components/views/ViewJsonRender.vue) every action name is bridged to `context.rpc.call(actionName, params)`. Because the handler runs on the Node side, it cannot call `window.open` or otherwise open a tab in the user's browser.

Net effect: any plugin whose panel is essentially "a list of links" (preview servers, route lists, generated artifacts, deploy URLs, etc.) has to drop `json-render` and fall back to a `custom-render`/`iframe` dock with a hand-written, separately-bundled client just to get a clickable "open in new tab" link.

Concrete use case: [`vite-plugin-dev-server-gateway`](https://github.com/sushichan044/vite-plugin-dev-server-gateway) shows a live list of running Vite preview dev servers in a DevTools tab and wants each row to open its preview in a new tab. The list itself is a perfect fit for `json-render`'s `DataTable`, but the new-tab requirement forces a `custom-render` client script instead.

## Suggested solution

Add a first-class way to express "open this URL" in a json-render spec, handled on the **client** side. Any one of these would solve it (in rough order of preference):

1. **A `Link` element** that renders an anchor:

   ```ts
   { type: 'Link', props: { href: '/preview/app-1/', target: '_blank', label: 'app-1' } }
   ```

   and/or a `href`/`target` prop on `Text` / `Button` so existing components can render as links.

2. **A built-in client action** (no server round-trip) usable from any `on` handler, e.g.:

   ```ts
   {
     type: 'Button',
     props: { label: 'Open ↗' },
     on: { press: { action: '$open-url', params: { url: '/preview/app-1/', target: '_blank' } } },
   }
   ```

   handled in `ViewJsonRender.vue` by intercepting a reserved action namespace (e.g. `$open-url`) and calling `window.open(url, target, 'noopener')` instead of routing it to `context.rpc.call`.

3. **A `DataTable` column/cell "link" descriptor** so tabular rows can carry per-row hrefs:

   ```ts
   { key: 'name', label: 'Name', link: { hrefKey: 'url', target: '_blank' } }
   ```

The reserved-client-action approach (2) is the smallest change and keeps the server-only programming model for everything else.

## Alternative

- Use a `custom-render` dock with a bundled client script that renders the list and calls `window.open` / `<a target="_blank">`. This works (it's what `vite-plugin-dev-server-gateway` does now) but gives up the zero-effort native styling, requires shipping a client entry, and re-implements table/badge styling by hand to match the built-in look.
- Render the URL as `Text` with `variant: 'code'` so the user can copy-paste it. No click-to-open.
- A `Button` whose RPC handler shells out to the OS opener (`open <url>`) server-side. This opens the OS default browser rather than a tab in the current DevTools browser, requires a server-side opener, and is awkward as a general pattern.

## Additional context

- Component registry (no link element): `packages/core/src/client/webcomponents/json-render/registry.ts`
- Action → RPC bridge (no client-side `window.open` path): `packages/core/src/client/webcomponents/components/views/ViewJsonRender.vue`
- json-render element type (where a `Link` type / `href` prop could be described): `packages/kit/src/types/json-render.ts`
- Happy to submit a PR for option (2) (a reserved `$open-url` client action) if the maintainers agree on the shape.

## Validations

- [ ] Follow the Code of Conduct
- [ ] Read the Contributing Guide (https://github.com/antfu/contribute)
- [ ] Check that there isn't already an issue that requests the same feature to avoid creating a duplicate
