import { createHash, createHmac } from "node:crypto";
import { serve } from "bun";
import { createServer } from "../../src/index";
import config from "../reverb.config";
import index from "./index.html";

type ChatMessage = {
  text: string;
  sender: string;
  timestamp: string;
};

const MESSAGE_HISTORY_LIMIT = 100;
const messageHistory = new Map<string, ChatMessage[]>();

const defaultApp = config.apps?.apps?.[0];
if (!defaultApp) {
  throw new Error("Revurb example requires at least one configured app.");
}

const CLIENT_EVENT = "client-message";
const APP_ID = defaultApp.app_id;
const APP_KEY = defaultApp.key;
const APP_SECRET = defaultApp.secret;
const REVERB_PORT = Number.parseInt(Bun.env.REVERB_PORT ?? "8080", 10);
const REVERB_HTTP_ORIGIN =
  Bun.env.REVERB_HTTP_ORIGIN ?? `http://127.0.0.1:${REVERB_PORT}`;

const addMessageToHistory = (channel: string, message: ChatMessage) => {
  const key = channel || "private-chat";
  const existing = messageHistory.get(key) ?? [];
  const next = [...existing, message].slice(-MESSAGE_HISTORY_LIMIT);
  messageHistory.set(key, next);
};

const getHistory = (channel: string) => {
  const key = channel || "private-chat";
  return messageHistory.get(key) ?? [];
};

const triggerRevurbEvent = async (channel: string, message: ChatMessage) => {
  const body = JSON.stringify({
    name: CLIENT_EVENT,
    channel,
    data: JSON.stringify(message),
  });

  const bodyMd5 = createHash("md5").update(body).digest("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = new URLSearchParams({
    auth_key: APP_KEY,
    auth_timestamp: timestamp,
    auth_version: "1.0",
    body_md5: bodyMd5,
  });

  const path = `/apps/${APP_ID}/events`;
  const signatureString = `POST\n${path}\n${params.toString()}`;
  const authSignature = createHmac("sha256", APP_SECRET)
    .update(signatureString)
    .digest("hex");
  params.set("auth_signature", authSignature);

  await fetch(`${REVERB_HTTP_ORIGIN}${path}?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
};

async function bootstrap() {
  // Start Revurb WebSocket server
  const { server: wsServer, shutdown } = await createServer({
    config,
    enableEventLogging: true,
    enableJobs: true,
    enableSignals: false,
  });

  console.log(
    `🔌 Revurb WebSocket server running on ws://${wsServer.hostname}:${wsServer.port}`,
  );

  // Start frontend dev server
  const frontendServer = serve({
    routes: {
      "/api/messages": {
        async GET(req) {
          const url = new URL(req.url);
          const channel = url.searchParams.get("channel") ?? "private-chat";
          return Response.json({
            messages: getHistory(channel),
          });
        },
        async POST(req) {
          try {
            const body = (await req.json()) as {
              channel?: string;
              message?: ChatMessage;
            };
            const channel = body.channel ?? "private-chat";
            const messageBody = body.message;
            if (
              !messageBody ||
              typeof messageBody.text !== "string" ||
              typeof messageBody.sender !== "string"
            ) {
              return Response.json(
                { error: "Invalid message payload" },
                { status: 400 },
              );
            }
            const message: ChatMessage = {
              text: messageBody.text,
              sender: messageBody.sender,
              timestamp:
                typeof messageBody.timestamp === "string"
                  ? messageBody.timestamp
                  : new Date().toISOString(),
            };

            addMessageToHistory(channel, message);
            await triggerRevurbEvent(channel, message);

            return Response.json({ ok: true });
          } catch (error) {
            console.error("Failed to handle message", error);
            return Response.json(
              { error: "Failed to send message" },
              { status: 500 },
            );
          }
        },
      },

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
}

bootstrap().catch((error) => {
  console.error("Failed to start servers:", error);
  process.exit(1);
});
