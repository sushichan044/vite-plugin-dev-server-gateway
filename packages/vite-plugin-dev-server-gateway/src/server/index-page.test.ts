import { describe, expect, it } from "vite-plus/test";

import type { RegistryEntry } from "../registry/types";
import type { GatewayInfo } from "./gateway-info";
import { renderIndexHtml } from "./index-page";

function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    base: "/preview/app/",
    lastSeen: 0,
    name: "app",
    port: 53_001,
    registeredAt: 0,
    ...overrides,
  };
}

function gateway(overrides: Partial<GatewayInfo> = {}): GatewayInfo {
  return { base: "/", name: "my-app", port: 5173, ...overrides };
}

describe("renderIndexHtml", () => {
  it("shows an empty state when no previews are running", () => {
    expect(renderIndexHtml(null, [])).toContain("No previews running");
  });

  it("renders separate Gateway and Previews sections", () => {
    const html = renderIndexHtml(null, []);
    expect(html).toContain(">Gateway</h2>");
    expect(html).toContain(">Previews ");
  });

  it("shows the gateway in the Gateway section, not among the previews", () => {
    const html = renderIndexHtml(gateway({ name: "my-app" }), [
      entry({ base: "/preview/app-a/", name: "app-a" }),
    ]);
    const hubBody = html.slice(
      html.indexOf('id="rows-gateway"'),
      html.indexOf('id="rows-instance"'),
    );
    const instanceBody = html.slice(html.indexOf('id="rows-instance"'));
    expect(hubBody).toContain(">my-app</a>");
    expect(hubBody).not.toContain(">app-a</a>");
    expect(instanceBody).toContain(">app-a</a>");
  });

  it("counts only the previews as running", () => {
    const html = renderIndexHtml(gateway(), [entry({ name: "app-a" }), entry({ name: "app-b" })]);
    expect(html).toContain("2 running");
  });

  it("shows a gateway empty state when there is no gateway", () => {
    const html = renderIndexHtml(null, [entry({ name: "app-a" })]);
    expect(html).toContain("No gateway registered.");
  });

  it("renders a row per preview, linking to the preview base verbatim", () => {
    const html = renderIndexHtml(null, [entry({ base: "/preview/foo/", name: "foo" })]);
    expect(html).toContain(">foo</a>");
    expect(html).toContain('href="/preview/foo/"');
  });

  it("opens preview links in a new tab", () => {
    const html = renderIndexHtml(null, [entry({ base: "/preview/foo/", name: "foo" })]);
    expect(html).toContain('href="/preview/foo/" target="_blank" rel="noopener"');
  });

  it("escapes branch content to avoid HTML injection", () => {
    const html = renderIndexHtml(null, [entry({ branch: "<script>alert(1)</script>" })]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
