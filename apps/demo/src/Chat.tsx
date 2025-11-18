import { configureEcho, echo, useEcho } from "@revurb/echo/react";
import type Pusher from "pusher-js";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Message = {
  text: string;
  sender: string;
  timestamp: string;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

const CLIENT_EVENT = "client-message";
const CHANNELS = [
  "chat",
  "general",
  "random",
  "tech",
  "gaming",
  "music",
  "announcements",
] as const;

let echoConfigured = false;

export function Chat() {
  const [messageInput, setMessageInput] = useState("");
  const [username, setUsername] = useState("User");
  const [currentChannel, setCurrentChannel] = useState<string>(CHANNELS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const reverbHost = import.meta.env.BUN_PUBLIC_REVERB_HOST ?? "localhost";
  const reverbPort =
    Number.parseInt(import.meta.env.BUN_PUBLIC_REVERB_PORT ?? "8080", 10) ||
    8080;
  const reverbScheme = import.meta.env.BUN_PUBLIC_REVERB_SCHEME ?? "http";
  const reverbAppKey =
    import.meta.env.BUN_PUBLIC_REVERB_APP_KEY ?? "my-app-key";
  const reverbUrl = `${reverbScheme === "https" ? "wss" : "ws"}://${reverbHost}:${reverbPort}`;

  // Configure Echo once
  if (!echoConfigured) {
    configureEcho({
      broadcaster: "reverb",
      key: reverbAppKey,
      wsHost: reverbHost,
      wsPort: reverbPort,
      wssPort: reverbPort,
      forceTLS: reverbScheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: "/broadcasting/auth",
    });
    echoConfigured = true;
  }

  // Handle incoming messages
  const handleMessage = useCallback((payload: Message) => {
    setMessages((prev) => [...prev, payload]);
  }, []);

  // Use @revurb/echo hook for channel subscription
  const { leave: leaveChannel } = useEcho<Message, "reverb", "private">(
    currentChannel,
    CLIENT_EVENT,
    handleMessage,
    [currentChannel, handleMessage],
    "private",
  );

  // Track connection status
  useEffect(() => {
    const instance = echo<"reverb">();
    const connection = (instance.connector.pusher as Pusher).connection;

    const handleConnecting = () => setStatus("connecting");
    const handleConnected = () => {
      setStatus("connected");
      setError("");
    };
    const handleDisconnected = () => setStatus("disconnected");
    const handleError = (payload?: { error?: { message?: string } }) => {
      const detail = payload?.error?.message;
      const reason = detail ? detail : "Is the server running?";
      setError(`Unable to connect to ${reverbHost}:${reverbPort}. ${reason}`);
      setStatus("disconnected");
    };

    connection.bind("connecting", handleConnecting);
    connection.bind("connected", handleConnected);
    connection.bind("disconnected", handleDisconnected);
    connection.bind("failed", handleError);
    connection.bind("error", handleError);

    return () => {
      connection.unbind("connecting", handleConnecting);
      connection.unbind("connected", handleConnected);
      connection.unbind("disconnected", handleDisconnected);
      connection.unbind("failed", handleError);
      connection.unbind("error", handleError);
    };
  }, [reverbPort]);

  // Auto-connect on mount
  useEffect(() => {
    const instance = echo<"reverb">();
    const pusher = instance.connector.pusher as Pusher;
    pusher.connect();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Clear messages when channel changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: setMessages is stable but we need to run on currentChannel change
  useEffect(() => {
    setMessages([]);
  }, [currentChannel]);

  const connect = useCallback(() => {
    const instance = echo<"reverb">();
    const pusher = instance.connector.pusher as Pusher;
    setError("");
    setStatus("connecting");
    pusher.connect();
  }, []);

  const disconnect = useCallback(() => {
    const instance = echo<"reverb">();
    instance.disconnect();
    setStatus("idle");
    setError("");
  }, []);

  const sendMessage = useCallback(
    (payload: Message) => {
      setMessages((prev) => [...prev, payload]);
      const instance = echo<"reverb">();
      const pusher = instance.connector.pusher as Pusher;
      pusher.send_event(CLIENT_EVENT, payload, `private-${currentChannel}`);
    },
    [currentChannel],
  );

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!messageInput.trim() || status !== "connected") return;

    const payload: Message = {
      text: messageInput,
      sender: username,
      timestamp: new Date().toISOString(),
    };

    sendMessage(payload);
    setMessageInput("");
  };

  const handleChannelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value as (typeof CHANNELS)[number];
    leaveChannel();
    setCurrentChannel(value);
  };

  const emptyStateMessage = () => {
    if (status !== "connected") return "Connecting to server";
    if (messages.length === 0) return "No messages yet. Start chatting!";
  };

  const statusLabels: Record<ConnectionStatus, string> = {
    idle: "Idle",
    connecting: "Connecting",
    connected: "Connected",
    disconnected: "Disconnected",
  };

  return (
    <div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-mono text-[#f3d5a3]">
            {statusLabels[status]} to {reverbUrl}
          </div>
          <button
            type="button"
            onClick={connect}
            className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-4 py-2 rounded-lg font-bold cursor-pointer"
            disabled={status === "connected"}
          >
            Connect
          </button>
          <button
            type="button"
            onClick={disconnect}
            className="bg-red-600 text-white border-0 px-4 py-2 rounded-lg font-bold cursor-pointer"
            disabled={status !== "connected"}
          >
            Disconnect
          </button>
        </div>
        {error && <div className="text-red-400 text-sm font-mono">{error}</div>}
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Your name"
          className="flex-1 bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono focus:border-[#f3d5a3] outline-none"
        />
      </div>

      <div className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] w-full">
        <select
          value={currentChannel}
          onChange={handleChannelChange}
          className="w-full flex-1 bg-[#242424] border-2 border-[#fbf0df]/40 text-[#fbf0df] font-mono text-base py-2 px-3 rounded-lg outline-none focus:border-[#f3d5a3] cursor-pointer"
        >
          {CHANNELS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 bg-[#1a1a1a] p-4 rounded-xl font-mono border-2 border-[#fbf0df] min-h-[300px] max-h-[500px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-[#fbf0df]/40 text-center py-8">
            {emptyStateMessage()}
          </div>
        ) : (
          messages.map((msg, index) => {
            const timestamp = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString()
              : "";
            return (
              <div
                key={`${msg.timestamp}-${index}`}
                className="flex flex-col items-start gap-1 bg-[#242424] p-3 rounded-lg border border-[#fbf0df]/20"
              >
                <div className="text-[#fbf0df]">{msg.text}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">
                    {msg.sender}
                  </span>
                  <span className="text-xs text-gray-500">{timestamp}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
      >
        <input
          type="text"
          value={messageInput}
          onChange={(event) => setMessageInput(event.target.value)}
          placeholder="Type a message..."
          className="w-full flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
          disabled={status !== "connected"}
        />
        <button
          type="submit"
          className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
          disabled={status !== "connected"}
        >
          Send
        </button>
      </form>
    </div>
  );
}
