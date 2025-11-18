import type { EchoOptionsWithDefaults } from "../types";

export abstract class Channel {
  options!: EchoOptionsWithDefaults;

  notificationCreatedEvent =
    ".Illuminate\\Notifications\\Events\\BroadcastNotificationCreated";

  abstract listen(event: string, callback: Function): this;

  listenForWhisper(event: string, callback: Function): this {
    return this.listen(`.client-${event}`, callback);
  }

  notification(callback: Function): this {
    return this.listen(this.notificationCreatedEvent, callback);
  }

  abstract stopListening(event: string, callback?: Function): this;

  stopListeningForNotification(callback: Function): this {
    return this.stopListening(this.notificationCreatedEvent, callback);
  }

  stopListeningForWhisper(event: string, callback?: Function): this {
    return this.stopListening(`.client-${event}`, callback);
  }

  abstract subscribed(callback: Function): this;

  abstract error(callback: Function): this;
}
