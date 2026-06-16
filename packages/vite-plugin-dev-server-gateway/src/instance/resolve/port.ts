import { createHash } from "node:crypto";
import { createServer } from "node:net";

import { PortRangeExhaustedError } from "../../errors";

/**
 * Deterministic 32-bit hash of a key. Same key always yields the same number (D3 stable port).
 */
export function hashKey(key: string): number {
  return createHash("sha256").update(key).digest().readUInt32BE(0);
}

/**
 * Map a key to a stable preferred port within the inclusive range.
 */
export function stablePort(key: string, range: readonly [number, number]): number {
  const [min, max] = range;
  const span = max - min + 1;
  return min + (hashKey(key) % span);
}

/**
 * Resolve true when nothing is listening on the loopback port.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
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

/**
 * Probe for a free port, starting at `preferred` and scanning forward (wrapping) within the range.
 *
 * Returns the exact bound-able port so the launch script, the instance, and the registry all use
 * the same value with no second computation (D3). Throws {@link PortRangeExhaustedError} when the
 * whole range is taken.
 */
export async function probeFreePort(
  preferred: number,
  range: readonly [number, number],
): Promise<number> {
  const [min, max] = range;
  const span = max - min + 1;

  for (let i = 0; i < span; i++) {
    const port = min + ((preferred - min + i) % span);
    // Sequential probing is intentional: we want the first free port nearest the preferred one.
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new PortRangeExhaustedError(range);
}
