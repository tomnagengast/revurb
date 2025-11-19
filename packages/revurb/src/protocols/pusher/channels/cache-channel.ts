import type { Connection } from "../../../contracts/connection";
import { Channel } from "./channel";

/**
 * CacheChannel - Channel with Cached Payload Support
 *
 * Extends the base Channel class to support caching the last broadcast payload.
 * When a new subscriber joins, they receive the cached payload (if available)
 * or a cache_miss message.
 *
 * Key Features:
 * - Stores the last broadcast payload
 * - Distinguishes between external and internal broadcasts
 * - External broadcasts (from API/webhooks) update the cache
 * - Internal broadcasts (from subscribed clients) bypass the cache
 * - Cache persists until a new external broadcast is received
 *
 * Cache Behavior:
 * - broadcast(): Stores payload in cache, then broadcasts to all connections
 * - broadcastInternally(): Bypasses cache, broadcasts directly
 * - hasCachedPayload(): Check if cache has data
 * - cachedPayload(): Retrieve cached data
 *
 * Use Cases:
 * - Real-time data feeds where late joiners need the latest state
 * - Dashboards displaying current metrics
 * - Live scoreboards or status indicators
 *
 * @example
 * ```typescript
 * const channel = new CacheChannel('cache-stock-prices');
 *
 * // External broadcast (from API) - updates cache
 * channel.broadcast({
 *   event: 'price-update',
 *   data: JSON.stringify({ ticker: 'AAPL', price: 150.25 })
 * });
 *
 * // Later, when a new subscriber joins
 * if (channel.hasCachedPayload()) {
 *   const cached = channel.cachedPayload();
 *   connection.send(JSON.stringify(cached));
 * }
 *
 * // Internal broadcast (from client) - doesn't update cache
 * channel.broadcastInternally({
 *   event: 'client-typing',
 *   data: JSON.stringify({ user: 'alice' })
 * }, connection);
 * ```
 */
export class CacheChannel extends Channel {
  /**
   * Data from last event triggered.
   *
   * Stores the complete payload from the most recent external broadcast.
   * Set to null initially and when no broadcasts have occurred.
   * Updated only by broadcast(), not by broadcastInternally().
   */
  protected payload: Record<string, unknown> | null = null;

  /**
   * Send a message to all connections subscribed to the channel.
   *
   * Overrides the base broadcast() to cache the payload before broadcasting.
   * This cached payload will be sent to new subscribers when they join.
   *
   * Flow:
   * 1. Store payload in cache
   * 2. Delegate to parent broadcast() to send to all connections
   *
   * @param payload - The message payload to broadcast and cache
   * @param except - Optional connection to exclude from broadcast
   *
   * @example
   * ```typescript
   * // Broadcast updates cache
   * channel.broadcast({
   *   event: 'update',
   *   data: JSON.stringify({ status: 'online' })
   * });
   * ```
   */
  override broadcast(
    payload: Record<string, unknown>,
    except?: Connection | null,
  ): void {
    // Cache the payload for future subscribers
    this.payload = payload;

    // Broadcast to current subscribers
    super.broadcast(payload, except);
  }

  /**
   * Broadcast a message triggered from an internal source.
   *
   * Broadcasts a message WITHOUT updating the cache. This is used for
   * client-originated events that shouldn't become the "current state"
   * sent to new subscribers.
   *
   * Directly calls parent's broadcast() to bypass cache update.
   *
   * @param payload - The message payload to broadcast
   * @param except - Optional connection to exclude from broadcast
   *
   * @example
   * ```typescript
   * // Internal broadcast doesn't update cache
   * channel.broadcastInternally({
   *   event: 'client-message',
   *   data: JSON.stringify({ text: 'hello' })
   * }, senderConnection);
   * ```
   */
  override broadcastInternally(
    payload: Record<string, unknown>,
    except?: Connection | null,
  ): void {
    // Bypass cache update by calling parent's broadcast directly
    super.broadcast(payload, except);
  }

  /**
   * Determine if the channel has a cached payload.
   *
   * Returns true if a payload has been cached (i.e., at least one external
   * broadcast has occurred). Returns false if the cache is empty.
   *
   * @returns true if cache has data, false otherwise
   *
   * @example
   * ```typescript
   * if (channel.hasCachedPayload()) {
   *   // Send cached data to new subscriber
   *   const payload = channel.cachedPayload();
   *   connection.send(JSON.stringify(payload));
   * } else {
   *   // Send cache_miss message
   *   connection.send(JSON.stringify({
   *     event: 'pusher:cache_miss',
   *     channel: channel.getName()
   *   }));
   * }
   * ```
   */
  hasCachedPayload(): boolean {
    return this.payload !== null;
  }

  /**
   * Get the cached payload.
   *
   * Returns the payload from the most recent external broadcast, or null
   * if no broadcasts have occurred yet.
   *
   * @returns The cached payload object, or null if no cache exists
   *
   * @example
   * ```typescript
   * const cached = channel.cachedPayload();
   * if (cached) {
   *   console.log('Cached event:', cached.event);
   *   console.log('Cached data:', cached.data);
   * }
   * ```
   */
  cachedPayload(): Record<string, unknown> | null {
    return this.payload;
  }
}
