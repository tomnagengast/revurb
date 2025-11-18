import { PusherChannel } from "./pusher-channel";

export class PusherPrivateChannel extends PusherChannel {
  whisper(eventName: string, data: Record<string, any>): this {
    const channel = this.pusher.channels.channels[this.name];
    if (channel) {
      channel.trigger(`client-${eventName}`, data);
    }
    return this;
  }
}
