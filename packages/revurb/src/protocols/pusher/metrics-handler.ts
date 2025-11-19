import type { Application } from "../../application";
import type { IPubSubProvider } from "../../servers/reverb/contracts/pubsub-provider";
import type { ChannelConnection } from "./channels/channel-connection";

/**
 * Metrics collection options for different metric types.
 */
export interface MetricsOptions {
  /** Channel name (for 'channel' and 'channel_users' types) */
  channel?: string;
  /** Array of channel names (for 'channels' type) */
  channels?: string[];
  /** Info fields to include (comma-separated or array) */
  info?: string | string[];
  /** Filter prefix for channel names (for 'channels' type) */
  filter?: string;
}

/**
 * Channel information structure.
 */
export interface ChannelInfo {
  /** Whether the channel is occupied (has connections) */
  occupied?: boolean;
  /** Number of unique users (presence channels only) */
  user_count?: number;
  /** Number of subscriptions (non-presence channels only) */
  subscription_count?: number;
  /** Cached payload (cache channels only) */
  cache?: Record<string, unknown> | null;
}

/**
 * User information structure for channel users.
 */
export interface ChannelUser {
  /** User identifier */
  id: string;
}

/**
 * Connection data structure.
 */
export interface ConnectionData {
  /** User identifier */
  user_id: string;
  /** Additional connection metadata */
  [key: string]: unknown;
}

/**
 * Channel interface for metrics gathering.
 */
export interface Channel {
  /** Get the channel name */
  name(): string;
  /** Get all connections to the channel */
  connections(): Record<string, ChannelConnection>;
}

/**
 * Channel manager interface for accessing channels.
 */
export interface ChannelManager {
  /** Get channel manager for a specific application */
  for(application: Application): ApplicationChannelManager;
}

/**
 * Application-specific channel manager interface.
 */
export interface ApplicationChannelManager {
  /** Get all channels */
  all(): Record<string, Channel>;
  /** Find a specific channel by name */
  find(name: string): Channel | null;
  /** Get all connections for the application */
  connections(): Record<string, unknown>;
}

/**
 * Server provider manager interface.
 */
export interface ServerProviderManager {
  /** Check if the server subscribes to events */
  subscribesToEvents(): boolean;
}

/**
 * PubSub message structure.
 */
export interface PubSubMessage extends Record<string, unknown> {
  /** Message type */
  type: string;
  /** Unique key for correlating requests/responses */
  key?: string;
  /** Serialized application data */
  application?: string;
  /** Message payload */
  payload?: unknown;
}

/**
 * Metrics handler for gathering channel and connection statistics.
 *
 * This class handles metrics collection for Pusher-compatible channels,
 * supporting both single-server and distributed (multi-server) deployments.
 *
 * In distributed mode, it coordinates metrics gathering across all servers
 * using the PubSub provider with a timeout-based collection strategy.
 *
 * Metrics Types:
 * - channel: Information about a specific channel
 * - channels: Information about multiple channels
 * - channel_users: List of unique users in a presence channel
 * - connections: All connections for an application
 */
export class MetricsHandler {
  /**
   * The metrics being gathered.
   */
  protected metrics: unknown[] = [];

  /**
   * The total subscribers gathering metrics.
   */
  protected subscribers: number | null = null;

  /**
   * Create an instance of the metrics handler.
   */
  constructor(
    protected serverProviderManager: ServerProviderManager,
    protected channels: ChannelManager,
    protected pubSubProvider: IPubSubProvider | null,
  ) {}

  /**
   * Set the PubSub provider.
   *
   * @param provider - The PubSub provider to set
   */
  public setPubSubProvider(provider: IPubSubProvider): void {
    this.pubSubProvider = provider;
  }

  /**
   * Gather the metrics for the given type.
   */
  async gather(
    application: Application,
    type: string,
    options: MetricsOptions = {},
  ): Promise<unknown> {
    return this.serverProviderManager.subscribesToEvents()
      ? this.gatherMetricsFromSubscribers(application, type, options)
      : this.get(application, type, options);
  }

  /**
   * Get the metrics for the given type.
   */
  get(
    application: Application,
    type: string,
    options: MetricsOptions,
  ): unknown {
    switch (type) {
      case "channel":
        return this.channel(application, options);
      case "channels":
        return this.channels_(application, options);
      case "channel_users":
        return this.channelUsers(application, options);
      case "connections":
        return this.connections(application);
      default:
        return [];
    }
  }

  /**
   * Get the channel for the given application.
   */
  protected channel(
    application: Application,
    options: MetricsOptions,
  ): ChannelInfo {
    if (!options.channel) {
      return {};
    }
    return this.info(application, options.channel, options.info ?? "");
  }

