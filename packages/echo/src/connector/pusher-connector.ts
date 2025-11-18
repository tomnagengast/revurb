import type Pusher from "pusher-js";
import {
  PusherChannel,
  PusherEncryptedPrivateChannel,
  PusherPresenceChannel,
  PusherPrivateChannel,
} from "../channel";
import { Connector } from "./connector";

type AnyPusherChannel =
  | PusherChannel
  | PusherPrivateChannel
  | PusherEncryptedPrivateChannel
  | PusherPresenceChannel;

export class PusherConnector extends Connector {
  pusher!: Pusher;
  channels: Record<string, AnyPusherChannel> = {};

  connect(): void {
    if (typeof this.options.client !== "undefined") {
      this.pusher = this.options.client as Pusher;
    } else if (this.options.Pusher) {
      this.pusher = new this.options.Pusher(this.options.key, this.options);
    } else if (
      typeof window !== "undefined" &&
      typeof (window as any).Pusher !== "undefined"
    ) {
      this.pusher = new (window as any).Pusher(this.options.key, this.options);
    } else {
      throw new Error(
        "Pusher client not found. Should be globally available or passed via options.client",
      );
    }
  }

  signin(): void {
    this.pusher.signin();
  }

  listen(name: string, event: string, callback: Function): AnyPusherChannel {
    return this.channel(name).listen(event, callback);
  }

  channel(name: string): AnyPusherChannel {
    if (!this.channels[name]) {
      this.channels[name] = new PusherChannel(this.pusher, name, this.options);
    }
    return this.channels[name];
  }

  privateChannel(name: string): PusherPrivateChannel {
    if (!this.channels[`private-${name}`]) {
      this.channels[`private-${name}`] = new PusherPrivateChannel(
        this.pusher,
        `private-${name}`,
        this.options,
      );
    }
    return this.channels[`private-${name}`] as PusherPrivateChannel;
  }

  encryptedPrivateChannel(name: string): PusherEncryptedPrivateChannel {
    if (!this.channels[`private-encrypted-${name}`]) {
      this.channels[`private-encrypted-${name}`] =
        new PusherEncryptedPrivateChannel(
          this.pusher,
          `private-encrypted-${name}`,
          this.options,
        );
    }
    return this.channels[
      `private-encrypted-${name}`
    ] as PusherEncryptedPrivateChannel;
  }

  presenceChannel(name: string): PusherPresenceChannel {
    if (!this.channels[`presence-${name}`]) {
      this.channels[`presence-${name}`] = new PusherPresenceChannel(
        this.pusher,
        `presence-${name}`,
        this.options,
      );
    }
    return this.channels[`presence-${name}`] as PusherPresenceChannel;
  }

  leave(name: string): void {
    const channels = [
      name,
      `private-${name}`,
      `private-encrypted-${name}`,
      `presence-${name}`,
    ];
    channels.forEach((name: string) => {
      this.leaveChannel(name);
    });
  }

  leaveChannel(name: string): void {
    if (this.channels[name]) {
      this.channels[name].unsubscribe();
      delete this.channels[name];
    }
  }

  socketId(): string {
    return this.pusher.connection.socket_id;
  }

  disconnect(): void {
    this.pusher.disconnect();
  }
}
