import {
  configureEcho,
  echo,
  echoIsConfigured,
  useEchoPublic,
} from "@laravel/echo-react";
import type { EchoOptions } from "laravel-echo";
import type Pusher from "pusher-js";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Message = {
  text: string;
  sender: string;
  timestamp: Date;
};

type ClientMessagePayload = {
  text?: string;
  sender?: string;
};

type ConnectionState = "idle" | "connecting" | "connected";

type ChatSessionProps = {
  username: string;
  server: string;
  onConnected: () => void;
  onDisconnected: () => void;
  onConnectionError: (message: string) => void;
};

const CLIENT_EVENT = "client-message";
const APP_KEY = "my-app-key";
const CHANNELS = [
  "chat",
  "general",
  "random",
  "tech",
  "gaming",
  "music",
  "announcements",
] as const;

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

const parseClientPayload = (data: unknown) => {
  if (typeof data === "string") {
    return JSON.parse(data) as ClientMessagePayload;
  }
  if (typeof data === "object" && data) {
    return data as ClientMessagePayload;
  }
};

function ChatSession({
  username,
  server,
  onConnected,
  onDisconnected,
  onConnectionError,
}: ChatSessionProps) {
  const [chan, setChan] = useState<(typeof CHANNELS)[number]>(CHANNELS[0]);
  const [joined, setJoined] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const handleIncoming = useCallback(
    (payload: ClientMessagePayload) => {
      const data = parseClientPayload(payload);
      if (!data) {
        return;
      }
      if (data.sender === username) {
        return;
      }
      setMsgs((prev) => [
        ...prev,
        {
          text: data.text ?? "",
          sender: data.sender ?? "Unknown",
          timestamp: new Date(),
        },
      ]);
    },
    [username],
  );

  const { channel: channelApi } = useEchoPublic<ClientMessagePayload>(
    chan,
    CLIENT_EVENT,
    handleIncoming,
    [chan, handleIncoming],
  );

  useEffect(() => {
    if (!chan) {
      return;
    }
    setMsgs([]);
    setText("");
  }, [chan]);

  useEffect(() => {
    const hasMessages = msgs.length > 0;
    endRef.current?.scrollIntoView({
      behavior: hasMessages ? "smooth" : "auto",
    });
  }, [msgs]);

  useEffect(() => {
    const instance = echo<"reverb">();
    const pusher = instance.connector.pusher as Pusher;

    const handleConnected = () => {
      onConnected();
    };
    const handleDisconnected = () => {
      onDisconnected();
    };
    const handleFailed = () => {
      onConnectionError("Connection failed");
    };
    const handleError = (error?: { error?: { message?: string } }) => {
      const detail = error?.error?.message;
      const reason = detail ? detail : "Is the server running?";
      onConnectionError(reason);
    };

    pusher.connection.bind("connected", handleConnected);
    pusher.connection.bind("disconnected", handleDisconnected);
    pusher.connection.bind("failed", handleFailed);
    pusher.connection.bind("error", handleError);

    return () => {
      pusher.connection.unbind("connected", handleConnected);
      pusher.connection.unbind("disconnected", handleDisconnected);
      pusher.connection.unbind("failed", handleFailed);
      pusher.connection.unbind("error", handleError);
    };
  }, [onConnected, onDisconnected, onConnectionError]);

  useEffect(() => {
    const current = channelApi();
    const handleSubscribed = () => {
      setJoined(chan);
    };
    const handleChannelError = () => {
      onConnectionError("Unable to subscribe to channel");
    };

    current.subscribed(handleSubscribed);
    current.error(handleChannelError);

    return () => {
      current.stopListening("pusher:subscription_succeeded", handleSubscribed);
      current.stopListening("pusher:subscription_error", handleChannelError);
    };
  }, [channelApi, chan, onConnectionError]);

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      return;
    }
    if (!joined) {
      return;
    }

    const payload = {
      text,
      sender: username,
    };

    setMsgs((prev) => [
      ...prev,
      {
        text,
        sender: username,
        timestamp: new Date(),
      },
    ]);

    const instance = echo<"reverb">();
    const pusher = instance.connector.pusher as Pusher;
    pusher.send_event(CLIENT_EVENT, payload, chan);

    setText("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-mono text-[#f3d5a3]">
        Connected to {server}
      </div>

      <div className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] w-full">
        <select
          value={chan}
          onChange={(event) =>
            setChan(event.target.value as (typeof CHANNELS)[number])
          }
          className="w-full flex-1 bg-[#242424] border-2 border-[#fbf0df]/40 text-[#fbf0df] font-mono text-base py-2 px-3 rounded-lg outline-none focus:border-[#f3d5a3] cursor-pointer"
        >
          {CHANNELS.map((channelName) => (
            <option key={channelName} value={channelName}>
              {channelName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 bg-[#1a1a1a] p-4 rounded-xl font-mono border-2 border-[#fbf0df] min-h-[300px] max-h-[500px] overflow-y-auto">
        {joined && (
          <div className="text-[#f3d5a3] text-sm font-bold text-center pb-2 border-b border-[#fbf0df]/20 mb-2">
            Channel: #{joined}
          </div>
        )}
        {msgs.length === 0 ? (
          <div className="text-[#fbf0df]/40 text-center py-8">
            {!joined
              ? "Subscribing to channel"
              : "No messages yet. Start chatting!"}
          </div>
        ) : (
          msgs.map((msg, index) => (
            <div
              key={`${msg.timestamp.getTime()}-${msg.sender}-${index}`}
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
        <div ref={endRef} />
      </div>

      {joined && (
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
        >
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
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

export function Chat() {
  const [server, setServer] = useState(() => getDefaultServer());
  const [state, setState] = useState<ConnectionState>("idle");
  const [target, setTarget] = useState<string | null>(null);
  const [name, setName] = useState("User");
  const [error, setError] = useState("");

  const connect = () => {
    if (state !== "idle") {
      return;
    }
    const config = buildEchoOptions(server);
    configureEcho(config.options);
    setTarget(config.normalized);
    setState("connecting");
    setError("");
  };

  const disconnect = () => {
    if (state === "idle") {
      return;
    }
    if (echoIsConfigured()) {
      echo<"reverb">().disconnect();
    }
    setState("idle");
    setTarget(null);
  };

  const handleConnected = useCallback(() => {
    setState("connected");
  }, []);

  const handleDisconnected = useCallback(() => {
    setState("idle");
    setTarget(null);
  }, []);

  const handleConnectionError = useCallback(
    (message: string) => {
      const host = target ?? server;
      setError(`Unable to connect to ${host}. ${message}`);
      setState("idle");
      setTarget(null);
    },
    [server, target],
  );

  return (
    <div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={server}
            onChange={(event) => setServer(event.target.value)}
            placeholder="ws://localhost:8080"
            className="flex-1 bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono focus:border-[#f3d5a3] outline-none"
            disabled={state !== "idle"}
          />
          {state === "connected" && (
            <button
              type="button"
              onClick={disconnect}
              className="bg-red-600 text-white border-0 px-5 py-3 rounded-lg font-bold transition-all duration-100 hover:bg-red-700 hover:-translate-y-px cursor-pointer whitespace-nowrap"
            >
              Disconnect
            </button>
          )}
          {state === "idle" && (
            <button
              type="button"
              onClick={connect}
              className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-3 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
            >
              Connect
            </button>
          )}
          {state === "connecting" && (
            <button
              type="button"
              className="bg-[#fbf0df]/60 text-[#1a1a1a] border-0 px-5 py-3 rounded-lg font-bold cursor-not-allowed whitespace-nowrap"
              disabled
            >
              Connecting...
            </button>
          )}
        </div>
        {error && <div className="text-red-400 text-sm font-mono">{error}</div>}
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className="flex-1 bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono focus:border-[#f3d5a3] outline-none"
          disabled={state !== "idle"}
        />
      </div>

      {target && (
        <ChatSession
          username={name}
          server={target}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onConnectionError={handleConnectionError}
        />
      )}

      {!target && (
        <div className="text-[#fbf0df]/60 text-center font-mono border-2 border-dashed border-[#fbf0df]/40 rounded-xl py-10">
          Connect to the server to start chatting.
        </div>
      )}
    </div>
  );
}
