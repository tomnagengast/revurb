import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

interface Message {
	text: string;
	sender: string;
	timestamp: Date;
}

export function Chat() {
	const [connected, setConnected] = useState(false);
	const [channel, setChannel] = useState("chat");
	const [messages, setMessages] = useState<Message[]>([]);
	const [messageInput, setMessageInput] = useState("");
	const [username, setUsername] = useState("User");
	const wsRef = useRef<WebSocket | null>(null);
	const channelRef = useRef(channel);
	const currentChannelRef = useRef(channel);
	const channelInputRef = useRef<HTMLInputElement>(null);
	const messageInputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		channelRef.current = channel;
		currentChannelRef.current = channel;
	}, [channel]);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	const connect = () => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			return;
		}

		const wsUrl =
			"ws://localhost:8080/app/my-app-key?protocol=7&client=js&version=8.4.0";
		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			setConnected(true);
		};

		ws.onmessage = (event) => {
			const message = JSON.parse(event.data);

			if (message.event === "pusher:connection_established") {
				const data = JSON.parse(message.data);
				console.log("Connected with socket ID:", data.socket_id);
				subscribeToChannel(ws, channelRef.current);
			}

			if (message.event === "pusher:ping") {
				const pongMessage = {
					event: "pusher:pong",
				};
				ws.send(JSON.stringify(pongMessage));
			}

			if (message.event === "pusher_internal:subscription_succeeded") {
				console.log("Subscribed to channel:", message.channel);
			}

			if (message.event?.startsWith("client-")) {
				const eventData =
					typeof message.data === "string"
						? JSON.parse(message.data)
						: message.data;
				setMessages((prev) => [
					...prev,
					{
						text: eventData.text || "",
						sender: eventData.sender || "Unknown",
						timestamp: new Date(),
					},
				]);
			}
		};

		ws.onerror = (error) => {
			console.error("WebSocket error:", error);
		};

		ws.onclose = () => {
			setConnected(false);
		};

		wsRef.current = ws;
	};

	const disconnect = () => {
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
			setConnected(false);
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
		if (!messageInput.trim() || !connected) {
			return;
		}

		const clientEvent = {
			event: "client-message",
			channel: channel,
			data: {
				text: messageInput,
				sender: username,
			},
		};

		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(clientEvent));
			setMessageInput("");
		}
	};

	return (
		<div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
			{/* Connection controls */}
			<div className="flex items-center gap-2">
				<input
					type="text"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Your name"
					className="flex-1 bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono focus:border-[#f3d5a3] outline-none"
					disabled={connected}
				/>
				{connected ? (
					<button
						type="button"
						onClick={disconnect}
						className="bg-red-600 text-white border-0 px-5 py-3 rounded-lg font-bold transition-all duration-100 hover:bg-red-700 hover:-translate-y-px cursor-pointer whitespace-nowrap"
					>
						Disconnect
					</button>
				) : (
					<button
						type="button"
						onClick={connect}
						className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-3 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
					>
						Connect
					</button>
				)}
			</div>

			{/* Channel join form */}
			{connected && (
				<form
					onSubmit={handleJoinChannel}
					className="flex items-center gap-2 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
				>
					<input
						ref={channelInputRef}
						type="text"
						name="channel"
						defaultValue={channel}
						placeholder="Join channel (e.g., chat)..."
						className="w-full flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
					/>
					<button
						type="submit"
						className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
					>
						Join
					</button>
				</form>
			)}

			{/* Messages display */}
			<div className="flex flex-col gap-2 bg-[#1a1a1a] p-4 rounded-xl font-mono border-2 border-[#fbf0df] min-h-[300px] max-h-[500px] overflow-y-auto">
				{messages.length === 0 ? (
					<div className="text-[#fbf0df]/40 text-center py-8">
						{connected
							? "No messages yet. Start chatting!"
							: "Connect to start chatting"}
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
			{connected && (
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
