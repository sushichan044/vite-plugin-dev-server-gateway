import type { DockClientScriptContext } from "@vitejs/devtools-kit/client";

import { CONTROL_PREFIX } from "./constants";
import { ensureTrailingSlash } from "./resolve/base";
import type { GatewayInfo } from "./server/gateway-info";

interface ListEntry {
  name: string;
  base: string;
  branch?: string;
  port: number;
}

interface ConfigResponse {
  mountPath: string;
  gateway: GatewayInfo | null;
}

// Scoped under `.ph-root`. Background is left to the DevTools panel (so the tab inherits its glass);
// the accent uses light-dark() to track the panel's color scheme, matching the built-in UI.
const STYLE = `
.ph-root { font: 13px/1.5 system-ui, -apple-system, sans-serif; padding: 1rem; color-scheme: light dark; }
.ph-header { display: flex; align-items: baseline; gap: 0.5rem; margin: 0 0 0.75rem; }
.ph-header h1 { font-size: 0.95rem; margin: 0; font-weight: 600; }
.ph-section { margin-bottom: 1.25rem; }
.ph-section h2 { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.55; font-weight: 600; margin: 0 0 0.35rem; }
.ph-count { font-size: 0.78rem; opacity: 0.55; text-transform: none; letter-spacing: 0; font-weight: 500; }
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
  const href = ensureTrailingSlash(entry.base);
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

function fill(tbody: HTMLTableSectionElement, entries: ListEntry[], emptyText: string): void {
  if (entries.length === 0) {
    const td = cell(emptyText, "ph-empty");
    td.colSpan = 4;
    const tr = document.createElement("tr");
    tr.append(td);
    tbody.replaceChildren(tr);
    return;
  }
  tbody.replaceChildren(...entries.map((entry) => rowFor(entry)));
}

/**
 * DevTools custom-render panel for the preview registry (D7). Rendered directly into the DevTools
 * panel DOM (so it inherits the panel's theme/glass). The "Previews" list is kept live from the
 * instance SSE; the "Gateway" section is fetched once from /config (the gateway is fixed for the
 * server's lifetime). Each preview and the gateway index page open in a new tab.
 */
export default function setupGatewayPanel(ctx: DockClientScriptContext): void {
  let hubBody: HTMLTableSectionElement | undefined;
  let instanceBody: HTMLTableSectionElement | undefined;
  let countEl: HTMLElement | undefined;
  let source: EventSource | undefined;

  // Only the "Previews" list is live; the SSE stream carries the instances, not the gateway.
  const render = (entries: ListEntry[]): void => {
    if (instanceBody === undefined || countEl === undefined) {
      return;
    }
    countEl.textContent = `${entries.length} running`;
    fill(instanceBody, entries, "No previews running.");
  };

  // The gateway is fixed for the server's lifetime, so it is fetched once from /config (which also
  // carries the mount path for the index link) and rendered into its own section.
  const loadConfig = async (anchor: HTMLAnchorElement): Promise<void> => {
    try {
      const response = await fetch(`${CONTROL_PREFIX}/config`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const config = (await response.json()) as ConfigResponse;
      anchor.href = ensureTrailingSlash(config.mountPath);
      anchor.hidden = false;
      if (hubBody !== undefined) {
        fill(hubBody, config.gateway === null ? [] : [config.gateway], "No gateway registered.");
      }
    } catch {
      // Leave the gateway section and index link as their server-rendered defaults if unreachable.
    }
  };

  // Push-based: subscribe to the gateway's SSE stream so the panel refreshes on registry updates alone
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
    root.innerHTML = `<header class="ph-header"><h1>Dev Server Gateway</h1></header>
<section class="ph-section"><h2>Gateway</h2><table class="ph-table"><thead><tr><th>Name</th><th>Branch</th><th>Port</th><th></th></tr></thead><tbody data-ph-gateway></tbody></table></section>
<section class="ph-section"><h2>Previews <span class="ph-count"></span></h2><table class="ph-table"><thead><tr><th>Name</th><th>Branch</th><th>Port</th><th></th></tr></thead><tbody data-ph-instance></tbody></table></section>`;

    const header = root.querySelector(".ph-header");
    const indexLink = link("#", "Open index ↗", "ph-index");
    indexLink.hidden = true;
    header?.append(indexLink);

    panel.replaceChildren(style, root);
    countEl = root.querySelector<HTMLElement>(".ph-count") ?? undefined;
    hubBody = root.querySelector<HTMLTableSectionElement>("tbody[data-ph-gateway]") ?? undefined;
    instanceBody =
      root.querySelector<HTMLTableSectionElement>("tbody[data-ph-instance]") ?? undefined;
    void loadConfig(indexLink);
    start();
  });

  ctx.current.events.on("entry:activated", start);
  ctx.current.events.on("entry:deactivated", stop);
}
