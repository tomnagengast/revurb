import type Pusher from "pusher-js";
import type { Options as PusherJsOptions } from "pusher-js";
import type {
  NullChannel,
  NullEncryptedPrivateChannel,
  NullPresenceChannel,
  NullPrivateChannel,
  PusherChannel,
  PusherEncryptedPrivateChannel,
  PusherPresenceChannel,
  PusherPrivateChannel,
} from "./channel";
import type { NullConnector, PusherConnector } from "./connector";

// Placeholder types for socket.io (to be implemented in Phase 2)
// biome-ignore lint/suspicious/noExplicitAny: Placeholder for Phase 2 implementation
type SocketIoConnector = any;
// biome-ignore lint/suspicious/noExplicitAny: Placeholder for Phase 2 implementation
type SocketIoChannel = any;
// biome-ignore lint/suspicious/noExplicitAny: Placeholder for Phase 2 implementation
type SocketIoPrivateChannel = any;
// biome-ignore lint/suspicious/noExplicitAny: Placeholder for Phase 2 implementation
type SocketIoPresenceChannel = any;

type CustomOmit<T, K extends PropertyKey> = {
  [P in keyof T as Exclude<P, K>]: T[P];
};

// biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility - matches upstream
type Constructor<T = Record<string, never>> = new (...args: any[]) => T;

/**
 * Specifies the broadcaster configuration for each driver type.
 * This type maps each broadcaster driver to its connector, channel types, and options.
 */
export type Broadcaster = {
  reverb: {
    connector: PusherConnector;
    public: PusherChannel;
    private: PusherPrivateChannel;
    encrypted: PusherEncryptedPrivateChannel;
    presence: PusherPresenceChannel;
    options: GenericOptions<"reverb"> &
      Partial<CustomOmit<PusherOptions<"reverb">, "cluster">>;
  };
  pusher: {
    connector: PusherConnector;
    public: PusherChannel;
    private: PusherPrivateChannel;
    encrypted: PusherEncryptedPrivateChannel;
    presence: PusherPresenceChannel;
    options: GenericOptions<"pusher"> & Partial<PusherOptions<"pusher">>;
  };
  ably: {
    connector: PusherConnector;
    public: PusherChannel;
    private: PusherPrivateChannel;
    encrypted: PusherEncryptedPrivateChannel;
    presence: PusherPresenceChannel;
    options: GenericOptions<"ably"> & Partial<PusherOptions<"ably">>;
  };
  "socket.io": {
    connector: SocketIoConnector;
    public: SocketIoChannel;
    private: SocketIoPrivateChannel;
    encrypted: never;
    presence: SocketIoPresenceChannel;
    options: GenericOptions<"socket.io">;
  };
  null: {
    connector: NullConnector;
    public: NullChannel;
    private: NullPrivateChannel;
    encrypted: NullEncryptedPrivateChannel;
    presence: NullPresenceChannel;
    options: GenericOptions<"null">;
  };
  function: {
    // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
    connector: any;
    // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
    public: any;
    // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
    private: any;
    // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
    encrypted: any;
    // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
    presence: any;
    options: GenericOptions<"function">;
  };
};

/**
 * Broadcast driver names (excluding the function constructor type).
 */
export type BroadcastDriver = Exclude<keyof Broadcaster, "function">;

/**
 * Generic options that apply to all broadcasters.
 */
type GenericOptions<TBroadcaster extends keyof Broadcaster> = {
  /**
   * The broadcast connector.
   */
  broadcaster: TBroadcaster extends "function"
    ? Constructor<InstanceType<Broadcaster[TBroadcaster]["connector"]>>
    : TBroadcaster;

  auth?: {
    headers: Record<string, string>;
  };
  authEndpoint?: string;
  userAuthentication?: {
    endpoint: string;
    headers: Record<string, string>;
  };
  csrfToken?: string | null;
  bearerToken?: string | null;
  host?: string | null;
  key?: string | null;
  namespace?: string | false;
  withoutInterceptors?: boolean;

  // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
  [key: string]: any;
};

/**
 * Echo options for a specific broadcaster type.
 * This type is derived from the Broadcaster mapped type.
 */
export type EchoOptions<TBroadcaster extends keyof Broadcaster> =
  Broadcaster[TBroadcaster]["options"];

/**
 * Echo options with all defaults applied.
 */
export type EchoOptionsWithDefaults<
  TBroadcaster extends BroadcastDriver = BroadcastDriver,
> = {
  broadcaster: TBroadcaster;
  auth: {
    headers: Record<string, string>;
  };
  authEndpoint: string;
  userAuthentication: {
    endpoint: string;
    headers: Record<string, string>;
  };
  csrfToken: string | null;
  bearerToken: string | null;
  host: string | null;
  key: string | null;
  namespace: string | false;

  // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
  [key: string]: any;
};

/**
 * Pusher-specific options that extend EchoOptionsWithDefaults.
 */
export type PusherOptions<TBroadcastDriver extends BroadcastDriver> =
  EchoOptionsWithDefaults<TBroadcastDriver> & {
    key: string;
    Pusher?: typeof Pusher;
  } & PusherJsOptions;
