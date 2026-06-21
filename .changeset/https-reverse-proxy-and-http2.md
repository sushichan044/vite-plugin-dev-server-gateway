---
"vite-plugin-dev-server-gateway": patch
---

Fix the gateway behind HTTPS dev environments.

- **SSE events behind a reverse proxy**: the registry SSE stream (`/__dev-server-gateway/events`, used by the DevTools panel and the index page) now sends `X-Accel-Buffering: no` and flushes its headers. A common HTTPS setup terminates TLS in a reverse proxy in front of a plain-HTTP dev server; without this the proxy buffers the long-lived stream and never forwards a frame, so the DevTools panel's `EventSource` hangs and is cancelled after a timeout while `/config` (a short response) still works.
- **Instance proxying over HTTP/2**: when Vite itself serves HTTPS it runs over HTTP/2. The gateway now strips HTTP/2 pseudo-headers (`:authority`, `:path`, …) and hop-by-hop headers when forwarding a request to an instance, and strips hop-by-hop headers (e.g. `transfer-encoding`) from the instance response before writing it back. Previously these tripped `ERR_INVALID_HTTP_TOKEN` / `ERR_HTTP2_INVALID_CONNECTION_HEADERS` and broke instance dispatch under HTTP/2.
