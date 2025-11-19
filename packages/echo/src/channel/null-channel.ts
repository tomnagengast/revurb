import { Channel } from "./channel";

export class NullChannel extends Channel {
  listen(_event: string, _callback: (...args: unknown[]) => unknown): this {
    return this;
  }

  stopListening(
    _event: string,
    _callback?: (...args: unknown[]) => unknown,
  ): this {
    return this;
  }

  subscribed(_callback: (...args: unknown[]) => unknown): this {
    return this;
  }

  error(_callback: (...args: unknown[]) => unknown): this {
    return this;
  }
}
