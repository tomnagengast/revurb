import type { Channel } from '../Protocols/Pusher/Channels/channel';
import { EventDispatcher } from './event-dispatcher';

/**
 * ChannelCreated Event
 *
 * Dispatched when a new channel is created in the WebSocket server.
 * This event is used for monitoring, logging, and metrics collection.
 */
export class ChannelCreated {
  /**
   * Create a new ChannelCreated event instance.
   *
   * @param channel - The channel that was created
   */
  constructor(public readonly channel: Channel) {}

  /**
   * Dispatch the ChannelCreated event.
   *
   * @param channel - The channel that was created
   */
  static dispatch(channel: Channel): void {
    const event = new ChannelCreated(channel);
    EventDispatcher.emit('channel:created', event);
  }
}
