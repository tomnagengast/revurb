import type Pusher from "pusher-js";
import type { Channel as BasePusherChannel } from "pusher-js";
import type { EchoOptionsWithDefaults } from "../types";
import { EventFormatter } from "../util/event-formatter";
import { Channel } from "./channel";

export class PusherChannel extends Channel {
  pusher: Pusher;
  name: string;
  eventFormatter: EventFormatter;
  subscription!: BasePusherChannel;

  constructor(pusher: Pusher, name: string, options: EchoOptionsWithDefaults) {
    super();
    this.name = name;
    this.pusher = pusher;
    this.options = options;
    this.eventFormatter = new EventFormatter(this.options.namespace);
    this.subscribe();
  }

  subscribe(): void {
    this.subscription = this.pusher.subscribe(this.name);
  }

  unsubscribe(): void {
    this.pusher.unsubscribe(this.name);
  }

  listen(event: string, callback: (...args: unknown[]) => unknown): this {
    this.on(this.eventFormatter.format(event), callback);
    return this;
  }

  listenToAll(callback: (...args: unknown[]) => unknown): this {
    this.subscription.bind_global((event: string, data: unknown) => {
      if (event.startsWith("pusher:")) {
        return;
      }
      const namespace = String(this.options.namespace ?? "").replace(
        /\./g,
        "\\",
      );
      const formattedEvent = event.startsWith(namespace)
        ? event.substring(namespace.length + 1)
        : `.${event}`;
      callback(formattedEvent, data);
    });
    return this;
  }

  stopListening(
    event: string,
    callback?: (...args: unknown[]) => unknown,
  ): this {
    if (callback) {
      this.subscription.unbind(this.eventFormatter.format(event), callback);
    } else {
      this.subscription.unbind(this.eventFormatter.format(event));
    }
    return this;
  }

  stopListeningToAll(callback?: (...args: unknown[]) => unknown): this {
    if (callback) {
      this.subscription.unbind_global(callback);
    } else {
      this.subscription.unbind_global();
    }
    return this;
  }

  subscribed(callback: (...args: unknown[]) => unknown): this {
    this.on("pusher:subscription_succeeded", () => {
      callback();
    });
    return this;
  }

  error(callback: (...args: unknown[]) => unknown): this {
    this.on("pusher:subscription_error", (...args: unknown[]) => {
      callback(...args);
    });
    return this;
  }

  on(event: string, callback: (...args: unknown[]) => unknown): this {
    this.subscription.bind(event, callback);
    return this;
  }
}
