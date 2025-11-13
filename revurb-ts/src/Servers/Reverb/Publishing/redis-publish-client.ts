import { RedisClient, type RedisServerConfig } from './redis-client';
import type { ILogger } from '../../../contracts/logger';
import type { RedisClientFactory } from './redis-client-factory';
import type { RedisClient as IRedisClient } from './redis-client-factory';

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
  protected override name = 'publisher';

  /**
   * Queue of events to publish when reconnected
   */
  protected queuedEvents: EventPayload[] = [];

  /**
   * Create a new instance of the Redis publish client
   *
   * @param logger - Logger instance for connection events
   * @param clientFactory - Factory for creating Redis client connections
   * @param channel - The Redis channel to publish to
   * @param server - Redis server configuration
   * @param onConnect - Optional callback when connection is established
   */
  constructor(
    logger: ILogger,
    clientFactory: RedisClientFactory,
    channel: string,
    server: RedisServerConfig,
    onConnect?: ((client: IRedisClient) => void) | null
  ) {
    super(logger, clientFactory, channel, server, onConnect);
  }

  /**
   * Publish an event to the given channel
   *
   * If the client is not connected, the event will be queued and published
   * automatically when the connection is restored.
   *
   * @param payload - The event payload to publish
   * @returns Promise that resolves when the event is published or queued
   */
  public async publish(payload: EventPayload): Promise<void> {
    if (!this.isConnected() || !this.client) {
      this.queueEvent(payload);
      return Promise.reject(new Error('Redis client not connected'));
    }

    try {
      await this.client.publish(this.channel, JSON.stringify(payload));
    } catch (error) {
      throw error;
    }
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
