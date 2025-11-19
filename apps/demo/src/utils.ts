import { serve } from "bun";

/**
 * Tries to find an available port starting from the `preferredPort`.
 * If the port is taken, it increments by 1 and tries again.
 */
export async function getAvailablePort(
  preferredPort: number,
  maxAttempts = 10,
): Promise<number> {
  let port = preferredPort;
  while (port < preferredPort + maxAttempts) {
    try {
      // Try to bind to the port
      const server = serve({
        port,
        fetch: () => new Response("ok"),
        development: false,
      });
      // If successful, stop immediately and return the port
      server.stop(true);
      return port;
    } catch (e: unknown) {
      const error = e as { code?: string; message?: string };
      // If port is in use, try next one
      if (
        error.code === "EADDRINUSE" ||
        error.message?.includes("EADDRINUSE")
      ) {
        port++;
        continue;
      }
      // If other error, rethrow
      throw e;
    }
  }
  throw new Error(
    `Could not find an available port after ${maxAttempts} attempts starting from ${preferredPort}`,
  );
}
