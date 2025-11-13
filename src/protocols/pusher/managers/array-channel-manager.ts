import type { Application } from "../../../application";
import type { IApplicationProvider } from "../../../contracts/application-provider";
import type { Connection } from "../../../contracts/connection";
import type { ILogger } from "../../../contracts/logger";
import { ChannelCreated } from "../../../events/channel-created";
import { ChannelRemoved } from "../../../events/channel-removed";
import type { Channel, ChannelConnectionManager } from "../channels/channel";
import { ChannelBroker } from "../channels/channel-broker";
import type { ChannelConnection } from "../channels/channel-connection";
import type { ChannelManager } from "../contracts/channel-manager";

/**
 * ArrayChannelManager - In-Memory Channel Manager Implementation
 *
 * Implements the ChannelManager interface using nested Maps for efficient channel
 * storage and lookup. This is the default channel manager implementation for Reverb.
 *
 * Storage Structure:
 * ```
 * applications: Map<appId, Map<channelName, Channel>>
 * ```
 *
 * Key Features:
 * - Fast O(1) channel lookup by application and name
 * - Automatic channel creation via ChannelBroker
 * - Application-scoped channel isolation
 * - Automatic empty channel cleanup
 * - Event dispatching for channel lifecycle
 *
 * Architecture Notes:
 * - Uses InteractsWithApplications mixin for application scoping
 * - Delegates channel type creation to ChannelBroker
 * - Stores channels in nested Map structure (appId → channelName → Channel)
 * - Thread-safe for single-process deployments (use Redis adapter for multi-process)
 *
 * @example
 * ```typescript
 * // Create manager
 * const manager = new ArrayChannelManager(
 *   applicationProvider,
 *   channelConnectionManager,
 *   logger
 * );
 *
 * // Scope to application
 * const scoped = manager.for(application);
 *
 * // Create/find channels
 * const channel = scoped.findOrCreate('my-channel');
 * channel.subscribe(connection);
 *
 * // Cleanup on disconnect
 * scoped.unsubscribeFromAll(connection);
 * ```
 */
export class ArrayChannelManager implements ChannelManager {
  /**
   * The underlying storage of applications and their channels.
   *
   * Structure: Map<applicationId, Map<channelName, Channel>>
   * - First level: Application ID → Channel registry
   * - Second level: Channel name → Channel instance
   *
   * @private
   */
  private applications: Map<string, Map<string, Channel>> = new Map();

  /**
   * The application instance this manager is scoped to.
   *
   * Set via for() method to scope operations to a specific application.
   * Null if not yet scoped (operations will throw or fail).
   *
   * @private
   */
  private application: Application | null = null;

  /**
   * Create a new ArrayChannelManager instance.
   *
   * @param applicationProvider - The application provider for accessing all applications
   * @param channelConnectionManager - The channel connection manager for managing channel subscriptions
   * @param logger - The logger instance for logging channel operations
   */
  constructor(
    private readonly applicationProvider: IApplicationProvider,
    private readonly channelConnectionManager: ChannelConnectionManager,
    private readonly logger: ILogger,
  ) {}

  /**
   * Get the application instance this manager is scoped to.
   *
   * @returns The application this manager is scoped to, or null if not scoped
   */
  app(): Application | null {
    return this.application;
  }

  /**
   * Scope the channel manager to a specific application.
   *
   * Returns this same instance but with the application property set.
   * This allows method chaining and ensures all subsequent operations
   * are performed within the application's scope.
   *
   * @param application - The application to scope to
   * @returns This manager instance (for method chaining)
   *
   * @example
   * ```typescript
   * const channel = manager.for(app).findOrCreate('my-channel');
   * ```
   */
  for(application: Application): ChannelManager {
    this.application = application;
    return this;
  }

  /**
   * Get all channels for the current application.
   *
   * Returns a record mapping channel names to Channel instances.
   * Returns an empty record if the application has no channels.
   *
   * @returns Record of channel name to Channel instance
   * @throws {Error} If manager is not scoped to an application
   */
  all(): Record<string, Channel> {
    if (!this.application) {
      throw new Error(
        "ChannelManager must be scoped to an application via for()",
      );
    }

    const appChannels =
      this.applications.get(this.application.id()) ?? new Map();
    return Object.fromEntries(appChannels);
  }

  /**
   * Check if a channel exists for the current application.
   *
   * @param channel - The channel name to check
   * @returns true if the channel exists, false otherwise
   * @throws {Error} If manager is not scoped to an application
   */
  exists(channel: string): boolean {
    if (!this.application) {
      throw new Error(
        "ChannelManager must be scoped to an application via for()",
      );
    }

    const appChannels = this.applications.get(this.application.id());
    return appChannels?.has(channel) ?? false;
  }

  /**
   * Find a channel by name.
   *
   * Returns the channel if it exists, or null if not found.
   *
   * @param channel - The channel name to find
   * @returns The Channel instance if found, null otherwise
   * @throws {Error} If manager is not scoped to an application
   */
  find(channel: string): Channel | null {
    if (!this.application) {
      throw new Error(
        "ChannelManager must be scoped to an application via for()",
      );
    }

    return this.channels(channel) ?? null;
  }

