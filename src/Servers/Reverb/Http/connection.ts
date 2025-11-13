/**
 * HTTP Connection Wrapper
 *
 * Wraps an underlying socket/connection and manages state for HTTP message handling.
 * This class is used by the Reverb server to manage HTTP connections before they're
 * upgraded to WebSocket connections.
 */
export class Connection {
  private id: number;
  private connected: boolean = false;
  private _buffer: string = '';

  /**
   * Create a new HTTP connection instance.
   *
   * @param connection - The underlying socket/connection object
   */
  constructor(private readonly connection: any) {
    this.id = Number(connection.stream) || 0;
  }

  /**
   * Get the connection ID.
   *
   * @returns The connection ID as a number
   */
  getId(): number {
    return this.id;
  }

  /**
   * Mark the connection as connected.
   *
   * @returns This connection instance for method chaining
   */
  connect(): this {
    this.connected = true;
    return this;
  }

  /**
   * Determine whether the connection is connected.
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the HTTP message buffer.
   *
   * @returns The current buffer content as a string
   */
  buffer(): string {
    return this._buffer;
  }

  /**
   * Determine whether the connection has an HTTP message buffer set.
   *
   * @returns true if buffer contains data, false if empty
   */
  hasBuffer(): boolean {
    return this._buffer !== '';
  }

  /**
   * Get the HTTP message buffer length.
   *
   * @returns The buffer length as a number
   */
  bufferLength(): number {
    return this._buffer.length;
  }

  /**
   * Append data to the HTTP message buffer.
   *
   * @param message - The data to append to the buffer
   * @returns This connection instance for method chaining
   */
  appendToBuffer(message: string): this {
    this._buffer += message;
    return this;
  }

  /**
   * Clear the HTTP message buffer.
   *
   * @returns This connection instance for method chaining
   */
  clearBuffer(): this {
    this._buffer = '';
    return this;
  }

  /**
   * Send data to the connection.
   *
   * @param data - The data to send
   * @returns This connection instance for method chaining
   */
  send(data: string | Uint8Array): this {
    this.connection.write(data);
    return this;
  }

  /**
   * Close the connection.
   *
   * @returns This connection instance for method chaining
   */
  close(): this {
    this.connection.end();
    return this;
  }
}
