import { describe, expect, it } from "vite-plus/test";

import type { RegistryEntry } from "../registry/types";
import { renderIndexHtml } from "./index-page";

function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    base: "/preview/app",
    lastSeen: 0,
    name: "app",
    port: 53_001,
    registeredAt: 0,
    ...overrides,
  };
}

describe("renderIndexHtml", () => {
  it("shows an empty state when nothing is running", () => {
    expect(renderIndexHtml([])).toContain("No previews running");
  });

  it("renders a row per preview with a normalized (trailing-slash) link", () => {
    const html = renderIndexHtml([entry({ base: "/preview/foo", name: "foo" })]);
    expect(html).toContain(">foo</a>");
    expect(html).toContain('href="/preview/foo/"');
  });

  it("opens preview links in a new tab", () => {
    const html = renderIndexHtml([entry({ base: "/preview/foo", name: "foo" })]);
    expect(html).toContain('href="/preview/foo/" target="_blank" rel="noopener"');
  });

  it("escapes branch content to avoid HTML injection", () => {
    const html = renderIndexHtml([entry({ branch: "<script>alert(1)</script>" })]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
