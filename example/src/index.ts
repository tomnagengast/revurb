import { serve } from "bun";
import { createServer } from "../../src/index";
import config from "../reverb.config";
import index from "./index.html";

async function bootstrap() {
  // Start Revurb WebSocket server
  const { server: wsServer, shutdown } = await createServer({
    config,
    enableEventLogging: false,
    enableJobs: true,
    enableSignals: false,
  });

  console.log(
    `🔌 Revurb WebSocket server running on ws://${wsServer.hostname}:${wsServer.port}`,
  );

  // Start frontend dev server
  const frontendServer = serve({
    routes: {
      // Serve index.html for all unmatched routes.
      "/*": index,

      "/api/hello": {
        async GET(_req) {
          return Response.json({
            message: "Hello, world!",
            method: "GET",
          });
        },
        async PUT(_req) {
          return Response.json({
            message: "Hello, world!",
            method: "PUT",
          });
        },
      },

      "/api/hello/:name": async (req) => {
        const name = req.params.name;
        return Response.json({
          message: `Hello, ${name}!`,
        });
      },
    },

    development: Bun.env.NODE_ENV !== "production" && {
      // Enable browser hot reloading in development
      hmr: true,

      // Echo console logs from the browser to the server
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
}

bootstrap().catch((error) => {
  console.error("Failed to start servers:", error);
  process.exit(1);
});
