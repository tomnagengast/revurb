import { serve } from "bun";
import { createServer } from "revurb";
import config from "../reverb.config";
import index from "./index.html";

// ============================================================================
// Start Revurb WebSocket Server
// ============================================================================
// This demonstrates the createServer API - the main way to embed Revurb
const { server: wsServer, shutdown } = await createServer({
  config,
  enableEventLogging: true,
  enableJobs: true,
  enableSignals: false,
});

console.log(
  `🔌 Revurb WebSocket server running on ws://${wsServer.hostname}:${wsServer.port}`,
);

// ============================================================================
// Start Frontend Dev Server
// ============================================================================
// The frontend connects using @revurb/echo (see Chat.tsx)
const frontendServer = serve({
  routes: {
    // Required for private/presence channels - authenticates subscriptions
    "/broadcasting/auth": {
      async POST(req) {
        const body = (await req.json()) as {
          socket_id?: string;
          channel_name?: string;
        };

        const socketId = body.socket_id;
        const channelName = body.channel_name;

        if (!socketId || !channelName) {
          return Response.json(
            { error: "Missing socket_id or channel_name" },
            { status: 400 },
          );
        }

        const appKey = config.apps?.apps?.[0]?.key ?? "";
        const appSecret = config.apps?.apps?.[0]?.secret ?? "";

        // Build signature: socket_id:channel_name
        const signatureString = `${socketId}:${channelName}`;
        const signature = await crypto.subtle
          .importKey(
            "raw",
            new TextEncoder().encode(appSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          )
          .then((key) =>
            crypto.subtle.sign(
              "HMAC",
              key,
              new TextEncoder().encode(signatureString),
            ),
          )
          .then((sig) =>
            Array.from(new Uint8Array(sig))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(""),
          );

        // Return auth token: app_key:signature
        return Response.json({
          auth: `${appKey}:${signature}`,
        });
      },
    },

    // Serve index.html for all unmatched routes
    "/*": index,
  },

  development: Bun.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Frontend dev server running at ${frontendServer.url}`);

// Handle shutdown signals
const handleShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  frontendServer.stop(true);
  await shutdown();
  process.exit(0);
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
