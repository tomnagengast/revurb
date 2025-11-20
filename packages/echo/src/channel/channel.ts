import type { BroadcastDriver, EchoOptionsWithDefaults } from "../types";

export abstract class Channel {
  options!: EchoOptionsWithDefaults<BroadcastDriver>;

  notificationCreatedEvent =
    ".Illuminate\\Notifications\\Events\\BroadcastNotificationCreated";

  abstract listen(
    event: string,
    callback: (...args: unknown[]) => unknown,
  ): this;

  listenForWhisper(
    event: string,
    callback: (...args: unknown[]) => unknown,
  ): this {
    return this.listen(`.client-${event}`, callback);
  }

  notification(callback: (...args: unknown[]) => unknown): this {
    return this.listen(this.notificationCreatedEvent, callback);
  }

  abstract stopListening(
    event: string,
    callback?: (...args: unknown[]) => unknown,
  ): this;

  stopListeningForNotification(
    callback: (...args: unknown[]) => unknown,
  ): this {
    return this.stopListening(this.notificationCreatedEvent, callback);
  }

  stopListeningForWhisper(
    event: string,
    callback?: (...args: unknown[]) => unknown,
  ): this {
    return this.stopListening(`.client-${event}`, callback);
  }

  abstract subscribed(callback: (...args: unknown[]) => unknown): this;

  abstract error(callback: (...args: unknown[]) => unknown): this;
}
