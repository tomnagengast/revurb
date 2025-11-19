import { NullChannel } from "../channel/null-channel";
import { NullPresenceChannel } from "../channel/null-presence-channel";
import { NullPrivateChannel } from "../channel/null-private-channel";
import { Connector } from "./connector";

export class NullConnector extends Connector<"null"> {
  channels: Record<string, NullChannel> = {};

  connect(): void {
    //
  }

  override listen(
    name: string,
    event: string,
    callback: (...args: unknown[]) => unknown,
  ): NullChannel {
    return this.channel(name).listen(event, callback);
  }

  channel(name: string): NullChannel {
    if (!this.channels[name]) {
      this.channels[name] = new NullChannel();
    }

    return this.channels[name];
  }

  privateChannel(name: string): NullPrivateChannel {
    if (!this.channels[`private-${name}`]) {
      this.channels[`private-${name}`] = new NullPrivateChannel();
    }

    return this.channels[`private-${name}`] as NullPrivateChannel;
  }

  presenceChannel(name: string): NullPresenceChannel {
    if (!this.channels[`presence-${name}`]) {
      this.channels[`presence-${name}`] = new NullPresenceChannel();
    }

    return this.channels[`presence-${name}`] as NullPresenceChannel;
  }

  leave(_name: string): void {
    //
  }

  leaveChannel(_name: string): void {
    //
  }

  override encryptedPrivateChannel(name: string): NullPrivateChannel {
    if (!this.channels[`private-encrypted-${name}`]) {
      this.channels[`private-encrypted-${name}`] = new NullPrivateChannel();
    }
    return this.channels[`private-encrypted-${name}`] as NullPrivateChannel;
  }

  socketId(): string {
    return "fake-socket-id";
  }

  disconnect(): void {
    //
  }
}
