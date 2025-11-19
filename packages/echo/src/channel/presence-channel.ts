import type { Channel } from "./channel";

export interface PresenceChannel extends Channel {
  here(callback: (...args: unknown[]) => unknown): this;
  joining(callback: (...args: unknown[]) => unknown): this;
  whisper(eventName: string, data: Record<string, unknown>): this;
  leaving(callback: (...args: unknown[]) => unknown): this;
}
