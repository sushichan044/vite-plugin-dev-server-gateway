import { CONTROL_PREFIX } from "../constants";
import type { RegistryEntry } from "../registry/types";
import { normalizeBase } from "../resolve/base";

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

function renderRow(entry: RegistryEntry): string {
  const href = normalizeBase(entry.base);
  return `<tr>
        <td><span class="dot" aria-hidden="true"></span><a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(entry.name)}</a></td>
        <td>${entry.branch === undefined ? '<span class="muted">—</span>' : `<span class="badge">${escapeHtml(entry.branch)}</span>`}</td>
        <td class="num">${entry.port}</td>
        <td><a class="open" href="${escapeHtml(href)}" target="_blank" rel="noopener">Open ↗</a></td>
      </tr>`;
}

/**
 * Render the HTML index for the mount root (D6): a self-contained page for plain browser viewing. A
 * small client script polls the registry so the list stays live without a reload, and every preview
 * link opens in a new tab.
 */
export function renderIndexHtml(entries: RegistryEntry[]): string {
  const rows =
    entries.length === 0
      ? `<tr><td colspan="4" class="empty">No previews running.</td></tr>`
      : entries.map((entry) => renderRow(entry)).join("\n      ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview Hub</title>
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
    .count { color: var(--muted); font-size: 0.8rem; }
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
    <h1>Preview Hub</h1>
    <span class="count" id="count">${entries.length} running</span>
  </header>
  <table>
    <thead>
      <tr><th>Name</th><th>Branch</th><th>Port</th><th></th></tr>
    </thead>
    <tbody id="rows">
      ${rows}
    </tbody>
  </table>
  <script>
    (() => {
      const tbody = document.getElementById("rows");
      const count = document.getElementById("count");
      const normBase = (b) => (b ? b.replace(/\\/?$/, "/") : "/");
      const cell = (text, cls) => { const td = document.createElement("td"); if (cls) td.className = cls; td.textContent = text; return td; };
      const link = (href, text, cls) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = text; if (cls) a.className = cls; return a; };
      const render = (items) => {
        count.textContent = items.length + " running";
        if (!items.length) {
          const td = cell("No previews running.", "empty"); td.colSpan = 4;
          const tr = document.createElement("tr"); tr.append(td);
          tbody.replaceChildren(tr);
          return;
        }
        tbody.replaceChildren(...items.map((e) => {
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
        }));
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
