import type { PresenceChannel } from "./presence-channel";
import { PusherPrivateChannel } from "./pusher-private-channel";

export class PusherPresenceChannel
  extends PusherPrivateChannel
  implements PresenceChannel
{
  here(callback: (...args: unknown[]) => unknown): this {
    this.on("pusher:subscription_succeeded", (...args: unknown[]) => {
      const data = args[0] as Record<string, unknown>;
      callback(
        Object.keys(data.members as Record<string, unknown>).map(
          (k) => (data.members as Record<string, unknown>)[k],
        ),
      );
    });
    return this;
  }

  joining(callback: (...args: unknown[]) => unknown): this {
    this.on("pusher:member_added", (...args: unknown[]) => {
      const member = args[0] as Record<string, unknown>;
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
      const member = args[0] as Record<string, unknown>;
      callback(member.info);
    });
    return this;
  }
}
