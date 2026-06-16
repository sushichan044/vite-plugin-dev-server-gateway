import { CONTROL_PREFIX } from "../constants";
import type { RegistryEntry } from "../registry/types";
import { ensureTrailingSlash } from "../utils";
import type { GatewayInfo } from "./gateway-info";

/**
 * The fields a table row needs; satisfied by both {@link RegistryEntry} and {@link GatewayInfo}.
 */
type Row = Pick<RegistryEntry, "base" | "branch" | "name" | "port">;

const HTML_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function renderRow(entry: Row): string {
  const href = ensureTrailingSlash(entry.base);
  return `<tr>
        <td><span class="dot" aria-hidden="true"></span><a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(entry.name)}</a></td>
        <td>${entry.branch === undefined ? '<span class="muted">—</span>' : `<span class="badge">${escapeHtml(entry.branch)}</span>`}</td>
        <td class="num">${entry.port}</td>
        <td><a class="open" href="${escapeHtml(href)}" target="_blank" rel="noopener">Open ↗</a></td>
      </tr>`;
}

function renderRows(entries: Row[], emptyText: string): string {
  return entries.length === 0
    ? `<tr><td colspan="4" class="empty">${escapeHtml(emptyText)}</td></tr>`
    : entries.map((entry) => renderRow(entry)).join("\n      ");
}

/**
 * Render the HTML index for the mount root (D6): a self-contained page for plain browser viewing.
 * The gateway is shown in its own "Gateway" section, separate from the "Previews" instances. The
 * gateway never changes for the server's lifetime so it is server-rendered once; a small client
 * script subscribes to the instance SSE to keep only the "Previews" list live, and every link opens
 * in a new tab.
 */
export function renderIndexHtml(gateway: GatewayInfo | null, previews: RegistryEntry[]): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dev Server Gateway</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --fg: #262626;
      --muted: #737373;
      --border: rgba(136, 136, 136, 0.18);
      --row-hover: rgba(136, 136, 136, 0.08);
      --link: #bd34fe;
      --badge-bg: #eeeeee;
      --badge-fg: #525252;
      --dot: #3fb950;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111111;
        --fg: #e5e5e5;
        --muted: #a3a3a3;
        --border: rgba(136, 136, 136, 0.18);
        --row-hover: rgba(136, 136, 136, 0.08);
        --link: #e5acff;
        --badge-bg: #222222;
        --badge-fg: #a3a3a3;
        --dot: #3fb950;
      }
    }
    * { box-sizing: border-box; }
    body {
      font: 13px/1.5 system-ui, -apple-system, sans-serif;
      margin: 0; padding: 1.25rem;
      background: var(--bg); color: var(--fg);
    }
    header { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1rem; margin: 0; font-weight: 650; }
    section { margin-bottom: 1.5rem; }
    h2 { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; margin: 0 0 0.4rem; }
    .count { color: var(--muted); font-size: 0.8rem; text-transform: none; letter-spacing: 0; font-weight: 500; }
    table { border-collapse: collapse; width: 100%; max-width: 720px; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
    th { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
    tbody tr:hover { background: var(--row-hover); }
    td.num { font-variant-numeric: tabular-nums; color: var(--muted); }
    .muted { color: var(--muted); }
    .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--dot); margin-right: 0.5rem; vertical-align: middle; }
    a { color: var(--link); text-decoration: none; font-weight: 550; }
    a:hover { text-decoration: underline; }
    .badge { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--badge-bg); color: var(--badge-fg); font-size: 0.75rem; font-weight: 500; }
    .open { font-size: 0.8rem; font-weight: 500; }
    .empty { color: var(--muted); text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <header>
    <h1>Dev Server Gateway</h1>
  </header>
  <section>
    <h2>Gateway</h2>
    <table>
      <thead>
        <tr><th>Name</th><th>Branch</th><th>Port</th><th></th></tr>
      </thead>
      <tbody id="rows-gateway">
        ${renderRows(gateway ? [gateway] : [], "No gateway registered.")}
      </tbody>
    </table>
  </section>
  <section>
    <h2>Previews <span class="count" id="count">${previews.length} running</span></h2>
    <table>
      <thead>
        <tr><th>Name</th><th>Branch</th><th>Port</th><th></th></tr>
      </thead>
      <tbody id="rows-instance">
        ${renderRows(previews, "No previews running.")}
      </tbody>
    </table>
  </section>
  <script>
    (() => {
      // Only the "Previews" list is live; the "Gateway" section is server-rendered once and never changes.
      const instanceBody = document.getElementById("rows-instance");
      const count = document.getElementById("count");
      const normBase = (b) => (b ? b.replace(/\\/?$/, "/") : "/");
      const cell = (text, cls) => { const td = document.createElement("td"); if (cls) td.className = cls; td.textContent = text; return td; };
      const link = (href, text, cls) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = text; if (cls) a.className = cls; return a; };
      const rowFor = (e) => {
        const tr = document.createElement("tr");
        const name = document.createElement("td");
        const dot = document.createElement("span"); dot.className = "dot";
        name.append(dot, link(normBase(e.base), e.name));
        const branch = document.createElement("td");
        if (e.branch) { const b = document.createElement("span"); b.className = "badge"; b.textContent = e.branch; branch.append(b); }
        else { const m = document.createElement("span"); m.className = "muted"; m.textContent = "—"; branch.append(m); }
        const open = document.createElement("td"); open.append(link(normBase(e.base), "Open ↗", "open"));
        tr.append(name, branch, cell(String(e.port), "num"), open);
        return tr;
      };
      const render = (items) => {
        count.textContent = items.length + " running";
        if (!items.length) {
          const td = cell("No previews running.", "empty"); td.colSpan = 4;
          const tr = document.createElement("tr"); tr.append(td);
          instanceBody.replaceChildren(tr);
          return;
        }
        instanceBody.replaceChildren(...items.map(rowFor));
      };
      // Push-based: refresh on registry updates over SSE, no polling.
      const source = new EventSource("${CONTROL_PREFIX}/events");
      source.onmessage = (event) => {
        try { render(JSON.parse(event.data)); } catch {}
      };
    })();
  </script>
</body>
</html>
`;
}