  /**
   * Get the channels for the given application.
   */
  protected channels_(
    application: Application,
    options: MetricsOptions,
  ): Record<string, ChannelInfo> {
    if (options.channels) {
      return this.infoForChannels(
        application,
        options.channels,
        options.info ?? "",
      );
    }

    // Convert Record to array since all() returns Record<string, Channel>
    let channelList = Object.values(this.channels.for(application).all());

    // Apply filter if provided
    if (options.filter) {
      const filter = options.filter;
      channelList = channelList.filter((channel) =>
        channel.name().startsWith(filter),
      );
    }

    // Filter to only occupied channels
    // channel.connections() returns Record<string, ChannelConnection>, so get length via Object.keys()
    channelList = channelList.filter(
      (channel) => Object.keys(channel.connections()).length > 0,
    );

    return this.infoForChannels(application, channelList, options.info ?? "");
  }

  /**
   * Get the channel users for the given application.
   */
  protected channelUsers(
    application: Application,
    options: MetricsOptions,
  ): ChannelUser[] {
    if (!options.channel) {
      return [];
    }
    const channel = this.channels.for(application).find(options.channel);

    if (!channel) {
      return [];
    }

    // Get unique users by user_id
    // channel.connections() returns Record<string, ChannelConnection>, convert to array
    const connections = Object.values(channel.connections());
    const seenUserIds = new Set<string>();
    const users: ChannelUser[] = [];

    for (const channelConnection of connections) {
      // channelConnection.data() returns Map<string, unknown>, get user_id from Map
      const connectionData = channelConnection.data();
      const userId = connectionData.get("user_id") as string | undefined;
      if (userId && !seenUserIds.has(userId)) {
        seenUserIds.add(userId);
        users.push({ id: userId });
      }
    }

    return users;
  }

  /**
   * Get the connections for the given application.
   */
  protected connections(application: Application): Record<string, unknown> {
    return this.channels.for(application).connections();
  }

  /**
   * Gather metrics from all subscribers for the given type.
   */
  protected async gatherMetricsFromSubscribers(
    application: Application,
    type: string,
    options: MetricsOptions = {},
  ): Promise<unknown> {
    const key = this.generateRandomKey(10);

    // Set up listener for metrics responses
    const metricsPromise = this.listenForMetrics(key);

    // Request metrics from all subscribers
    this.requestMetricsFromSubscribers(application, key, type, options);

    // Wait for responses with timeout (10 seconds)
    try {
      const metrics = await this.timeoutPromise(metricsPromise, 10000);
      return this.mergeSubscriberMetrics(metrics, type);
    } catch (_error) {
      // Timeout or error - return whatever metrics we have
      return this.mergeSubscriberMetrics(this.metrics, type);
    }
  }

  /**
   * Request metrics from all subscribers.
   */
  protected requestMetricsFromSubscribers(
    application: Application,
    key: string,
    type: string,
    options: MetricsOptions | null,
  ): void {
    if (!this.pubSubProvider) {
      return;
    }
    this.pubSubProvider
      .publish({
        type: "metrics",
        key,
        application: this.serializeApplication(application),
        payload: { type, options },
      })
      .then((total) => {
        this.subscribers = total;
      });
  }

  /**
   * Merge the given metrics into a single result set.
   */
  protected mergeSubscriberMetrics(metrics: unknown[], type: string): unknown {
    switch (type) {
      case "connections": {
        const result: Record<string, unknown> = {};
        for (const item of metrics) {
          if (typeof item === "object" && item !== null) {
            Object.assign(result, item);
          }
        }
        return result;
      }
      case "channels":
        return this.mergeChannels(
          metrics.filter(
            (m): m is Record<string, ChannelInfo> =>
              typeof m === "object" && m !== null,
          ),
        );
      case "channel":
        return this.mergeChannel(
          metrics.filter(
            (m): m is ChannelInfo => typeof m === "object" && m !== null,
          ),
        );
      case "channel_users":
        // Flatten and get unique users
        return metrics
          .flat()
          .filter(
            (user): user is ChannelUser =>
              typeof user === "object" &&
              user !== null &&
              "id" in user &&
              typeof user.id === "string",
          )
          .filter(
            (user, index, self) =>
              self.findIndex((u) => u.id === user.id) === index,
          );
      default:
        return [];
    }
  }

  /**
   * Merge multiple channel instances into a single set.
   */
  protected mergeChannel(metrics: ChannelInfo[]): ChannelInfo {
    const result: ChannelInfo = {};

    for (const item of metrics) {
      for (const [key, value] of Object.entries(item)) {
        switch (key) {
          case "occupied":
            result.occupied = (result.occupied ?? false) || (value as boolean);
            break;
          case "user_count":
            result.user_count = (result.user_count ?? 0) + (value as number);
            break;
          case "subscription_count":
            result.subscription_count =
              (result.subscription_count ?? 0) + (value as number);
            break;
          case "cache":
            result.cache = value;
            break;
        }
      }
    }

    return result;
  }

