import { type FormEvent, useEffect, useRef, useState } from "react";

interface Message {
  text: string;
  sender: string;
  timestamp: Date;
}

export function Chat() {
  const removeTrailingSlash = (value: string) => value.replace(/\/+$/, "");
  const getDefaultServer = () => {
    // Use a build-time constant or import.meta.env if configured
    const port = 8080; // Or use import.meta.env.VITE_REVERB_PORT if using Vite
    return `ws://localhost:${port}`;
  };
  const normalizeServer = (value: string) => {
    const trimmed = value.trim();
    const fallback = trimmed || getDefaultServer();
    if (/^wss?:\/\//i.test(fallback)) {
      return removeTrailingSlash(fallback);
    }
    if (/^https?:\/\//i.test(fallback)) {
      const withoutProtocol = fallback.replace(/^https?:\/\//i, "");
      if (fallback.toLowerCase().startsWith("https")) {
        return `wss://${removeTrailingSlash(withoutProtocol)}`;
      }
      return `ws://${removeTrailingSlash(withoutProtocol)}`;
    }
    return `ws://${removeTrailingSlash(fallback)}`;
  };
  const [connected, setConnected] = useState(false);
  const [channel, setChannel] = useState("chat");
  const [joinedChannel, setJoinedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [username, setUsername] = useState("User");
  const [server, setServer] = useState(() => getDefaultServer());
  const [connectionError, setConnectionError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const channelRef = useRef(channel);
  const currentChannelRef = useRef(channel);
  const usernameRef = useRef(username);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    channelRef.current = channel;
    currentChannelRef.current = channel;
  }, [channel]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: We need to scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsBase = normalizeServer(server);
    const ws = new WebSocket(
      `${wsBase}/app/my-app-key?protocol=7&client=js&version=8.4.0`,
    );

    ws.onopen = () => {
      setConnected(true);
      setConnectionError("");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("WebSocket message received:", message);

      if (message.event === "pusher:connection_established") {
        const data = JSON.parse(message.data);
        console.log("Connected with socket ID:", data.socket_id);
        subscribeToChannel(ws, channelRef.current);
      }

      if (message.event === "pusher:ping") {
        const pongMessage = {
          event: "pusher:pong",
          data: {},
        };
        ws.send(JSON.stringify(pongMessage));
        console.log("Sent pong response");
      }

      if (message.event === "pusher_internal:subscription_succeeded") {
        console.log("Subscribed to channel:", message.channel);
        setJoinedChannel(message.channel);
      }

      // Handle client messages - only from the current channel
      if (
        message.event === "client-message" &&
        message.channel === channelRef.current
      ) {
        console.log("Client message received:", message);
        const eventData =
          typeof message.data === "string"
            ? JSON.parse(message.data)
            : message.data;

        // Only add messages from other users (not our own echoed messages)
        if (eventData.sender !== usernameRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              text: eventData.text || "",
              sender: eventData.sender || "Unknown",
              timestamp: new Date(),
            },
          ]);
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionError(
        `Unable to connect to ${wsBase}. Is the server running?`,
      );
    };

    ws.onclose = () => {
      setConnected(false);
      setConnectionError((prev) => prev || "Connection closed.");
    };

    wsRef.current = ws;
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
      setJoinedChannel(null);
      setMessages([]);
    }
  };

  const subscribeToChannel = (ws: WebSocket, channelName: string) => {
    const subscribeMessage = {
      event: "pusher:subscribe",
      data: {
        channel: channelName,
      },
    };
    ws.send(JSON.stringify(subscribeMessage));
  };

  const unsubscribeFromChannel = (ws: WebSocket, channelName: string) => {
    const unsubscribeMessage = {
      event: "pusher:unsubscribe",
      data: {
        channel: channelName,
      },
    };
    ws.send(JSON.stringify(unsubscribeMessage));
  };

  const handleJoinChannel = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const channelName = (formData.get("channel") as string) || "chat";

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const previousChannel = currentChannelRef.current;
      if (previousChannel !== channelName) {
        unsubscribeFromChannel(wsRef.current, previousChannel);
        setMessages([]);
      }
      subscribeToChannel(wsRef.current, channelName);
      setChannel(channelName);
      currentChannelRef.current = channelName;
      channelRef.current = channelName;
    }
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

    const clientEvent = {
      event: "client-message",
      channel: joinedChannel,
      data: messageData,
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(clientEvent));
      setMessageInput("");
    }
  };

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
