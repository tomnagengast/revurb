import type { Application } from '../application';
import type { IWebSocketConnection, FrameOpcode } from './websocket-connection';

/**
 * Connection State Machine
 *
 * The Connection class tracks connection state using a timestamp-based state machine:
 *
 * State Transitions:
 * 1. ACTIVE: Connection is actively communicating (lastSeenAt within pingInterval)
 * 2. INACTIVE: Connection has not been seen recently (lastSeenAt exceeds pingInterval)
 * 3. STALE: Connection is INACTIVE and has been pinged but not responded (hasBeenPinged = true)
 *
 * State Determination:
 * - isActive(): time() < lastSeenAt + app.pingInterval()
 * - isInactive(): !isActive()
 * - isStale(): isInactive() && hasBeenPinged
 *
 * Lifecycle:
 * 1. Connection created → lastSeenAt = time(), hasBeenPinged = false
 * 2. Activity detected → touch() → lastSeenAt = time(), hasBeenPinged = false
 * 3. No activity for pingInterval → isInactive() = true
 * 4. Ping sent → ping() → hasBeenPinged = true
 * 5. Pong received → pong() → hasBeenPinged = false
 * 6. No response after ping → isStale() = true → connection pruned
 *
 * Timestamps:
 * - All timestamps use SECONDS (not milliseconds)
 * - Use Math.floor(Date.now() / 1000) to get current time in seconds
 * - This matches PHP's time() function behavior
 */

/**
 * Connection Abstract Class
 *
 * Application-aware connection wrapper that manages WebSocket connection state,
 * tracking, and lifecycle. Extends raw WebSocketConnection with application context,
 * activity tracking, and state management.
 *
 * Key Responsibilities:
 * - Wrap WebSocketConnection with application context
 * - Track connection activity via lastSeenAt timestamp
 * - Implement state machine (Active/Inactive/Stale)
 * - Manage ping/pong state for connection health
 * - Generate normalized socket IDs
 * - Provide connection lifecycle methods
 *
 * @abstract
 *
 * @example
 * ```typescript
 * class ReverbConnection extends Connection {
 *   identifier(): string {
 *     return String(this.connection.id());
 *   }
 *
 *   id(): string {
 *     if (!this._id) {
 *       this._id = this.generateId();
 *     }
 *     return this._id;
 *   }
 *
 *   send(message: string): void {
 *     this.connection.send(message);
 *     // Dispatch MessageSent event
 *   }
 *
 *   control(type: FrameOpcode = FrameOpcode.PING): void {
 *     this.connection.send({ payload: '', opcode: type, getContents: () => '' });
 *   }
 *
 *   terminate(): void {
 *     this.connection.close();
 *   }
 * }
 * ```
 */
export abstract class Connection {
  /**
   * The last time the connection was seen (in seconds, not milliseconds).
   *
   * Initialized to current time when connection is created.
   * Updated via touch() when activity is detected.
   * Used to determine connection state (active/inactive/stale).
   *
   * @protected
   */
  protected lastSeenAt: number;

  /**
   * Stores the ping state of the connection.
   *
   * Set to true when a ping is sent to the connection.
   * Set to false when a pong is received or activity is detected.
   * Used to determine if connection is stale (inactive + pinged).
   *
   * @protected
   */
  protected hasBeenPinged: boolean = false;

  /**
   * Indicates if the connection uses control frames for activity tracking.
   *
   * When true, the connection uses PING/PONG frames to track activity.
   * When false, the connection may use other mechanisms for activity tracking.
   *
   * @protected
   */
  protected _usesControlFrames: boolean = false;

  /**
   * Create a new connection instance.
   *
   * @param connection - The underlying WebSocket connection
   * @param application - The application this connection belongs to
   * @param origin - The origin of the connection (nullable)
   */
  constructor(
    protected readonly connection: IWebSocketConnection,
    protected readonly application: Application,
    protected readonly origin: string | null
  ) {
    // Initialize lastSeenAt with current time in SECONDS
    this.lastSeenAt = Math.floor(Date.now() / 1000);
  }

  /**
   * Get the raw socket connection identifier.
   *
   * Returns the underlying WebSocket connection's identifier.
   * This is typically a raw socket ID or resource identifier.
   *
   * @returns The raw connection identifier as a string
   *
   * @abstract
   */
  abstract identifier(): string;

  /**
   * Get the normalized socket ID.
   *
   * Returns a Pusher-compatible socket ID (format: "number.number").
   * This ID is generated once and cached for the connection lifetime.
   *
   * @returns The normalized socket ID (e.g., "123456789.987654321")
   *
   * @abstract
   */
  abstract id(): string;

