import fs from "node:fs/promises";
import path from "node:path";
import { build, serve } from "bun";
import tailwind from "bun-plugin-tailwind";
import { createServer } from "revurb";
import config from "../reverb.config";

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
// Build Frontend
// ============================================================================
const PROJECT_ROOT = import.meta.dir;
const PUBLIC_DIR = path.resolve(PROJECT_ROOT, "../public");

// Ensure public directory exists
await fs.mkdir(PUBLIC_DIR, { recursive: true });

console.log("📦 Building frontend assets...");
const buildResult = await build({
  entrypoints: [path.join(PROJECT_ROOT, "frontend.tsx")],
  outdir: PUBLIC_DIR,
  plugins: [tailwind],
  minify: process.env.NODE_ENV === "production",
  target: "browser",
});

if (!buildResult.success) {
  console.error("❌ Build failed:");
  for (const msg of buildResult.logs) {
    console.error(msg);
  }
} else {
  console.log("✅ Frontend built successfully.");
}

// Copy static assets
const assets = ["github.svg"];
for (const asset of assets) {
  const src = path.join(PROJECT_ROOT, asset);
  const dest = path.join(PUBLIC_DIR, asset);
  if (await Bun.file(src).exists()) {
    await Bun.write(dest, Bun.file(src));
  }
}

// ============================================================================
// Start Frontend Server
// ============================================================================
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

    // Serve all other requests
    "/*": async (req) => {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // Default to index.html
      if (pathname === "/" || pathname === "/index.html") {
        const htmlFile = Bun.file(path.join(PROJECT_ROOT, "index.html"));
        let html = await htmlFile.text();

        // Point to built JS
        html = html.replace('src="./frontend.tsx"', 'src="/frontend.js"');

        // Inject Config
        const reverbHost = Bun.env.BUN_PUBLIC_REVERB_HOST ?? "localhost";
        const reverbPort =
          Bun.env.BUN_PUBLIC_REVERB_PORT ?? String(wsServer.port);
        const reverbScheme = Bun.env.BUN_PUBLIC_REVERB_SCHEME ?? "http";
        const reverbAppKey = config.apps?.apps?.[0]?.key ?? "my-app-key";

        const configScript = `
          <script>
            window.__REVURB_CONFIG__ = {
              host: ${JSON.stringify(reverbHost)},
              port: ${JSON.stringify(reverbPort)},
              scheme: ${JSON.stringify(reverbScheme)},
              appKey: ${JSON.stringify(reverbAppKey)}
            };
          </script>`;

        html = html.replace("</head>", `${configScript}\n    </head>`);
        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Try to serve static file from public dir
      // Prevent directory traversal by checking if resolved path starts with PUBLIC_DIR
      const safePath = path.normalize(
        path.join(PUBLIC_DIR, pathname.replace(/^\//, "")),
      );
      if (!safePath.startsWith(PUBLIC_DIR)) {
        return new Response("Forbidden", { status: 403 });
      }

      const file = Bun.file(safePath);
      if (await file.exists()) {
        return new Response(file);
      }

      return new Response("Not found", { status: 404 });
    },
  },

  development: Bun.env.NODE_ENV !== "production" && {
    console: true,
  },
});

console.log(`🚀 Frontend server running at ${frontendServer.url}`);

// Handle shutdown signals
const handleShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  frontendServer.stop(true);
  await shutdown();
  process.exit(0);
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