  /**
   * Find a channel by name or create it if it doesn't exist.
   *
   * This is the primary method for obtaining channels. Uses ChannelBroker
   * to create the appropriate channel type based on the channel name prefix.
   *
   * @param channelName - The channel name to find or create
   * @returns The Channel instance (existing or newly created)
   * @throws {Error} If manager is not scoped to an application
   *
   * @example
   * ```typescript
   * const channel = manager.findOrCreate('private-chat');
   * // Returns PrivateChannel instance
   * ```
   */
  findOrCreate(channelName: string): Channel {
    if (!this.application) {
      throw new Error(
        "ChannelManager must be scoped to an application via for()",
      );
    }

    // Check if channel already exists
    const existingChannel = this.find(channelName);
    if (existingChannel) {
      return existingChannel;
    }

    // Create new channel using ChannelBroker
    const channel = ChannelBroker.create(
      channelName,
      this.channelConnectionManager,
      this,
      this.logger,
    );

    // Ensure application channels map exists
    if (!this.applications.has(this.application.id())) {
      this.applications.set(this.application.id(), new Map());
    }

    // Store channel
    const appChannels = this.applications.get(this.application.id());
    if (appChannels) {
      appChannels.set(channel.name(), channel);
    }

    // Dispatch ChannelCreated event
    ChannelCreated.dispatch(channel);

    return channel;
  }

  /**
   * Get all connections for the specified channel(s).
   *
   * If a channel name is provided, returns connections only for that channel.
   * If no channel name is provided, returns connections for all channels in
   * the current application.
   *
   * Connections from multiple channels are merged into a single record.
   * If the same connection ID appears in multiple channels, the last one wins
   * (though this shouldn't happen in practice as connection IDs are unique).
   *
   * @param channel - Optional channel name to filter connections
   * @returns Record of connection ID to ChannelConnection instance
   * @throws {Error} If manager is not scoped to an application
   */
  connections(channel?: string | null): Record<string, ChannelConnection> {
    if (!this.application) {
      throw new Error(
        "ChannelManager must be scoped to an application via for()",
      );
    }

    // Get channels to query (single channel or all channels)
    const channelsToQuery =
      channel !== null && channel !== undefined
        ? [this.channels(channel)]
        : Object.values(this.all());

    // Filter out null/undefined channels
    const validChannels = channelsToQuery.filter(
      (ch): ch is Channel => ch !== null && ch !== undefined,
    );

    // Merge connections from all channels
    const allConnections: Record<string, ChannelConnection> = {};
    for (const ch of validChannels) {
      const channelConnections = ch.connections();
      Object.assign(allConnections, channelConnections);
    }

    return allConnections;
  }

  /**
   * Unsubscribe a connection from all channels.
   *
   * Iterates through all channels in the current application and unsubscribes
   * the connection from each. Empty channels are automatically removed by the
   * Channel.unsubscribe() method.
   *
   * @param connection - The connection to unsubscribe
   * @throws {Error} If manager is not scoped to an application
   */
  unsubscribeFromAll(connection: Connection): void {
    if (!this.application) {
      throw new Error(
        "ChannelManager must be scoped to an application via for()",
      );
    }

    const channels = this.all();
    for (const channel of Object.values(channels)) {
      channel.unsubscribe(connection);
    }
  }

  /**
   * Remove a channel from the manager.
   *
   * Removes the channel from the application's channel registry and dispatches
   * a ChannelRemoved event for observability.
   *
   * @param channel - The Channel instance to remove
   * @throws {Error} If manager is not scoped to an application
   */
  remove(channel: Channel): void {
    if (!this.application) {
      throw new Error(
        "ChannelManager must be scoped to an application via for()",
      );
    }

    const appChannels = this.applications.get(this.application.id());
    if (appChannels) {
      appChannels.delete(channel.name());

      // Dispatch ChannelRemoved event
      ChannelRemoved.dispatch(channel);
    }
  }

  /**
   * Get the channels for the application.
   *
   * Internal helper method that retrieves either a specific channel or all channels
   * for the current application. Returns Map for internal use (converted to Record
   * for public API).
   *
   * @param channel - Optional channel name to retrieve
   * @returns The specific Channel if name provided, or Map of all channels, or null/Map
   * @private
   */
  private channels(channel?: string): Channel | undefined {
    if (!this.application) {
      return undefined;
    }

    const appChannels =
      this.applications.get(this.application.id()) ?? new Map();

    if (channel !== undefined) {
      return appChannels.get(channel);
    }

    return undefined;
  }

  /**
   * Flush all channels for all applications.
   *
   * Removes all channels from the channel manager across all applications.
   * This is typically used for testing or when resetting the server state.
   *
   * Iterates through all applications in the ApplicationProvider and clears
   * their channel registries.
   */
  flush(): void {
    const allApplications = this.applicationProvider.all();

    for (const app of allApplications) {
      this.applications.set(app.id(), new Map());
    }
  }
}
