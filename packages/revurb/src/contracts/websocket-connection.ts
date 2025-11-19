import type { WebSocket } from "bun";

/**
 * WebSocketConnection Interface
 *
 * Low-level transport interface for WebSocket connections.
 * This interface abstracts the underlying WebSocket implementation details
 * and provides a consistent API for connection management, message sending,
 * and lifecycle control.
 *
 * This implementation wraps Bun's native WebSocket server.
 *
 * @see {@link https://bun.sh/docs/api/websockets Bun WebSocket API}
 */

/**
 * Frame opcodes for WebSocket control frames.
 * Based on RFC 6455 WebSocket Protocol.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6455#section-11.8 RFC 6455 Opcodes}
 */
export enum FrameOpcode {
  /** Continuation frame (0x0) */
  CONTINUATION = 0x0,
  /** Text frame (0x1) */
  TEXT = 0x1,
  /** Binary frame (0x2) */
  BINARY = 0x2,
  /** Connection close frame (0x8) */
  CLOSE = 0x8,
  /** Ping frame (0x9) */
  PING = 0x9,
  /** Pong frame (0xA) */
  PONG = 0xa,
}

/**
 * Represents a WebSocket frame for control messages.
 * Used for sending PING, PONG, and CLOSE frames.
 */
export interface Frame {
  /** The frame payload (message content) */
  payload: string | Buffer;
  /** The frame opcode indicating the frame type */
  opcode: FrameOpcode;
  /** Get the frame contents as a buffer for transmission */
  getContents(): Buffer | string;
}

/**
 * WebSocketConnection Interface
 *
 * Provides the low-level contract for WebSocket transport operations.
 * Implementations of this interface handle the raw WebSocket protocol,
 * including sending messages, control frames, and managing connection lifecycle.
 *
 * Key Responsibilities:
 * - Provide unique connection identification
 * - Send text/binary messages over the WebSocket
 * - Send control frames (PING, PONG, CLOSE)
 * - Close connections gracefully
 *
 * @example
 * ```typescript
 * // Sending a message
 * connection.send("Hello, WebSocket!");
 *
 * // Sending a control frame
 * connection.send({ payload: "", opcode: FrameOpcode.PING, getContents: () => Buffer.from("") });
 *
 * // Closing with a message
 * connection.close({ payload: "Goodbye", opcode: FrameOpcode.CLOSE, getContents: () => Buffer.from("Goodbye") });
 *
 * // Getting connection ID
 * const connectionId = connection.id();
 * ```
 */
export interface IWebSocketConnection {
  /**
   * Get the raw socket connection identifier.
   *
   * This identifier is used internally to track and manage connections.
   * This could be based on the WebSocket object's unique identifier or a generated ID.
   *
   * @returns The unique connection identifier (number for efficiency, string for flexibility)
   *
   * @example
   * ```typescript
   * const id = connection.id();
   * console.log(`Connection ID: ${id}`);
   * ```
   */
  id(): number | string;

  /**
   * Send a message or frame to the connection.
   *
   * This method handles both regular messages (strings/buffers) and control frames.
   * When sending a Frame object, the implementation should extract the frame contents
   * and transmit them according to the WebSocket protocol.
   *
   * For regular messages, the implementation may wrap them in appropriate WebSocket
   * frames (TEXT or BINARY) based on the content type.
   *
   * @param message - The message to send. Can be:
   *   - string: Text message (will be sent as TEXT frame)
   *   - Buffer: Binary message (will be sent as BINARY frame)
   *   - Frame: Control frame (PING, PONG, CLOSE)
   *
   * @throws Error if the connection is closed or invalid
   *
   * @example
   * ```typescript
   * // Send a text message
   * connection.send("Hello, client!");
   *
   * // Send a binary message
   * connection.send(Buffer.from([0x01, 0x02, 0x03]));
   *
   * // Send a PING frame
   * connection.send({
   *   payload: "",
   *   opcode: FrameOpcode.PING,
   *   getContents: () => Buffer.from("")
   * });
   * ```
   */
  send(message: string | Buffer | Frame): void;

  /**
   * Close the WebSocket connection.
   *
   * Gracefully terminates the connection. If a message is provided, it will be
   * sent as a CLOSE frame before closing the connection. The message can be a
   * Frame object with a CLOSE opcode, or a string/buffer that will be wrapped
   * in a CLOSE frame.
   *
   * After calling this method, the connection should be considered terminated
   * and no further messages should be sent or received.
   *
   * @param message - Optional close message or frame. Can be:
   *   - undefined: Close without a message
   *   - string: Close message (will be sent as CLOSE frame)
   *   - Buffer: Close message (will be sent as CLOSE frame)
   *   - Frame: Close frame with custom opcode and payload
   *
   * @example
   * ```typescript
   * // Close without a message
   * connection.close();
   *
   * // Close with a message
   * connection.close("Server shutting down");
   *
   * // Close with a custom frame
   * connection.close({
   *   payload: "Protocol violation",
   *   opcode: FrameOpcode.CLOSE,
   *   getContents: () => Buffer.from("Protocol violation")
   * });
   * ```
   */
  close(message?: string | Buffer | Frame): void;
}

/**
 * Type alias for the WebSocketConnection interface.
 * Provides a shorter name for use in type annotations.
 */
export type WebSocketConnection = IWebSocketConnection;

/**
 * Factory type for creating WebSocket connections.
 * Used by server implementations to instantiate new connections.
 */
export type WebSocketConnectionFactory = (
  socket: WebSocket,
) => IWebSocketConnection;
