import { NullPrivateChannel } from "./null-private-channel";

export class NullPresenceChannel extends NullPrivateChannel {
  here(_callback: (...args: unknown[]) => unknown): NullPresenceChannel {
    return this;
  }

  joining(_callback: (...args: unknown[]) => unknown): NullPresenceChannel {
    return this;
  }

  leaving(_callback: (...args: unknown[]) => unknown): NullPresenceChannel {
    return this;
  }
}
