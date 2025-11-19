import fs from "node:fs/promises";
import path from "node:path";
import { build, serve } from "bun";
import tailwind from "bun-plugin-tailwind";
import { createServer } from "revurb";
import config from "../reverb.config";
import { getAvailablePort } from "./utils";

// ============================================================================
// Logging Setup
// ============================================================================
const LOGS_DIR = path.resolve(import.meta.dir, "../logs");
await fs.mkdir(LOGS_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFilePath = path.join(LOGS_DIR, `server-${timestamp}.log`);
const logFile = Bun.file(logFilePath);
const writer = logFile.writer();

// Helper to write to both console and file
function log(...args: unknown[]) {
  const msg = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");
  const line = `[${new Date().toISOString()}] INFO: ${msg}\n`;
  writer.write(line);
  writer.flush();
  console.log(...args);
}

function error(...args: unknown[]) {
  const msg = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");
  const line = `[${new Date().toISOString()}] ERROR: ${msg}\n`;
  writer.write(line);
  writer.flush();
  console.error(...args);
}

// Override global console methods for convenience (optional, but ensures library logs are captured)
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  const msg = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");
  // Don't double timestamp if the library already does it, but here we just wrap everything
  // Since Reverb logs are raw strings mostly, this is fine.
  writer.write(`${msg}\n`);
  writer.flush();
  originalConsoleLog(...args);
};

console.error = (...args) => {
  const msg = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");
  writer.write(`[ERROR] ${msg}\n`);
  writer.flush();
  originalConsoleError(...args);
};

log(`Logging to ${logFilePath}`);

// ============================================================================
// Start Revurb WebSocket Server
// ============================================================================
// Detect available port for Reverb (default 8080)
const configuredReverbPort = Number(config.servers?.reverb?.port ?? 8080);
const availableReverbPort = await getAvailablePort(configuredReverbPort);

if (config.servers?.reverb) {
  config.servers.reverb.port = availableReverbPort;
}

// This demonstrates the createServer API - the main way to embed Revurb
const { server: wsServer, shutdown } = await createServer({
  config,
  enableEventLogging: true,
  enableJobs: true,
  enableSignals: false,
});

log(
  `🔌 Revurb WebSocket server running on ws://${wsServer.hostname}:${wsServer.port}`,
);

// ============================================================================
// Build Frontend
// ============================================================================
const PROJECT_ROOT = import.meta.dir;
const PUBLIC_DIR = path.resolve(PROJECT_ROOT, "../public");

// Ensure public directory exists
await fs.mkdir(PUBLIC_DIR, { recursive: true });

log("📦 Building frontend assets...");
const buildResult = await build({
  entrypoints: [path.join(PROJECT_ROOT, "frontend.tsx")],
  outdir: PUBLIC_DIR,
  plugins: [tailwind],
  minify: process.env.NODE_ENV === "production",
  target: "browser",
});

if (!buildResult.success) {
  error("❌ Build failed:");
  for (const msg of buildResult.logs) {
    error(msg);
  }
} else {
  log("✅ Frontend built successfully.");
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
// Detect available port for Frontend (default 3000)
const availableFrontendPort = await getAvailablePort(3000);

const frontendServer = serve({
  port: availableFrontendPort,
  routes: {
    // Required for private/presence channels - authenticates subscriptions
    "/broadcasting/auth": {
      async POST(req) {
        let socketId: string | undefined;
        let channelName: string | undefined;

        const contentType = req.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const body = (await req.json()) as {
            socket_id?: string;
            channel_name?: string;
          };
          socketId = body.socket_id;
          channelName = body.channel_name;
        } else {
          const formData = await req.formData();
          socketId = formData.get("socket_id")?.toString();
          channelName = formData.get("channel_name")?.toString();
        }

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

        // Inject CSS link
        html = html.replace(
          "</head>",
          '<link rel="stylesheet" href="/frontend.css">\n    </head>',
        );

        // Inject Config
        const reverbHost = Bun.env.BUN_PUBLIC_REVERB_HOST ?? "localhost";
        // Use the actual running port (wsServer.port) rather than the env var,
        // because the env var might be stale (e.g. 8080) while we dynamically picked a new one (e.g. 8081).
        const reverbPort = String(wsServer.port);
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

log(`🚀 Frontend server running at ${frontendServer.url}`);

// Handle shutdown signals
const handleShutdown = async (signal: string) => {
  log(`\n${signal} received, shutting down gracefully...`);
  frontendServer.stop(true);
  await shutdown();
  writer.end();
  process.exit(0);
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
