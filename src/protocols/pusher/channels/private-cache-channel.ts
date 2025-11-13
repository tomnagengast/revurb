import * as crypto from "node:crypto";
import type { Connection } from "../../../contracts/connection";
import { ConnectionUnauthorized } from "../exceptions/connection-unauthorized";
import { CacheChannel } from "./cache-channel";

/**
 * Private Cache Channel
 *
 * Combines private channel authentication with cache channel functionality.
 * Requires authentication for subscription and caches the last broadcast payload.
 *
 * Key Features:
 * - HMAC-SHA256 signature verification (from PrivateChannel)
 * - Cached payload support (from CacheChannel)
 * - Secure access control with state persistence
 *
 * Channel Name Format:
 * - private-cache-{channel-name}
 *
 * Authentication Flow:
 * 1. Client requests subscription with auth signature
 * 2. Server verifies signature: HMAC-SHA256(socket_id:channel_name[:data], secret)
 * 3. If valid, subscription proceeds; otherwise ConnectionUnauthorized thrown
 * 4. New subscriber receives cached payload (if available) or cache_miss
 *
 * Cache Behavior:
 * - External broadcasts update the cache
 * - Internal broadcasts bypass the cache
 * - Late joiners receive the cached state
 *
 * Use Cases:
 * - Private real-time dashboards with persistent state
 * - Authenticated data feeds where late joiners need current state
 * - Private status indicators or metrics
 *
 * @example
 * ```typescript
 * const channel = new PrivateCacheChannel('private-cache-dashboard');
 * const auth = 'app_key:abc123...'; // HMAC signature
 * await channel.subscribe(connection, auth);
 *
 * // External broadcast - updates cache and requires auth
 * channel.broadcast({
 *   event: 'metrics-update',
 *   data: JSON.stringify({ cpu: 45, memory: 60 })
 * });
 * ```
 *
 * @see Laravel\Reverb\Protocols\Pusher\Channels\PrivateCacheChannel (PHP)
 * @see PrivateChannel for authentication details
 * @see CacheChannel for caching details
 */
export class PrivateCacheChannel extends CacheChannel {
  /**
   * Subscribe to the private cache channel.
   *
   * Verifies authentication before allowing subscription.
   * Delegates to parent CacheChannel.subscribe() after verification.
   *
   * Implements the InteractsWithPrivateChannels trait behavior from PHP.
   *
   * @param connection - The connection to subscribe
   * @param auth - The authentication signature (required)
   * @param data - Optional JSON-encoded channel data
   * @throws {ConnectionUnauthorized} If authentication fails
   *
   * @example
   * ```typescript
   * const auth = connection.app().key() + ':' + hmacSignature;
   * channel.subscribe(connection, auth);
   * ```
   */
  override subscribe(
    connection: Connection,
    auth: string | null = null,
    data: string | null = null,
  ): void {
    // Verify authentication first
    this.verify(connection, auth, data);

    // Then delegate to parent for subscription handling
    super.subscribe(connection, auth, data);
  }

  /**
   * Verify the authentication token.
   *
   * Validates that the provided auth signature matches the expected HMAC-SHA256
   * signature for the connection and channel.
   *
   * This implements the verify() method from the InteractsWithPrivateChannels
   * trait in the PHP implementation.
   *
   * Signature String Format:
   * - Without data: "{socket_id}:{channel_name}"
   * - With data: "{socket_id}:{channel_name}:{data}"
   *
   * Auth Token Format:
   * - "{app_key}:{signature}"
   * - Only the signature portion (after ':') is validated
   *
   * Algorithm (from PHP):
   * ```php
   * $signature = "{$connection->id()}:{$this->name()}";
   * if ($data) {
   *     $signature .= ":{$data}";
   * }
   *
   * if (! hash_equals(
   *     hash_hmac('sha256', $signature, $connection->app()->secret()),
   *     Str::after($auth, ':')
   * )) {
   *     throw new ConnectionUnauthorized;
   * }
   * ```
   *
   * @param connection - The connection attempting to subscribe
   * @param auth - The authentication token
   * @param data - Optional channel data to include in signature
   * @returns true if authentication is valid
   * @throws {ConnectionUnauthorized} If authentication fails or is invalid
   * @protected
   */
  protected verify(
    connection: Connection,
    auth: string | null = null,
    data: string | null = null,
  ): boolean {
    // Build the signature string: "{socket_id}:{channel_name}:{data?}"
    let signatureString = `${connection.id()}:${this.name()}`;

    if (data) {
      signatureString += `:${data}`;
    }

    // Extract the signature from auth token (format: "app_key:signature")
    // PHP equivalent: Str::after($auth, ':')
    const providedSignature = auth ? auth.split(":").slice(1).join(":") : "";

    // Compute expected signature using HMAC-SHA256
    // PHP equivalent: hash_hmac('sha256', $signature, $connection->app()->secret())
    const secret = connection.app().secret();
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signatureString)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    // PHP equivalent: hash_equals($expected, $provided)
    if (!this.timingSafeEqual(expectedSignature, providedSignature)) {
      throw new ConnectionUnauthorized();
    }

    return true;
  }

  /**
   * Timing-safe string comparison.
   *
   * Compares two strings in constant time to prevent timing attacks.
   * Uses crypto.timingSafeEqual which is equivalent to PHP's hash_equals().
   *
   * Implementation notes:
   * - Handles length mismatches safely
   * - Performs dummy comparison when lengths differ to maintain constant time
   * - Uses Node.js crypto.timingSafeEqual for secure comparison
   *
   * @param a - First string to compare
   * @param b - Second string to compare
   * @returns true if strings are equal, false otherwise
   * @private
   */
  private timingSafeEqual(a: string, b: string): boolean {
    // If lengths differ, use dummy comparison to maintain constant time
    if (a.length !== b.length) {
      // Compare with dummy value to maintain constant time
      const dummy = "a".repeat(a.length);
      crypto.timingSafeEqual(Buffer.from(a), Buffer.from(dummy));
      return false;
    }

    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
