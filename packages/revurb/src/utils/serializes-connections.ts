import type { Application } from "../application";
import type { IApplicationProvider } from "../contracts/application-provider";

/**
 * Serialized connection data structure.
 *
 * Represents the JSON-serializable state of a Connection instance.
 * Used for persisting connection state across process boundaries or storage.
 */
export interface SerializedConnection {
  /** The raw socket connection identifier */
  id: string;
  /** The normalized socket ID (format: "number.number") */
  identifier: string;
  /** The application ID this connection belongs to */
  application: string;
  /** The origin of the connection (nullable) */
  origin: string | null;
  /** The last time the connection was seen (in seconds) */
  lastSeenAt: number;
  /** Whether the connection has been pinged */
  hasBeenPinged: boolean;
}

/**
 * Interface for objects that can be serialized/deserialized.
 *
 * Provides methods for converting connection instances to/from
 * JSON-serializable format for storage, transmission, or persistence.
 */
export interface ISerializableConnection {
  /**
   * Get the raw socket connection identifier.
   * @returns The raw connection identifier
   */
  identifier(): string;

  /**
   * Get the normalized socket ID.
   * @returns The normalized socket ID (e.g., "123456789.987654321")
   */
  id(): string;

  /**
   * Get the application the connection belongs to.
   * @returns The Application instance
   */
  app(): Application;

  /**
   * Get the origin of the connection.
   * @returns The connection origin or null
   */
  getOrigin(): string | null;

  /**
   * Get the last time the connection was seen.
   * @returns The last seen timestamp in seconds
   */
  getLastSeenAt(): number;
}

/**
 * Serialize a connection instance to JSON-compatible format.
 *
 * Converts a Connection instance into a plain object that can be
 * serialized to JSON for storage or transmission. The serialized
 * format includes all state needed to restore the connection later.
 *
 * @param connection - The connection instance to serialize
 * @returns Serialized connection data
 *
 * @example
 * ```typescript
 * const serialized = serializeConnection(connection);
 * const json = JSON.stringify(serialized);
 * // Store or transmit json...
 * ```
 */
export function serializeConnection(
  connection: ISerializableConnection & {
    hasBeenPinged: boolean;
  },
): SerializedConnection {
  return {
    id: connection.id(),
    identifier: connection.identifier(),
    application: connection.app().id(),
    origin: connection.getOrigin(),
    lastSeenAt: connection.getLastSeenAt(),
    hasBeenPinged: connection.hasBeenPinged,
  };
}

/**
 * Deserialize connection data and restore connection state.
 *
 * Takes serialized connection data and restores the connection state
 * by looking up the application and setting all connection properties.
 * This is used to reconstruct connections from persistent storage.
 *
 * Note: This function only restores the CONNECTION STATE (metadata).
 * It does NOT restore the underlying WebSocket connection itself,
 * which must be managed separately by the server.
 *
 * @param data - The serialized connection data
 * @param applicationProvider - Provider to look up applications
 * @returns Object containing all restored connection properties
 * @throws {InvalidApplication} If the application cannot be found
 *
 * @example
 * ```typescript
 * const json = '{"id":"123.456","identifier":"123",...}';
 * const data = JSON.parse(json);
 * const restored = deserializeConnection(data, appProvider);
 *
 * // Use restored data to reconstruct connection:
 * connection.setLastSeenAt(restored.lastSeenAt);
 * connection.hasBeenPinged = restored.hasBeenPinged;
 * // ... etc
 * ```
 */
export function deserializeConnection(
  data: SerializedConnection,
  applicationProvider: IApplicationProvider,
): {
  id: string;
  identifier: string;
  application: Application;
  origin: string | null;
  lastSeenAt: number;
  hasBeenPinged: boolean;
} {
  return {
    id: data.id,
    identifier: data.identifier,
    application: applicationProvider.findById(data.application),
    origin: data.origin,
    lastSeenAt: data.lastSeenAt ?? null,
    hasBeenPinged: data.hasBeenPinged ?? false,
  };
}

/**
 * Serialize a connection instance to a JSON string.
 *
 * Convenience function that combines serializeConnection() with JSON.stringify().
 * Useful for quick serialization to storage or network transmission.
 *
 * @param connection - The connection instance to serialize
 * @returns JSON string representation of the connection
 *
 * @example
 * ```typescript
 * const json = connectionToJson(connection);
 * localStorage.setItem('connection', json);
 * ```
 */
export function connectionToJson(
  connection: ISerializableConnection & {
    hasBeenPinged: boolean;
  },
): string {
  return JSON.stringify(serializeConnection(connection));
}

/**
 * Deserialize a connection from a JSON string.
 *
 * Convenience function that combines JSON.parse() with deserializeConnection().
 * Useful for quick deserialization from storage or network sources.
 *
 * @param json - The JSON string to deserialize
 * @param applicationProvider - Provider to look up applications
 * @returns Object containing all restored connection properties
 * @throws {InvalidApplication} If the application cannot be found
 * @throws {SyntaxError} If the JSON is invalid
 *
 * @example
 * ```typescript
 * const json = localStorage.getItem('connection');
 * const restored = connectionFromJson(json, appProvider);
 * ```
 */
export function connectionFromJson(
  json: string,
  applicationProvider: IApplicationProvider,
): ReturnType<typeof deserializeConnection> {
  const data = JSON.parse(json) as SerializedConnection;
  return deserializeConnection(data, applicationProvider);
}
