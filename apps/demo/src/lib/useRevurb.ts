import { configureEcho, echo, useEchoPublic } from "@revurb/echo/react";
import type { EchoOptions } from "laravel-echo";
import type Pusher from "pusher-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RevurbConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

type UseRevurbOptions<TPayload> = {
  channel?: string;
  event?: string | string[];
  handler?: (payload: TPayload) => void;
  config: EchoOptions<"reverb">;
};

type MessageEnvelope<TPayload> = {
  id: string;
  payload: TPayload;
};

type ConnectionError = { error?: { message?: string } };

type UseRevurbResult<TPayload> = {
  status: RevurbConnectionState;
  statusLabels: Record<RevurbConnectionState, string>;
  error: string;
  channel: string;
  messages: MessageEnvelope<TPayload>[];
  connect: () => void;
  disconnect: () => void;
  join: (channelName: string) => void;
  leave: () => void;
  whisper: (event: string, payload: unknown) => void;
  send: (payload: TPayload) => void;
  seed: (payloads: TPayload[]) => void;
};

const STATUS_LABELS: Record<RevurbConnectionState, string> = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
};

let echoConfigured = false;

export function useRevurb<TPayload = Record<string, unknown>>({
  channel: initialChannel = "private-chat",
  event = "client-message",
  handler,
  config,
}: UseRevurbOptions<TPayload>): UseRevurbResult<TPayload> {
  if (!echoConfigured) {
    configureEcho(config);
    echoConfigured = true;
  }

  const [channelName, setChannelName] = useState(initialChannel);
  const [messages, setMessages] = useState<MessageEnvelope<TPayload>[]>([]);
  const [status, setStatus] = useState<RevurbConnectionState>("idle");
  const [error, setError] = useState("");
  const handlerRef = useRef(handler);
  const channelRef = useRef(channelName);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    channelRef.current = channelName;
    setMessages([]);
  }, [channelName]);

  const appendMessage = useCallback((payload: TPayload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMessages((prev) => [...prev, { payload, id }]);
  }, []);

  const handleIncoming = useCallback(
    (payload: TPayload) => {
      appendMessage(payload);
      handlerRef.current?.(payload);
    },
    [appendMessage],
  );

  const dependencies = useMemo(
    () => [channelName, handleIncoming],
    [channelName, handleIncoming],
  );

  // Handle private channels differently from public channels
  const isPrivateChannel = channelName.startsWith("private-");

  const {
    leave: leaveAllChannels,
    leaveChannel: leaveCurrentChannel,
    channel: channelApi,
  } = useEchoPublic<TPayload>(
    isPrivateChannel ? "" : channelName, // Don't use public hook for private channels
    event,
    handleIncoming,
    dependencies,
  );

  useEffect(() => {
    const instance = echo<"reverb">();
    let subscription:
      | {
          subscribed?: (callback: () => void) => void;
          error?: (callback: () => void) => void;
          listen?: (
            event: string,
            callback: (payload: TPayload) => void,
          ) => void;
        }
      | (() => {
          subscribed?: (callback: () => void) => void;
          error?: (callback: () => void) => void;
        })
      | undefined;
    const channelSnapshot = channelRef.current;

    if (isPrivateChannel) {
      // For private channels, use the echo instance directly
      subscription = instance.private(channelSnapshot);
      subscription?.listen?.(event as string, (e: TPayload) => {
        handleIncoming(e);
      });
    } else {
      // For public channels, use the channelApi
      subscription = channelApi();
    }

    const handleSubscribed = () => {
      setStatus("connected");
      setError("");
    };
    const handleSubscriptionError = () => {
      setError(`Unable to subscribe to ${channelRef.current}.`);
    };

    if (subscription) {
      subscription.subscribed?.(handleSubscribed);
      subscription.error?.(handleSubscriptionError);
    }

    return () => {
      const instance = echo<"reverb">();
      instance.leave(channelSnapshot);
    };
  }, [channelApi, event, handleIncoming, isPrivateChannel]);

  useEffect(() => {
    const instance = echo<"reverb">();
    const connection = (instance.connector.pusher as Pusher).connection;

    const handleConnecting = () => setStatus("connecting");
    const handleConnected = () => setStatus("connected");
    const handleDisconnected = () => setStatus("disconnected");
    const handleError = (payload?: ConnectionError) => {
      const detail = payload?.error?.message;
      const reason = detail ? detail : "Is the server running?";
      setError(
        `Unable to connect to ${config.wsHost}:${config.wsPort}. ${reason}`,
      );
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
  }, [config.wsHost, config.wsPort]);

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

  const join = useCallback(
    (nextChannel: string) => {
      if (!nextChannel || nextChannel === channelRef.current) {
        return;
      }
      leaveCurrentChannel();
      setChannelName(nextChannel);
      setStatus("connecting");
    },
    [leaveCurrentChannel],
  );

  const leave = useCallback(() => {
    leaveAllChannels();
    setMessages([]);
  }, [leaveAllChannels]);

  const send = useCallback(
    (payload: TPayload) => {
      appendMessage(payload);
      const instance = echo<"reverb">();
      const pusher = instance.connector.pusher as Pusher;
      pusher.send_event(event as string, payload, channelRef.current);
    },
    [appendMessage, event],
  );

  const whisper = useCallback((whisperEvent: string, payload: unknown) => {
    const instance = echo<"reverb">();
    const pusher = instance.connector.pusher as Pusher;
    pusher.send_event(`client-${whisperEvent}`, payload, channelRef.current);
  }, []);

  const seed = useCallback((payloads: TPayload[]) => {
    setMessages(
      payloads.map((payload) => ({
        payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })),
    );
  }, []);

  return useMemo(
    () => ({
      status,
      statusLabels: STATUS_LABELS,
      error,
      channel: channelName,
      messages,
      connect,
      disconnect,
      join,
      leave,
      whisper,
      send,
      seed,
    }),
    [
      status,
      error,
      channelName,
      messages,
      connect,
      disconnect,
      join,
      leave,
      whisper,
      send,
      seed,
    ],
  );
}
