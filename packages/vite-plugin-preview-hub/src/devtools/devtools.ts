import type { ViteDevToolsNodeContext } from "@vitejs/devtools-kit";

const DOCK_ID = "preview-hub";

/**
 * Register the DevTools tab (D7) as a `custom-render` dock backed by a client script that paints
 * the preview registry directly into the DevTools panel.
 *
 * WHY custom-render rather than an iframe-of-the-index: rendering into the panel DOM inherits the
 * built-in UI's theme/glass (so it looks native), the script polls the registry to keep
 * uptime/status live, and it can open each preview in a new tab — none of which an
 * iframe-of-our-page or a server-only json-render spec does cleanly. The standalone HTML index
 * (`${mountPath}/`) stays a separate, self-contained page for plain browser viewing.
 */
export function setupDevtools(ctx: ViteDevToolsNodeContext): void {
  ctx.docks.register({
    icon: "ph:monitor-duotone",
    id: DOCK_ID,
    renderer: {
      importFrom: "vite-plugin-preview-hub/devtools-client",
      importName: "default",
    },
    title: "Preview Hub",
    type: "custom-render",
  });
}
