import { NullChannel } from "./null-channel";

export class NullEncryptedPrivateChannel extends NullChannel {
  whisper(_eventName: string, _data: Record<string, unknown>): this {
    return this;
  }
}
