import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import type { Server } from "node:net";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const PLAYGROUND_DIR = fileURLToPath(new URL("../../playground-spa", import.meta.url));
const VITE_BIN = fileURLToPath(
  new URL("../../playground-spa/node_modules/.bin/vite", import.meta.url),
);

const PORT_RANGE: [number, number] = [53_000, 53_999];

export interface ServerHandle {
  child: ChildProcess;
  origin: string;
  port: number;
  name?: string;
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server: Server = createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, "127.0.0.1");
  });
}

/** A free port within the dispatch range, so the gateway's port-range gate accepts the registration. */
export async function freePortInRange(after = PORT_RANGE[0]): Promise<number> {
  for (let port = after; port <= PORT_RANGE[1]; port++) {
    // eslint-disable-next-line no-await-in-loop -- sequential probe, first free port wins
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error("no free port in range");
}

export async function freeEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address !== null && typeof address !== "string" ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForHttp(
  url: string,
  predicate: (response: Response) => boolean = (response) => response.ok,
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop -- polling loop
      const response = await fetch(url);
      if (predicate(response)) {
        return;
      }
    } catch {
      // server not up yet
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${url}`);
    }
    // eslint-disable-next-line no-await-in-loop -- polling loop
    await delay(150);
  }
}

function baseEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env["PREVIEW_NAME"];
  delete env["PREVIEW_GATEWAY_BASE"];
  delete env["PREVIEW_GATEWAY_PORT"];
  delete env["PREVIEW_GATEWAY_ORIGIN"];
  delete env["PREVIEW_GATEWAY_BRANCH"];
  return env;
}

export async function startGateway(): Promise<ServerHandle> {
  const port = await freeEphemeralPort();
  const child = spawn(VITE_BIN, ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: PLAYGROUND_DIR,
    env: baseEnv(),
    stdio: "ignore",
  });
  const origin = `http://127.0.0.1:${port}`;
  await waitForHttp(`${origin}/__dev-server-gateway/health`);
  return { child, origin, port };
}

export async function startInstance(
  name: string,
  gatewayOrigin: string,
  after?: number,
): Promise<ServerHandle> {
  const port = await freePortInRange(after);
  const env = {
    ...baseEnv(),
    PREVIEW_GATEWAY_BASE: `/preview/${name}`,
    PREVIEW_GATEWAY_ORIGIN: gatewayOrigin,
    PREVIEW_GATEWAY_PORT: String(port),
    PREVIEW_NAME: name,
  };
  const child = spawn(VITE_BIN, ["--host", "127.0.0.1"], {
    cwd: PLAYGROUND_DIR,
    env,
    stdio: "ignore",
  });
  const origin = `http://127.0.0.1:${port}`;
  await waitForHttp(`${origin}/preview/${name}/`);
  return { child, name, origin, port };
}

export function stop(handle: ServerHandle | undefined, signal: NodeJS.Signals = "SIGTERM"): void {
  handle?.child.kill(signal);
}
