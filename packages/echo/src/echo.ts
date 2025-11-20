import type { Channel, PresenceChannel } from "./channel";
import { NullConnector, PusherConnector, SocketIoConnector } from "./connector";
import type { BroadcastDriver, Broadcaster, EchoOptions } from "./types";
import { isConstructor, registerAllInterceptors } from "./util";

export class Echo<TBroadcaster extends BroadcastDriver = "reverb"> {
  connector!: Broadcaster[TBroadcaster]["connector"];
  options: EchoOptions<TBroadcaster>;

  constructor(options: EchoOptions<TBroadcaster>) {
    this.options = options;
    this.connect();

    if (!this.options.withoutInterceptors) {
      this.registerInterceptors();
    }
  }

  channel(channel: string): Channel {
    return this.connector.channel(channel);
  }

  connect(): void {
    const broadcaster = this.options.broadcaster;

    if (broadcaster === "reverb") {
      const options = {
        ...this.options,
        broadcaster: "reverb",
        cluster: "",
      } as EchoOptions<"reverb">;
      // biome-ignore lint/suspicious/noExplicitAny: Connector type matching
      this.connector = new PusherConnector(options) as any;
    } else if (broadcaster === "pusher") {
      const options = this.options as unknown as EchoOptions<"reverb">;
      // biome-ignore lint/suspicious/noExplicitAny: Connector type matching
      this.connector = new PusherConnector(options) as any;
    } else if (broadcaster === "ably") {
      const options = {
        ...this.options,
        cluster: "",
        broadcaster: "pusher",
      } as unknown as EchoOptions<"reverb">;
      // biome-ignore lint/suspicious/noExplicitAny: Connector type matching
      this.connector = new PusherConnector(options) as any;
    } else if (broadcaster === "socket.io") {
      const options = this.options as EchoOptions<"socket.io">;
      // biome-ignore lint/suspicious/noExplicitAny: Connector type matching
      this.connector = new SocketIoConnector(options) as any;
    } else if (broadcaster === "null") {
      const options = this.options as EchoOptions<"null">;
      // biome-ignore lint/suspicious/noExplicitAny: Connector type matching
      this.connector = new NullConnector(options) as any;
    } else if (
      typeof broadcaster === "function" &&
      isConstructor(broadcaster)
    ) {
      // biome-ignore lint/suspicious/noExplicitAny: Custom constructor type handling
      this.connector = new (broadcaster as any)(this.options);
    } else {
      throw new Error(
        `Broadcaster ${typeof broadcaster} ${String(broadcaster)} is not supported.`,
      );
    }
  }

  disconnect(): void {
    this.connector.disconnect();
  }

  join(channel: string): PresenceChannel {
    return this.connector.presenceChannel(channel);
  }

  leave(channel: string): void {
    this.connector.leave(channel);
  }

  leaveChannel(channel: string): void {
    this.connector.leaveChannel(channel);
  }

  leaveAllChannels(): void {
    const connector = this.connector as { channels?: Record<string, unknown> };
    if (connector.channels) {
      for (const channel in connector.channels) {
        this.leaveChannel(channel);
      }
    }
  }

  listen(
    channel: string,
    event: string,
    callback: (...args: unknown[]) => unknown,
  ): Channel {
    return this.connector.listen(channel, event, callback);
  }

  private(channel: string): Channel {
    return this.connector.privateChannel(channel);
  }

  encryptedPrivate(channel: string): Channel {
    return this.connector.encryptedPrivateChannel(channel);
  }

  socketId(): string | undefined {
    return this.connector.socketId();
  }

  /**
   * Register 3rd party request interceptors. These are used to automatically
   * send a connections socket id to a Laravel app with a X-Socket-Id header.
   */
  registerInterceptors(): void {
    registerAllInterceptors(() => this.socketId());
  }
}

export default Echo;
