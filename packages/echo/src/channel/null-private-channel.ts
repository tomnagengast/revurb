import { NullChannel } from "./null-channel";

export class NullPrivateChannel extends NullChannel {
  whisper(_eventName: string, _data: unknown): this {
    return this;
  }
}
