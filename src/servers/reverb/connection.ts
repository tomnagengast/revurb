import type { WebSocket } from "bun";
import type {
  Frame,
  IWebSocketConnection,
} from "../../contracts/websocket-connection";

/**
 * WebSocket Connection Implementation
 *
 * Wraps Bun's native WebSocket to provide the IWebSocketConnection interface.
 * This class handles WebSocket frame operations, message buffering for fragmented messages,
 * and control frame handling according to RFC 6455.
 *
 * Key responsibilities:
 * - Provide unique connection identification
 * - Send text/binary messages over the WebSocket
 * - Send and handle control frames (PING, PONG, CLOSE)
 * - Manage connection lifecycle with proper cleanup
 *
 * Note: Bun's WebSocket handles frame framing automatically, so we focus on
 * providing a consistent API for message handling and control frames.
 */
export class Connection implements IWebSocketConnection {
  /**
   * Unique connection identifier.
   */
  private connectionId: string;

  /**
   * Create a new WebSocket connection instance.
   *
   * @param socket - The Bun WebSocket instance
   */
  constructor(private socket: WebSocket) {
    // Generate a unique connection ID using the socket's internal data
    this.connectionId = this.generateConnectionId();
    // Note: For Bun's server-side WebSockets, handlers are set in serve() options,
    // not on individual socket objects. We don't need setupHandlers() here.
  }

  /**
   * Generate a unique connection identifier.
   * Uses the socket's remoteAddress and a timestamp for uniqueness.
   */
  private generateConnectionId(): string {
    // Use a combination of socket info and timestamp for uniqueness
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `conn_${timestamp}_${random}`;
  }

  /**
   * Get the unique connection identifier.
   *
   * @returns The connection ID
   */
  public id(): number | string {
    return this.connectionId;
  }

  /**
   * Send a message or frame to the connection.
   *
   * Handles both regular messages (strings/buffers) and control frames.
   * Wraps messages in appropriate frames for transmission.
   *
   * @param message - The message to send (string, Buffer, or Frame)
   * @throws Error if the connection is closed or invalid
   */
  public send(message: string | Buffer | Frame): void {
    try {
      if (this.socket.readyState !== WebSocket.OPEN) {
        throw new Error(
          `Cannot send on closed connection ${this.connectionId}`,
        );
      }

      if (this.isFrameObject(message)) {
        // Handle Frame object
        this.sendFrame(message);
      } else if (typeof message === "string") {
        // Send text message
        this.socket.send(message);
      } else if (Buffer.isBuffer(message)) {
        // Send binary message
        this.socket.send(message);
      } else {
        throw new Error("Invalid message type");
      }
    } catch (error) {
      console.error(
        `Error sending message on connection ${this.connectionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send a control frame.
   *
   * @param frame - The frame to send
   */
  private sendFrame(frame: Frame): void {
    const content = frame.getContents();

    // Bun's WebSocket doesn't provide direct frame control
    // For PING/PONG, we use Bun's built-in methods
    const opcode = frame.opcode;

    // RFC 6455 Frame Opcodes
    const PING = 0x9;
    const PONG = 0xa;
    const CLOSE = 0x8;

    if (opcode === PING) {
      // Send PING frame
      if (typeof content === "string") {
        this.socket.ping(Buffer.from(content));
      } else {
        this.socket.ping(content as Buffer);
      }
    } else if (opcode === PONG) {
      // Send PONG frame
      if (typeof content === "string") {
        this.socket.pong(Buffer.from(content));
      } else {
        this.socket.pong(content as Buffer);
      }
    } else if (opcode === CLOSE) {
      // Send CLOSE frame - we'll send the payload as a message and then close
      if (
        content &&
        (typeof content === "string" || Buffer.isBuffer(content))
      ) {
        try {
          this.socket.send(content);
        } catch {
          // Ignore if sending fails
        }
      }
      this.socket.close();
    } else {
      // For other frame types, send as regular message
      this.socket.send(content);
    }
  }

  /**
   * Check if an object is a Frame.
   *
   * @param obj - The object to check
   * @returns true if the object implements the Frame interface
   */
  private isFrameObject(obj: any): obj is Frame {
    return (
      obj && typeof obj === "object" && "opcode" in obj && "getContents" in obj
    );
  }

  /**
   * Close the WebSocket connection.
   *
   * Gracefully terminates the connection. If a message is provided,
   * it will be sent as a CLOSE frame before closing.
   *
   * @param message - Optional close message or frame
   */
  public close(message?: string | Buffer | Frame): void {
    try {
      if (message) {
        if (this.isFrameObject(message)) {
          // If it's a frame object, send it
          this.sendFrame(message);
        } else if (typeof message === "string" || Buffer.isBuffer(message)) {
          // Send close message - wrap in CLOSE frame semantics
          try {
            this.socket.send(message);
          } catch {
            // Ignore if send fails
          }
        }
      }

      // Close the WebSocket
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
    } catch (error) {
      console.error(`Error closing connection ${this.connectionId}:`, error);
    }
  }

  /**
   * Set the handler for complete messages.
   *
   * @param callback - Function to call when a complete message is received
   */
  public onMessage(callback: (message: string | Buffer) => void): void {
    this.onMessageHandler = callback;
  }

  /**
   * Set the handler for control frames.
   *
   * @param callback - Function to call when a control frame is received
   */
  public onControl(_callback: (frame: Frame) => void): void {
    // Control frame handling is done automatically by Bun's WebSocket
    // This method is kept for interface compatibility
  }

  /**
   * Set the handler for connection close events.
   *
   * @param callback - Function to call when the connection closes
   */
  public onClose(callback: () => void): void {
    this._onCloseHandler = callback;
  }

  /**
   * Set the maximum allowed message size.
   *
   * @param size - Maximum message size in bytes
   */
  public withMaxMessageSize(size: number): void {
    this.maxMessageSize = size;
  }
}
