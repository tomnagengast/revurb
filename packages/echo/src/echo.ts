import type { Channel, PresenceChannel } from "./channel";
import { PusherConnector } from "./connector";
import type { BroadcastDriver, EchoOptions } from "./types";

export class Echo<TBroadcaster extends BroadcastDriver = "reverb"> {
  connector!: PusherConnector;
  options: EchoOptions<TBroadcaster>;

  constructor(options: EchoOptions<TBroadcaster>) {
    this.options = options;
    this.connect();
  }

  channel(channel: string): Channel {
    return this.connector.channel(channel);
  }

  connect(): void {
    if (this.options.broadcaster === "reverb") {
      this.connector = new PusherConnector({
        ...this.options,
        broadcaster: "reverb",
        cluster: "",
      } as EchoOptions<"reverb">);
    } else if (this.options.broadcaster === "pusher") {
      this.connector = new PusherConnector(
        this.options as EchoOptions<"reverb">,
      );
    } else {
      throw new Error(
        `Broadcaster ${this.options.broadcaster} is not supported.`,
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
    for (const channel in this.connector.channels) {
      this.leaveChannel(channel);
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
}

export default Echo;
