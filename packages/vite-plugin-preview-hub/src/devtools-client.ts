import type { DockClientScriptContext } from "@vitejs/devtools-kit/client";

import { CONTROL_PREFIX } from "./constants";
import { normalizeBase } from "./resolve/base";

interface ListEntry {
  name: string;
  base: string;
  branch?: string;
  port: number;
}

// Scoped under `.ph-root`. Background is left to the DevTools panel (so the tab inherits its glass);
// the accent uses light-dark() to track the panel's color scheme, matching the built-in UI.
const STYLE = `
.ph-root { font: 13px/1.5 system-ui, -apple-system, sans-serif; padding: 1rem; color-scheme: light dark; }
.ph-header { display: flex; align-items: baseline; gap: 0.5rem; margin: 0 0 0.75rem; }
.ph-header h1 { font-size: 0.95rem; margin: 0; font-weight: 600; }
.ph-count { font-size: 0.78rem; opacity: 0.55; }
.ph-index { margin-left: auto; font-size: 0.8rem; }
.ph-table { border-collapse: collapse; width: 100%; }
.ph-table th, .ph-table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid rgba(136,136,136,0.18); white-space: nowrap; }
.ph-table th { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.55; font-weight: 600; }
.ph-table tbody tr:hover { background: rgba(136,136,136,0.08); }
.ph-num { font-variant-numeric: tabular-nums; opacity: 0.7; }
.ph-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #3fb950; margin-right: 0.5rem; vertical-align: middle; }
.ph-root a { color: light-dark(#bd34fe, #d577ff); text-decoration: none; font-weight: 550; }
.ph-root a:hover { text-decoration: underline; }
.ph-badge { display: inline-block; padding: 0.08rem 0.4rem; border-radius: 999px; background: rgba(136,136,136,0.15); font-size: 0.72rem; opacity: 0.85; }
.ph-empty { opacity: 0.55; padding: 1.5rem; text-align: center; }
`;

function link(href: string, text: string, className?: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = text;
  if (className !== undefined) {
    a.className = className;
  }
  return a;
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement("td");
  if (className !== undefined) {
    td.className = className;
  }
  td.textContent = text;
  return td;
}

function rowFor(entry: ListEntry): HTMLTableRowElement {
  const href = normalizeBase(entry.base);
  const tr = document.createElement("tr");

  const nameCell = document.createElement("td");
  const dot = document.createElement("span");
  dot.className = "ph-dot";
  nameCell.append(dot, link(href, entry.name));

  const branchCell = document.createElement("td");
  if (entry.branch === undefined || entry.branch === "") {
    branchCell.textContent = "—";
    branchCell.style.opacity = "0.5";
  } else {
    const badge = document.createElement("span");
    badge.className = "ph-badge";
    badge.textContent = entry.branch;
    branchCell.append(badge);
  }

  const openCell = document.createElement("td");
  openCell.append(link(href, "Open ↗"));

  tr.append(nameCell, branchCell, cell(String(entry.port), "ph-num"), openCell);
  return tr;
}

/**
 * DevTools custom-render panel for the preview registry (D7). Rendered directly into the DevTools
 * panel DOM (so it inherits the panel's theme/glass), it polls the hub's registry to keep the list
 * live, links each preview (and the hub index page) to open in a new tab.
 */
export default function setupPreviewHubPanel(ctx: DockClientScriptContext): void {
  let tbody: HTMLTableSectionElement | undefined;
  let countEl: HTMLElement | undefined;
  let source: EventSource | undefined;

  const render = (entries: ListEntry[]): void => {
    if (tbody === undefined || countEl === undefined) {
      return;
    }
    countEl.textContent = `${entries.length} running`;

    if (entries.length === 0) {
      const td = cell("No previews running.", "ph-empty");
      td.colSpan = 4;
      const tr = document.createElement("tr");
      tr.append(td);
      tbody.replaceChildren(tr);
      return;
    }
    tbody.replaceChildren(...entries.map((entry) => rowFor(entry)));
  };

  const loadIndexLink = async (anchor: HTMLAnchorElement): Promise<void> => {
    try {
      const response = await fetch(`${CONTROL_PREFIX}/config`, { cache: "no-store" });
      if (response.ok) {
        const config = (await response.json()) as { mountPath: string };
        anchor.href = normalizeBase(config.mountPath);
        anchor.hidden = false;
      }
    } catch {
      // Leave the index link hidden if the hub is unreachable.
    }
  };

  // Push-based: subscribe to the hub's SSE stream so the panel refreshes on registry updates alone
  // (registration, heartbeat, eviction) with no polling.
  const start = (): void => {
    if (source !== undefined) {
      return;
    }
    source = new EventSource(`${CONTROL_PREFIX}/events`);
    source.onmessage = (event) => {
      try {
        render(JSON.parse(event.data) as ListEntry[]);
      } catch {
        // Ignore malformed frames; the next event refreshes.
      }
    };
  };

  const stop = (): void => {
    if (source !== undefined) {
      source.close();
      source = undefined;
    }
  };

  ctx.current.events.on("dom:panel:mounted", (panel: HTMLElement) => {
    const style = document.createElement("style");
    style.textContent = STYLE;

    const root = document.createElement("div");
    root.className = "ph-root";
    root.innerHTML = `<header class="ph-header"><h1>Preview Hub</h1><span class="ph-count"></span></header>
<table class="ph-table"><thead><tr><th>Name</th><th>Branch</th><th>Port</th><th></th></tr></thead><tbody></tbody></table>`;

    const header = root.querySelector(".ph-header");
    const indexLink = link("#", "Open index ↗", "ph-index");
    indexLink.hidden = true;
    header?.append(indexLink);

    panel.replaceChildren(style, root);
    countEl = root.querySelector<HTMLElement>(".ph-count") ?? undefined;
    tbody = root.querySelector("tbody") ?? undefined;
    void loadIndexLink(indexLink);
    start();
  });

  ctx.current.events.on("entry:activated", start);
  ctx.current.events.on("entry:deactivated", stop);
}