  /**
   * Send a message to the connection.
   *
   * Sends a message over the WebSocket connection.
   * Implementations should dispatch a MessageSent event after sending.
   *
   * @param message - The message to send
   *
   * @abstract
   */
  abstract send(message: string): void;

  /**
   * Send a control frame to the connection.
   *
   * Sends a WebSocket control frame (PING, PONG, or CLOSE).
   * Default is PING frame for connection health checks.
   *
   * @param type - The frame opcode (default: PING)
   *
   * @abstract
   */
  abstract control(type?: FrameOpcode): void;

  /**
   * Terminate a connection.
   *
   * Closes the underlying WebSocket connection.
   * This is the final operation on a connection.
   *
   * @abstract
   */
  abstract terminate(): void;

  /**
   * Get the application the connection belongs to.
   *
   * @returns The Application instance
   */
  app(): Application {
    return this.application;
  }

  /**
   * Get the origin of the connection.
   *
   * @returns The connection origin or null
   */
  getOrigin(): string | null {
    return this.origin;
  }

  /**
   * Mark the connection as pinged.
   *
   * Sets hasBeenPinged to true, indicating a ping was sent.
   * Used in the state machine to determine if connection is stale.
   */
  ping(): void {
    this.hasBeenPinged = true;
  }

  /**
   * Mark the connection as ponged.
   *
   * Sets hasBeenPinged to false, indicating a pong was received.
   * Resets the ping state, showing the connection is responsive.
   */
  pong(): void {
    this.hasBeenPinged = false;
  }

  /**
   * Get the last time the connection was seen.
   *
   * @returns The last seen timestamp in seconds (not milliseconds)
   */
  getLastSeenAt(): number {
    return this.lastSeenAt;
  }

  /**
   * Set the connection last seen at timestamp.
   *
   * @param time - The timestamp in seconds (not milliseconds)
   * @returns This connection instance for chaining
   */
  setLastSeenAt(time: number): this {
    this.lastSeenAt = time;
    return this;
  }

  /**
   * Touch the connection last seen at timestamp.
   *
   * Updates lastSeenAt to current time and resets ping state.
   * Call this when any activity is detected on the connection.
   *
   * @returns This connection instance for chaining
   */
  touch(): this {
    this.setLastSeenAt(Math.floor(Date.now() / 1000));
    this.pong();
    return this;
  }

  /**
   * Disconnect and unsubscribe from all channels.
   *
   * Convenience method that delegates to terminate().
   * Implementations may override to add channel cleanup logic.
   */
  disconnect(): void {
    this.terminate();
  }

  /**
   * Determine whether the connection is still active.
   *
   * A connection is active if it has been seen within the ping interval.
   * Formula: currentTime < lastSeenAt + pingInterval
   *
   * @returns true if connection is active, false otherwise
   */
  isActive(): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime < this.lastSeenAt + this.app().pingInterval();
  }

  /**
   * Determine whether the connection is inactive.
   *
   * A connection is inactive if it has not been seen within the ping interval.
   * Inverse of isActive().
   *
   * @returns true if connection is inactive, false otherwise
   */
  isInactive(): boolean {
    return !this.isActive();
  }

  /**
   * Determine whether the connection is stale.
   *
   * A connection is stale if:
   * 1. It is inactive (not seen within ping interval)
   * 2. It has been pinged but not responded
   *
   * Stale connections should be pruned/removed.
   *
   * @returns true if connection is stale, false otherwise
   */
  isStale(): boolean {
    return this.isInactive() && this.hasBeenPinged;
  }

  /**
   * Determine whether the connection uses control frames.
   *
   * @returns true if connection uses control frames, false otherwise
   */
  usesControlFrames(): boolean {
    return this._usesControlFrames;
  }

  /**
   * Mark the connection as using control frames to track activity.
   *
   * @param usesControlFrames - Whether to use control frames (default: true)
   * @returns This connection instance for chaining
   */
  setUsesControlFrames(usesControlFrames: boolean = true): this {
    this._usesControlFrames = usesControlFrames;
    return this;
  }

  /**
   * Generate a Pusher-compatible socket ID.
   *
   * Generates a unique ID in the format "number.number" where each number
   * is a random integer between 1 and 1,000,000,000.
   *
   * This matches the format expected by Pusher clients.
   *
   * @returns A generated socket ID (e.g., "123456789.987654321")
   *
   * @protected
   */
  protected generateId(): string {
    const part1 = Math.floor(Math.random() * 1_000_000_000) + 1;
    const part2 = Math.floor(Math.random() * 1_000_000_000) + 1;
    return `${part1}.${part2}`;
  }
}
