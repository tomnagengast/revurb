import { PusherPrivateChannel } from "./pusher-private-channel";

export interface PresenceChannel {
  here(callback: (...args: unknown[]) => unknown): this;
  joining(callback: (...args: unknown[]) => unknown): this;
  whisper(eventName: string, data: Record<string, unknown>): this;
  leaving(callback: (...args: unknown[]) => unknown): this;
}

export class PusherPresenceChannel
  extends PusherPrivateChannel
  implements PresenceChannel
{
  here(callback: (...args: unknown[]) => unknown): this {
    this.on("pusher:subscription_succeeded", (...args: unknown[]) => {
      const data = args[0] as { members: Record<string, unknown> };
      callback(Object.keys(data.members).map((k) => data.members[k]));
    });
    return this;
  }

  joining(callback: (...args: unknown[]) => unknown): this {
    this.on("pusher:member_added", (...args: unknown[]) => {
      const member = args[0] as { info: unknown };
      callback(member.info);
    });
    return this;
  }

  override whisper(eventName: string, data: Record<string, unknown>): this {
    const channel = this.pusher.channels.channels[this.name];
    if (channel) {
      channel.trigger(`client-${eventName}`, data);
    }
    return this;
  }

  leaving(callback: (...args: unknown[]) => unknown): this {
    this.on("pusher:member_removed", (...args: unknown[]) => {
      const member = args[0] as { info: unknown };
      callback(member.info);
    });
    return this;
  }
}
