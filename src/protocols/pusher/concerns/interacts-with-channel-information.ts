import type { Application } from "../../../application";

/**
 * Types for channel information
 */
export interface ChannelInfo {
  occupied?: boolean;
  user_count?: number;
  subscription_count?: number;
  cache?: unknown;
}

export interface ChannelConnection {
  data(key?: string): any;
  send(message: string): void;
}

export interface Channel {
  name(): string;
  connections(): Record<string, ChannelConnection>;
  cachedPayload?(): any;
}

export interface ChannelManager {
  for(application: Application): ChannelManager;
  find(channel: string): Channel | null;
}

/**
 * Utility functions for interacting with channel information.
 * Provides methods to retrieve meta/status information for channels.
 */

/**
 * Get meta/status information for the given channels.
 *
 * @param application - The application instance
 * @param channels - Array of channel names or Channel instances
 * @param info - Comma-separated list of info fields to retrieve
 * @param channelManager - The channel manager instance
 * @returns Object mapping channel names to their info
 */
export function infoForChannels(
  application: Application,
  channels: (string | Channel)[],
  info: string,
  channelManager: ChannelManager,
): Record<string, ChannelInfo> {
  const result: Record<string, ChannelInfo> = {};

  for (const channel of channels) {
    const name = typeof channel === "string" ? channel : channel.name();
    result[name] = getChannelInfo(application, name, info, channelManager);
  }

  return result;
}

/**
 * Get meta/status information for the given channel.
 *
 * @param application - The application instance
 * @param channelName - The channel name
 * @param info - Comma-separated list of info fields to retrieve
 * @param channelManager - The channel manager instance
 * @returns Object containing requested channel information
 */
export function getChannelInfo(
  application: Application,
  channelName: string,
  info: string,
  channelManager: ChannelManager,
): ChannelInfo {
  const infoFields = info.split(",").map((field) => field.trim());
  const channel = channelManager.for(application).find(channelName);

  if (channel) {
    return getOccupiedInfo(channel, infoFields);
  }

  return getUnoccupiedInfo(infoFields);
}

/**
 * Get channel information for the given occupied channel.
 *
 * @param channel - The channel instance
 * @param info - Array of info fields to retrieve
 * @returns Object containing channel information
 */
function getOccupiedInfo(channel: Channel, info: string[]): ChannelInfo {
  const connections = channel.connections();
  const count = Object.keys(connections).length;

  const result: ChannelInfo = {};

  if (info.includes("occupied")) {
    result.occupied = count > 0;
  }

  if (info.includes("user_count") && isPresenceChannel(channel)) {
    result.user_count = getUserCount(channel);
  }

  if (info.includes("subscription_count") && !isPresenceChannel(channel)) {
    result.subscription_count = count;
  }

  if (info.includes("cache") && isCacheChannel(channel)) {
    result.cache = channel.cachedPayload?.();
  }

  return result;
}

/**
 * Get channel information for the given unoccupied channel.
 *
 * @param info - Array of info fields to retrieve
 * @returns Object containing channel information
 */
function getUnoccupiedInfo(info: string[]): ChannelInfo {
  const result: ChannelInfo = {};

  if (info.includes("occupied")) {
    result.occupied = false;
  }

  return result;
}

/**
 * Determine if the given channel is a presence channel.
 *
 * @param channel - The channel instance
 * @returns True if the channel is a presence channel
 */
export function isPresenceChannel(channel: Channel): boolean {
  // Check if the channel has presence-specific methods/properties
  // In TypeScript, we can check for the existence of presence-specific methods
  return "data" in channel && typeof (channel as any).data === "function";
}

/**
 * Determine if the given channel is a cache channel.
 *
 * @param channel - The channel instance
 * @returns True if the channel is a cache channel
 */
export function isCacheChannel(channel: Channel): boolean {
  // Check if the channel has cachedPayload method
  return (
    "cachedPayload" in channel && typeof channel.cachedPayload === "function"
  );
}

/**
 * Get the number of unique users subscribed to the presence channel.
 *
 * @param channel - The channel instance
 * @returns The number of unique users
 */
export function getUserCount(channel: Channel): number {
  const connections = Object.values(channel.connections());
  const uniqueUserIds = new Set<string>();

  for (const connection of connections) {
    const userId = connection.data("user_id");
    if (userId !== null && userId !== undefined) {
      uniqueUserIds.add(String(userId));
    }
  }

  return uniqueUserIds.size;
}
