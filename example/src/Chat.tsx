import Echo from "laravel-echo";
import type { EchoOptions } from "laravel-echo/dist/echo";
import Pusher from "pusher-js";
import { type FormEvent, useEffect, useRef, useState } from "react";

type GlobalWithPusher = typeof globalThis & { Pusher?: typeof Pusher };
const globalContext = globalThis as GlobalWithPusher;
if (!globalContext.Pusher) {
  globalContext.Pusher = Pusher;
}

interface Message {
  text: string;
  sender: string;
  timestamp: Date;
}

interface ClientMessagePayload {
  text?: string;
  sender?: string;
}

interface ConnectionHandler {
  event: string;
  handler: (data?: unknown) => void;
}

type Subscription = ReturnType<Pusher["subscribe"]>;

export const removeTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getEnvPort = () => {
  if (typeof Bun !== "undefined" && Bun.env?.REVERB_PORT) {
    return Bun.env.REVERB_PORT;
  }
};

const getDefaultServer = () => {
  const envPort = getEnvPort();
  return `ws://localhost:${envPort ?? "8080"}`;
};

export const normalizeServer = (value: string) => {
  const trimmed = value.trim();
  const fallback = trimmed || getDefaultServer();
  if (/^wss?:\/\//i.test(fallback)) {
    return removeTrailingSlash(fallback);
  }
  const isHttp = /^https?:\/\//i.test(fallback);
  if (isHttp) {
    const withoutProtocol = removeTrailingSlash(
      fallback.replace(/^https?:\/\//i, ""),
    );
    const isSecure = fallback.toLowerCase().startsWith("https");
    if (isSecure) {
      return `wss://${withoutProtocol}`;
    }
    return `ws://${withoutProtocol}`;
  }
  return `ws://${removeTrailingSlash(fallback)}`;
};

const CLIENT_EVENT = "client-message";
const APP_KEY = "my-app-key";

export const buildEchoOptions = (value: string) => {
  const normalized = normalizeServer(value);
  const endpoint = new URL(normalized);
  const secure = endpoint.protocol === "wss:";
  const derivedPort = endpoint.port
    ? Number.parseInt(endpoint.port, 10)
    : secure
      ? 443
      : 80;

  const options: EchoOptions<"reverb"> = {
    broadcaster: "reverb",
    key: APP_KEY,
    wsHost: endpoint.hostname,
    wsPort: derivedPort,
    wssPort: derivedPort,
    forceTLS: secure,
    encrypted: secure,
    disableStats: true,
    enabledTransports: ["ws", "wss"],
  };

  return { normalized, options };
};

function parseClientPayload(data: unknown) {
  if (typeof data === "string") {
    return JSON.parse(data) as ClientMessagePayload;
  }
  if (typeof data === "object" && data) {
    return data as ClientMessagePayload;
  }
}

export function Chat() {
  const [connected, setConnected] = useState(false);
  const [channel, setChannel] = useState("chat");
  const [joinedChannel, setJoinedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [username, setUsername] = useState("User");
  const [server, setServer] = useState(() => getDefaultServer());
  const [connectionError, setConnectionError] = useState("");
  const channelRef = useRef(channel);
  const usernameRef = useRef(username);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const echoRef = useRef<Echo<"reverb"> | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const connectionHandlersRef = useRef<ConnectionHandler[]>([]);

  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: We need to scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const leaveChannel = () => {
    const echo = echoRef.current;
    const subscription = subscriptionRef.current;
    if (!echo || !subscription) {
      return;
    }
    subscription.unbind_all();
    echo.connector.pusher.unsubscribe(subscription.name);
    subscriptionRef.current = null;
  };

  const connect = () => {
    if (echoRef.current) {
      return;
    }

    const config = buildEchoOptions(server);
    const echo = new Echo<"reverb">(config.options);
    const pusher = echo.connector.pusher as Pusher;
    echoRef.current = echo;

    const connectionHandlers: ConnectionHandler[] = [];

    const handleConnected = () => {
      setConnected(true);
      setConnectionError("");
      subscribeToChannel(channelRef.current);
    };
    pusher.connection.bind("connected", handleConnected);
    connectionHandlers.push({ event: "connected", handler: handleConnected });

    const handleConnectionError = (error?: {
      error?: { message?: string };
    }) => {
      const detail = error?.error?.message;
      const reason = detail ? detail : "Is the server running?";
      setConnectionError(
        `Unable to connect to ${config.normalized}. ${reason}`,
      );
    };
    pusher.connection.bind("error", handleConnectionError);
    connectionHandlers.push({ event: "error", handler: handleConnectionError });

    const handleFailed = () => {
      setConnected(false);
      setJoinedChannel(null);
    };
    pusher.connection.bind("disconnected", handleFailed);
    connectionHandlers.push({ event: "disconnected", handler: handleFailed });
    pusher.connection.bind("failed", handleConnectionError);
    connectionHandlers.push({
      event: "failed",
      handler: handleConnectionError,
    });

    connectionHandlersRef.current = connectionHandlers;
  };

  const disconnect = () => {
    const echo = echoRef.current;
    if (!echo) {
      return;
    }

    leaveChannel();

    const pusher = echo.connector.pusher as Pusher;
    const connection = pusher.connection;
    const handlers = connectionHandlersRef.current;
    handlers.forEach(({ event, handler }) => {
      connection.unbind(event, handler);
    });
    connectionHandlersRef.current = [];

    echo.disconnect();
    echoRef.current = null;

    setConnected(false);
    setJoinedChannel(null);
    setMessages([]);
  };

  const subscribeToChannel = (channelName: string) => {
    const echo = echoRef.current;
    if (!echo) {
      return;
    }

    leaveChannel();
    setJoinedChannel(null);

    const subscription = echo.connector.pusher.subscribe(channelName);
    subscriptionRef.current = subscription;

    subscription.bind("pusher:subscription_succeeded", () => {
      setJoinedChannel(channelName);
    });

    subscription.bind(CLIENT_EVENT, (rawData: unknown) => {
      const payload = parseClientPayload(rawData);
      if (!payload) {
        return;
      }
      if (payload.sender === usernameRef.current) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          text: payload.text ?? "",
          sender: payload.sender ?? "Unknown",
          timestamp: new Date(),
        },
      ]);
    });
  };

  const handleJoinChannel = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const channelName = (formData.get("channel") as string) || "chat";
    const existing = subscriptionRef.current?.name;
    setChannel(channelName);
    channelRef.current = channelName;

    if (!echoRef.current) {
      return;
    }

    if (existing === channelName) {
      return;
    }

    setMessages([]);
    subscribeToChannel(channelName);
  };

  const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!messageInput.trim() || !connected || !joinedChannel) {
      return;
    }

    const messageData = {
      text: messageInput,
      sender: username,
    };

    // Add the message to local state immediately
    setMessages((prev) => [
      ...prev,
      {
        text: messageData.text,
        sender: messageData.sender,
        timestamp: new Date(),
      },
    ]);

    const echo = echoRef.current;
    if (!echo) {
      return;
    }

    echo.connector.pusher.send_event(CLIENT_EVENT, messageData, joinedChannel);
    setMessageInput("");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: disconnect ref changes on every render
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
      {/* Connection controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="ws://localhost:8080"
            className="flex-1 bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono focus:border-[#f3d5a3] outline-none"
            disabled={connected}
          />
          {connected && (
            <button
              type="button"
              onClick={disconnect}
              className="bg-red-600 text-white border-0 px-5 py-3 rounded-lg font-bold transition-all duration-100 hover:bg-red-700 hover:-translate-y-px cursor-pointer whitespace-nowrap"
            >
              Disconnect
            </button>
          )}
          {!connected && (
            <button
              type="button"
              onClick={connect}
              className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-3 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
            >
              Connect
            </button>
          )}
        </div>
        {connectionError && (
          <div className="text-red-400 text-sm font-mono">
            {connectionError}
          </div>
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
          className="flex-1 bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono focus:border-[#f3d5a3] outline-none"
          disabled={connected}
        />
      </div>

      {/* Channel join form */}
      {connected && (
        <form
          onSubmit={handleJoinChannel}
          className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
        >
          <select
            name="channel"
            defaultValue={channel}
            className="w-full flex-1 bg-[#242424] border-2 border-[#fbf0df]/40 text-[#fbf0df] font-mono text-base py-2 px-3 rounded-lg outline-none focus:border-[#f3d5a3] cursor-pointer"
          >
            <option value="chat">Chat</option>
            <option value="general">General</option>
            <option value="random">Random</option>
            <option value="tech">Tech</option>
            <option value="gaming">Gaming</option>
            <option value="music">Music</option>
            <option value="announcements">Announcements</option>
          </select>
          <button
            type="submit"
            className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
          >
            Join {joinedChannel && joinedChannel !== channel ? "New" : ""}
          </button>
        </form>
      )}

      {/* Messages display */}
      <div className="flex flex-col gap-2 bg-[#1a1a1a] p-4 rounded-xl font-mono border-2 border-[#fbf0df] min-h-[300px] max-h-[500px] overflow-y-auto">
        {joinedChannel && (
          <div className="text-[#f3d5a3] text-sm font-bold text-center pb-2 border-b border-[#fbf0df]/20 mb-2">
            Channel: #{joinedChannel}
          </div>
        )}
        {messages.length === 0 ? (
          <div className="text-[#fbf0df]/40 text-center py-8">
            {!connected
              ? "Connect to start chatting"
              : !joinedChannel
                ? "Join a channel to start chatting"
                : "No messages yet. Start chatting!"}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={`${msg.timestamp.getTime()}-${msg.sender}`}
              className="flex flex-col items-start gap-1 bg-[#242424] p-3 rounded-lg border border-[#fbf0df]/20"
            >
              <div className="text-[#fbf0df]">{msg.text}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-400">
                  {msg.sender}
                </span>
                <span className="text-xs text-gray-500">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input form */}
      {connected && joinedChannel && (
        <form
          onSubmit={handleSendMessage}
          className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
        >
          <input
            ref={messageInputRef}
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
          />
          <button
            type="submit"
            className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
