import { PusherPrivateChannel } from "./pusher-private-channel";

export interface PresenceChannel {
  here(callback: Function): this;
  joining(callback: Function): this;
  whisper(eventName: string, data: Record<string, any>): this;
  leaving(callback: Function): this;
}

export class PusherPresenceChannel
  extends PusherPrivateChannel
  implements PresenceChannel
{
  here(callback: Function): this {
    this.on("pusher:subscription_succeeded", (data: Record<string, any>) => {
      callback(Object.keys(data.members).map((k) => data.members[k]));
    });
    return this;
  }

  joining(callback: Function): this {
    this.on("pusher:member_added", (member: Record<string, any>) => {
      callback(member.info);
    });
    return this;
  }

  override whisper(eventName: string, data: Record<string, any>): this {
    const channel = this.pusher.channels.channels[this.name];
    if (channel) {
      channel.trigger(`client-${eventName}`, data);
    }
    return this;
  }

  leaving(callback: Function): this {
    this.on("pusher:member_removed", (member: Record<string, any>) => {
      callback(member.info);
    });
    return this;
  }
}
