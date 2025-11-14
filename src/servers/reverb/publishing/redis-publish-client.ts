import { RedisClient } from "./redis-client";
import type { RedisClient as IRedisClient } from "./redis-client-factory";

/**
 * Event payload for publishing to Redis
 */
interface EventPayload {
  [key: string]: unknown;
}

/**
 * Redis client for publishing events with automatic queueing
 *
 * Extends the RedisClient to provide publishing capabilities with automatic
 * event queueing while disconnected from Redis. When the connection is restored,
 * all queued events are automatically published.
 *
 * This ensures that events are never lost due to temporary Redis connection issues.
 *
 * @class RedisPublishClient
 * @example
 * ```typescript
 * const client = new RedisPublishClient(logger, factory, 'channel-name', config);
 * await client.connect();
 * await client.publish({ event: 'user.created', data: {...} });
 * ```
 */
export class RedisPublishClient extends RedisClient {
  /**
   * The name of the Redis connection
   */
  protected override name = "publisher";

  /**
   * Queue of events to publish when reconnected
   */
  protected queuedEvents: EventPayload[] = [];

  /**
   * Publish an event to the given channel
   *
   * If the client is not connected, the event will be queued and published
   * automatically when the connection is restored.
   *
   * @param payload - The event payload to publish
   * @returns Promise that resolves to the number of subscribers that received the message
   */
  public async publish(payload: EventPayload): Promise<number> {
    if (!this.isConnected() || !this.client) {
      this.queueEvent(payload);
      return 0;
    }
    return await this.client.publish(this.channel, JSON.stringify(payload));
  }

  /**
   * Queue the given publish event
   *
   * @param payload - The event payload to queue
   */
  protected queueEvent(payload: EventPayload): void {
    this.queuedEvents.push(payload);
  }

  /**
   * Process the queued events
   *
   * Publishes all queued events to Redis and clears the queue.
   */
  protected processQueuedEvents(): void {
    for (const event of this.queuedEvents) {
      this.publish(event);
    }

    this.queuedEvents = [];
  }

  /**
   * Handle a successful connection to the Redis server
   *
   * @param client - The connected Redis client
   */
  protected override onConnection(client: IRedisClient): void {
    super.onConnection(client);

    // Process any queued events after connection is established
    this.processQueuedEvents();
  }
}
