import type { Application } from "../../../application";
import type { Connection } from "../../../contracts/connection";
import type { Channel } from "../channels/channel";
import type { ChannelConnection } from "../channels/channel-connection";

/**
 * ChannelManager Interface
 *
 * Provides methods for managing Pusher protocol channels within an application scope.
 * Each ChannelManager instance is scoped to a specific application to ensure proper
 * channel isolation across multiple applications.
 *
 * Key Responsibilities:
 * - Create and manage channels for an application
 * - Track all active channels and their connections
 * - Subscribe/unsubscribe connections to/from channels
 * - Clean up empty channels automatically
 * - Provide channel lookup and existence checking
 *
 * Architecture Notes:
 * - Scoped per application (use `for()` to scope)
 * - Manages channel lifecycle (creation/removal)
 * - Coordinates with ChannelConnectionManager for connection tracking
 * - Supports channel type detection and creation via ChannelBroker
 *
 * @example
 * ```typescript
 * // Scope manager to application
 * const manager = channelManager.for(application);
 *
 * // Find or create a channel
 * const channel = manager.findOrCreate('my-channel');
 *
 * // Check if channel exists
 * if (manager.exists('my-channel')) {
 *   const channel = manager.find('my-channel');
 * }
 *
 * // Get all connections on a channel
 * const connections = manager.connections('my-channel');
 *
 * // Unsubscribe from all channels
 * manager.unsubscribeFromAll(connection);
 * ```
 */
export interface ChannelManager {
  /**
   * Get the application instance this manager is scoped to.
   *
   * @returns The application this manager is scoped to, or null if not scoped
   */
  app(): Application | null;

  /**
   * Scope the channel manager to a specific application.
   *
   * Returns a ChannelManager instance that operates within the context of the
   * specified application. This ensures channel isolation across applications.
   *
   * @param application - The application to scope to
   * @returns A scoped ChannelManager instance
   *
   * @example
   * ```typescript
   * const scopedManager = channelManager.for(application);
   * const channel = scopedManager.findOrCreate('my-channel');
   * ```
   */
  for(application: Application): ChannelManager;

  /**
   * Get all channels for the current application.
   *
   * Returns a record mapping channel names to Channel instances.
   * Only includes channels for the application this manager is scoped to.
   *
   * @returns Record of channel name to Channel instance
   *
   * @example
   * ```typescript
   * const channels = manager.all();
   * for (const [name, channel] of Object.entries(channels)) {
   *   console.log(`Channel: ${name}, Connections: ${Object.keys(channel.connections()).length}`);
   * }
   * ```
   */
  all(): Record<string, Channel>;

  /**
   * Check if a channel exists for the current application.
   *
   * @param channel - The channel name to check
   * @returns true if the channel exists, false otherwise
   *
   * @example
   * ```typescript
   * if (manager.exists('my-channel')) {
   *   // Channel exists, safe to use find()
   *   const channel = manager.find('my-channel');
   * }
   * ```
   */
  exists(channel: string): boolean;

  /**
   * Find a channel by name.
   *
   * Returns the channel if it exists, or null if not found.
   * Use exists() to check before calling if you want to avoid null checks.
   *
   * @param channel - The channel name to find
   * @returns The Channel instance if found, null otherwise
   *
   * @example
   * ```typescript
   * const channel = manager.find('my-channel');
   * if (channel) {
   *   channel.broadcast({ event: 'update', data: 'value' });
   * }
   * ```
   */
  find(channel: string): Channel | null;

  /**
   * Find a channel by name or create it if it doesn't exist.
   *
   * This is the primary method for obtaining channels. It ensures a channel
   * always exists after the call. The channel type is determined by the
   * channel name prefix (e.g., "private-", "presence-", "cache-").
   *
   * @param channel - The channel name to find or create
   * @returns The Channel instance (existing or newly created)
   *
   * @example
   * ```typescript
   * // Always returns a channel (creates if needed)
   * const channel = manager.findOrCreate('my-channel');
   * channel.subscribe(connection);
   *
   * // Creates appropriate channel type based on name
   * const privateChannel = manager.findOrCreate('private-chat');
   * const presenceChannel = manager.findOrCreate('presence-room');
   * ```
   */
  findOrCreate(channel: string): Channel;

  /**
   * Get all connections for the specified channel(s).
   *
   * If a channel name is provided, returns connections only for that channel.
   * If no channel name is provided, returns connections for all channels in
   * the current application.
   *
   * @param channel - Optional channel name to filter connections
   * @returns Record of connection ID to ChannelConnection instance
   *
   * @example
   * ```typescript
   * // Get connections for a specific channel
   * const connections = manager.connections('my-channel');
   * console.log(`${Object.keys(connections).length} connections`);
   *
   * // Get connections for all channels
   * const allConnections = manager.connections();
   * ```
   */
  connections(channel?: string | null): Record<string, ChannelConnection>;

  /**
   * Unsubscribe a connection from all channels.
   *
   * Removes the specified connection from all channels in the current application.
   * This is typically called when a connection is closing or being terminated.
   * Empty channels are automatically removed.
   *
   * @param connection - The connection to unsubscribe
   *
   * @example
   * ```typescript
   * // On connection close
   * connection.on('close', () => {
   *   manager.unsubscribeFromAll(connection);
   * });
   * ```
   */
  unsubscribeFromAll(connection: Connection): void;

  /**
   * Remove a channel from the manager.
   *
   * Removes the channel from the application's channel registry.
   * This is typically called automatically when a channel becomes empty
   * (has no connections). Can also be called manually to force channel removal.
   *
   * @param channel - The Channel instance to remove
   *
   * @example
   * ```typescript
   * const channel = manager.find('my-channel');
   * if (channel && Object.keys(channel.connections()).length === 0) {
   *   manager.remove(channel);
   * }
   * ```
   */
  remove(channel: Channel): void;

  /**
   * Flush all channels for all applications.
   *
   * Removes all channels from the channel manager across all applications.
   * This is typically used for testing or when resetting the server state.
   * Use with caution in production environments.
   *
   * @example
   * ```typescript
   * // Clear all channels (useful for testing)
   * manager.flush();
   * ```
   */
  flush(): void;
}