  /**
   * Merge multiple sets of channel instances into a single result set.
   */
  protected mergeChannels(
    metrics: Record<string, ChannelInfo>[],
  ): Record<string, ChannelInfo> {
    // Group metrics by channel name
    const grouped = new Map<string, ChannelInfo[]>();

    for (const item of metrics) {
      for (const [channel, data] of Object.entries(item)) {
        if (!grouped.has(channel)) {
          grouped.set(channel, []);
        }
        grouped.get(channel)?.push(data);
      }
    }

    // Merge each channel's metrics
    const result: Record<string, ChannelInfo> = {};
    for (const [channel, channelMetrics] of grouped.entries()) {
      result[channel] = this.mergeChannel(channelMetrics);
    }

    return result;
  }

  /**
   * Listen for metrics from subscribers.
   */
  protected listenForMetrics(key: string): Promise<unknown[]> {
    if (!this.pubSubProvider) {
      return Promise.resolve([]);
    }
    const provider = this.pubSubProvider;
    return new Promise((resolve) => {
      provider.on("metrics-retrieved", (payload) => {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "key" in payload &&
          payload.key === key
        ) {
          const message = payload as PubSubMessage;
          if ("payload" in message) {
            this.metrics.push(message.payload);
          }

          if (
            this.subscribers !== null &&
            this.metrics.length === this.subscribers
          ) {
            resolve(this.metrics);
          }
        }
      });
    });
  }

  /**
   * Publish the metrics for the given type.
   */
  publish(
    application: Application,
    key: string,
    type: string,
    options: MetricsOptions = {},
  ): void {
    if (!this.pubSubProvider) {
      return;
    }
    this.pubSubProvider.publish({
      type: "metrics-retrieved",
      key,
      application: this.serializeApplication(application),
      payload: this.get(application, type, options),
    });
  }

  /**
   * Get meta/status information for the given channels.
   */
  protected infoForChannels(
    application: Application,
    channels: (string | Channel)[],
    info: string | string[],
  ): Record<string, ChannelInfo> {
    const result: Record<string, ChannelInfo> = {};

    for (const channel of channels) {
      const name = typeof channel === "string" ? channel : channel.name();
      result[name] = this.info(application, name, info);
    }

    return result;
  }

  /**
   * Get meta/status information for the given channel.
   */
  protected info(
    application: Application,
    channelName: string,
    info: string | string[],
  ): ChannelInfo {
    const infoArray = Array.isArray(info)
      ? info
      : info.split(",").filter((s) => s);

    const channel = this.channels.for(application).find(channelName);

    const result = channel
      ? this.occupiedInfo(channel, infoArray)
      : this.unoccupiedInfo(infoArray);

    // Filter out null values
    return Object.fromEntries(
      Object.entries(result).filter(([_, value]) => value !== null),
    ) as ChannelInfo;
  }

  /**
   * Get channel information for the given occupied channel.
   */
  protected occupiedInfo(channel: Channel, info: string[]): ChannelInfo {
    // channel.connections() returns Record<string, ChannelConnection>, get count via Object.keys()
    const count = Object.keys(channel.connections()).length;

    return {
      ...(info.includes("occupied") ? { occupied: count > 0 } : {}),
      ...(info.includes("user_count") && this.isPresenceChannel(channel)
        ? { user_count: this.userCount(channel) }
        : {}),
      ...(info.includes("subscription_count") &&
      !this.isPresenceChannel(channel)
        ? { subscription_count: count }
        : {}),
      ...(info.includes("cache") && this.isCacheChannel(channel)
        ? { cache: this.getCachedPayload(channel) }
        : {}),
    };
  }

  /**
   * Get channel information for the given unoccupied channel.
   */
  protected unoccupiedInfo(info: string[]): ChannelInfo {
    return {
      ...(info.includes("occupied") ? { occupied: false } : {}),
    };
  }

  /**
   * Determine if the given channel is a presence channel.
   */
  protected isPresenceChannel(channel: Channel): boolean {
    return channel.name().startsWith("presence-");
  }

  /**
   * Determine if the given channel is a cache channel.
   */
  protected isCacheChannel(channel: Channel): boolean {
    return "cachedPayload" in channel;
  }

  /**
   * Get the cached payload from a cache channel.
   */
  protected getCachedPayload(channel: Channel): Record<string, unknown> | null {
    if (
      "cachedPayload" in channel &&
      typeof channel.cachedPayload === "function"
    ) {
      return channel.cachedPayload();
    }
    return null;
  }

  /**
   * Get the number of unique users subscribed to the presence channel.
   */
  protected userCount(channel: Channel): number {
    const seenUserIds = new Set<string>();

    // channel.connections() returns Record<string, ChannelConnection>, convert to array
    const connections = Object.values(channel.connections());
    for (const channelConnection of connections) {
      // channelConnection.data() returns Map<string, unknown>, get user_id from Map
      const connectionData = channelConnection.data();
      const userId = connectionData.get("user_id") as string | undefined;
      if (userId) {
        seenUserIds.add(userId);
      }
    }

    return seenUserIds.size;
  }

  /**
   * Generate a random alphanumeric key.
   */
  protected generateRandomKey(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Serialize an application instance.
   */
  protected serializeApplication(application: Application): string {
    return JSON.stringify(application.toArray());
  }

  /**
   * Wrap a promise with a timeout.
   */
  protected timeoutPromise<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout"));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
