import { RedisClient } from "./redis-client";
import type { RedisClient as IRedisClient } from "./redis-client-factory";

/**
 * RedisSubscribeClient
 *
 * Extends RedisClient to handle subscription to Redis channels with
 * automatic resubscription on reconnection.
 *
 * Key Responsibilities:
 * - Subscribe to a specific Redis channel
 * - Automatically resubscribe when connection is restored
 * - Override the connection name to 'subscriber'
 */
export class RedisSubscribeClient extends RedisClient {
  /**
   * The name of the Redis connection.
   */
  protected override name = "subscriber";

  /**
   * Track if we should be subscribed (for automatic resubscription)
   */
  protected shouldBeSubscribed = false;

  /**
   * Subscribe to the given Redis channel.
   *
   * Marks the channel for subscription and subscribes if connected.
   * If disconnected, will automatically subscribe when reconnected.
   */
  public async subscribe(): Promise<void> {
    this.shouldBeSubscribed = true;

    if (!this.client || !this.isConnected()) {
      return;
    }

    await this.client.subscribe(this.channel);
  }

  /**
   * Handle a successful connection to the Redis server
   *
   * Automatically resubscribes to the channel if we were previously subscribed.
   *
   * @param client - The connected Redis client
   */
  protected override onConnection(client: IRedisClient): void {
    super.onConnection(client);

    // Automatically resubscribe if we were subscribed before
    if (this.shouldBeSubscribed) {
      this.subscribe();
    }
  }
}
