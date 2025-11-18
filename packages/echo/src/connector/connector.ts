import type { Channel, PresenceChannel } from "../channel";
import type {
  BroadcastDriver,
  EchoOptions,
  EchoOptionsWithDefaults,
} from "../types";

export abstract class Connector<
  TBroadcaster extends BroadcastDriver = "reverb",
> {
  static readonly _defaultOptions = {
    auth: {
      headers: {},
    },
    authEndpoint: "/broadcasting/auth",
    userAuthentication: {
      endpoint: "/broadcasting/user-auth",
      headers: {},
    },
    csrfToken: null,
    bearerToken: null,
    host: null,
    key: null,
    namespace: "App.Events",
  } as const;

  options!: EchoOptionsWithDefaults;

  constructor(options: EchoOptions<TBroadcaster>) {
    this.setOptions(options);
    this.connect();
  }

  protected setOptions(options: EchoOptions<TBroadcaster>): void {
    this.options = {
      ...Connector._defaultOptions,
      ...options,
      key: options.key ?? "",
    };

    let token = this.csrfToken();

    if (token) {
      this.options.auth.headers["X-CSRF-TOKEN"] = token;
      this.options.userAuthentication.headers["X-CSRF-TOKEN"] = token;
    }

    token = this.options.bearerToken;

    if (token) {
      this.options.auth.headers.Authorization = `Bearer ${token}`;
      this.options.userAuthentication.headers.Authorization = `Bearer ${token}`;
    }
  }

  protected csrfToken(): string | null {
    if (
      typeof window !== "undefined" &&
      (window as unknown as Record<string, unknown>).Laravel
    ) {
      const laravel = (window as unknown as Record<string, unknown>)
        .Laravel as Record<string, unknown>;
      if (laravel.csrfToken) {
        return laravel.csrfToken as string;
      }
    }

    if (this.options.csrfToken) {
      return this.options.csrfToken;
    }

    if (
      typeof document !== "undefined" &&
      typeof document.querySelector === "function"
    ) {
      return (
        document
          .querySelector('meta[name="csrf-token"]')
          ?.getAttribute("content") ?? null
      );
    }

    return null;
  }

  abstract connect(): void;

  abstract channel(channel: string): Channel;

  abstract privateChannel(channel: string): Channel;

  abstract presenceChannel(channel: string): PresenceChannel;

  abstract leave(channel: string): void;

  abstract leaveChannel(channel: string): void;

  abstract socketId(): string | undefined;

  abstract disconnect(): void;
}
