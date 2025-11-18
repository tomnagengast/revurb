import type { EchoOptions } from "laravel-echo";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRevurb } from "./lib/useRevurb";

type Message = {
  text: string;
  sender: string;
  timestamp: string;
};

const CLIENT_EVENT = "client-message";
const CHANNELS = [
  "private-chat",
  "private-general",
  "private-random",
  "private-tech",
  "private-gaming",
  "private-music",
  "private-announcements",
] as const;

export function Chat() {
  const [messageInput, setMessageInput] = useState("");
  const [username, setUsername] = useState("User");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const reverbHost = process.env.BUN_PUBLIC_REVERB_HOST ?? "localhost";
  const reverbPort =
    Number.parseInt(process.env.BUN_PUBLIC_REVERB_PORT ?? "8080", 10) || 8080;
  const reverbScheme = process.env.BUN_PUBLIC_REVERB_SCHEME ?? "https";
  const reverbAppKey = process.env.BUN_PUBLIC_REVERB_APP_KEY ?? "my-app-key";
  const reverbUrl = `${reverbScheme === "https" ? "wss" : "ws"}://${reverbHost}:${reverbPort}`;

  const config = useMemo<EchoOptions<"reverb">>(
    () => ({
      broadcaster: "reverb",
      key: reverbAppKey,
      wsHost: reverbHost,
      wsPort: reverbPort,
      wssPort: reverbPort,
      forceTLS: reverbScheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: "/broadcasting/auth",
    }),
    [reverbAppKey, reverbHost, reverbPort, reverbScheme],
  );

  const revurb = useRevurb<Message>({
    channel: CHANNELS[0],
    event: CLIENT_EVENT,
    config,
  });

  useEffect(() => {
    revurb.connect();
  }, [revurb.connect]);

  const lastMessageId =
    revurb.messages.length > 0
      ? (revurb.messages[revurb.messages.length - 1]?.id ?? "")
      : "";

  useEffect(() => {
    if (!lastMessageId) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(
          `/api/messages?channel=${encodeURIComponent(revurb.channel)}`,
        );
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { messages?: Message[] };
        if (Array.isArray(data.messages)) {
          revurb.seed(data.messages);
        }
      } catch (error) {
        console.error("Failed to load history", error);
      }
    };
    loadHistory();
  }, [revurb.channel, revurb.seed]);

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!messageInput.trim() || revurb.status !== "connected") {
      return;
    }

    const payload: Message = {
      text: messageInput,
      sender: username,
      timestamp: new Date().toISOString(),
    };

    revurb.send(payload);
    setMessageInput("");
  };

  const handleChannelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value as (typeof CHANNELS)[number];
    revurb.join(value);
  };

  const emptyStateMessage = () => {
    if (revurb.status !== "connected") {
      return "Connecting to server";
    }
    if (revurb.messages.length === 0) {
      return "No messages yet. Start chatting!";
    }
  };

  return (
    <div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-mono text-[#f3d5a3]">
            {revurb.statusLabels[revurb.status]} to {reverbUrl}
          </div>
          <button
            type="button"
            onClick={revurb.connect}
            className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-4 py-2 rounded-lg font-bold cursor-pointer"
            disabled={revurb.status === "connected"}
          >
            Connect
          </button>
          <button
            type="button"
            onClick={revurb.disconnect}
            className="bg-red-600 text-white border-0 px-4 py-2 rounded-lg font-bold cursor-pointer"
            disabled={revurb.status !== "connected"}
          >
            Disconnect
          </button>
        </div>
        {revurb.error && (
          <div className="text-red-400 text-sm font-mono">{revurb.error}</div>
        )}
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
          value={revurb.channel}
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
        {revurb.messages.length === 0 ? (
          <div className="text-[#fbf0df]/40 text-center py-8">
            {emptyStateMessage()}
          </div>
        ) : (
          revurb.messages.map((entry) => {
            const msg = entry.payload;
            const timestamp = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString()
              : "";
            return (
              <div
                key={entry.id}
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
          disabled={revurb.status !== "connected"}
        />
        <button
          type="submit"
          className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
          disabled={revurb.status !== "connected"}
        >
          Send
        </button>
      </form>
    </div>
  );
}
