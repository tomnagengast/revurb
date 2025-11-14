#!/usr/bin/env bun

/**
 * Simple WebSocket echo server for Autobahn spec tests
 * This server just echoes back any message it receives
 */

const server = Bun.serve({
  port: 8080,
  hostname: "0.0.0.0",
  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      if (server.upgrade(req)) {
        return undefined;
      }
      return new Response("Upgrade failed", { status: 500 });
    }

    return new Response("Not found", { status: 404 });
  },
  websocket: {
    message(ws, message) {
      ws.send(message);
    },
    open(ws) {
      // Connection opened
    },
    close(ws) {
      // Connection closed
    },
  },
});

console.log(`Server running at ${server.hostname}:${server.port}`);
