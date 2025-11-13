/**
 * HTTP Request Parser
 *
 * Handles parsing raw HTTP message strings into Request objects.
 * Implements HTTP message buffering with size limits and End-Of-Message (EOM) detection.
 */

/**
 * Represents an HTTP request with headers and body.
 *
 * @interface IHttpRequest
 */
interface IHttpRequest {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Request path with query string */
  path: string;
  /** HTTP version (1.0, 1.1, 2.0) */
  httpVersion: string;
  /** Headers mapping header names to values */
  headers: Record<string, string>;
  /** Request body content */
  body: string;
  /** Get a header value by name (case-insensitive) */
  getHeader(name: string): string | undefined;
  /** Get body size in bytes */
  getSize(): number;
}

/**
 * HTTP Request class for parsing and managing HTTP requests.
 *
 * Parses raw HTTP message strings according to HTTP specification.
 * Handles buffer management with configurable size limits.
 * Validates Content-Length headers to ensure complete message receipt.
 *
 * @class Request
 */
class Request {
  /**
   * End of message delimiter per HTTP specification.
   *
   * @private
   * @readonly
   */
  private static readonly EOM = '\r\n\r\n';

  /**
   * Parse a raw HTTP message string into a Request object.
   *
   * This static method handles the core logic of:
   * 1. Appending the message to the connection buffer
   * 2. Checking buffer size limits (throws OverflowException if exceeded)
   * 3. Detecting End-Of-Message marker
   * 4. Parsing headers and body
   * 5. Validating Content-Length header
   * 6. Clearing buffer on successful parse
   *
   * @param message - Raw HTTP message string to parse
   * @param connection - Connection object with buffer management methods
   * @param maxRequestSize - Maximum allowed buffer size in bytes
   * @returns Parsed Request object if complete, null if incomplete
   * @throws {Error} Throws error if buffer exceeds maxRequestSize
   *
   * @example
   * ```typescript
   * const request = Request.from(httpMessage, connection, 4096);
   * if (request) {
   *   console.log(request.method, request.path);
   * }
   * ```
   */
  static from(
    message: string,
    connection: {
      appendToBuffer(msg: string): void;
      bufferLength(): number;
      buffer(): string;
      clearBuffer(): void;
    },
    maxRequestSize: number
  ): IHttpRequest | null {
    // Append message to buffer
    connection.appendToBuffer(message);

    // Check if buffer exceeds maximum size
    if (connection.bufferLength() > maxRequestSize) {
      throw new Error(`Maximum HTTP buffer size of ${maxRequestSize} exceeded.`);
    }

    const buffer = connection.buffer();

    // Check if we have reached the end of message
    if (!this.isEndOfMessage(buffer)) {
      return null;
    }

    // Parse the request
    const request = this.parseRequest(buffer);

    if (!request) {
      return null;
    }

    // Get Content-Length header if present
    const contentLength = request.getHeader('content-length');

    // If no Content-Length header, return immediately
    if (!contentLength) {
      connection.clearBuffer();
      return request;
    }

    // Validate that we have received the full body
    const expectedLength = parseInt(contentLength, 10);
    const bodySize = request.getSize();

    if (bodySize < expectedLength) {
      return null;
    }

    // Clear buffer on successful parse
    connection.clearBuffer();

    return request;
  }

  /**
   * Determine if the message has been fully received per HTTP specification.
   *
   * Checks for the End-Of-Message marker "\r\n\r\n" which indicates
   * the end of HTTP headers. This marker must be present for the message
   * to be considered complete (headers-wise).
   *
   * @private
   * @static
   * @param message - The HTTP message buffer to check
   * @returns true if EOM marker is found, false otherwise
   *
   * @example
   * ```typescript
   * const hasEom = this.isEndOfMessage('GET / HTTP/1.1\r\n\r\n');
   * // Returns true
   * ```
   */
  private static isEndOfMessage(message: string): boolean {
    return message.includes(this.EOM);
  }

  /**
   * Parse raw HTTP message into a structured Request object.
   *
   * Parses the request line (method, path, HTTP version) and headers.
   * Separates headers from body using the EOM delimiter.
   *
   * @private
   * @static
   * @param buffer - The complete HTTP message buffer
   * @returns Parsed request object or null if parsing fails
   *
   * @example
   * ```typescript
   * const request = this.parseRequest('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n');
   * // Returns { method: 'GET', path: '/', httpVersion: '1.1', headers: {...}, body: '' }
   * ```
   */
  private static parseRequest(buffer: string): IHttpRequest | null {
    // Split headers and body by EOM marker
    const eomIndex = buffer.indexOf(this.EOM);
    if (eomIndex === -1) {
      return null;
    }

    const headerSection = buffer.substring(0, eomIndex);
    const bodySection = buffer.substring(eomIndex + this.EOM.length);

    // Split header section into lines
    const lines = headerSection.split('\r\n');

    if (lines.length === 0) {
      return null;
    }

    // Parse request line
    const requestLine = lines[0];
    if (!requestLine) {
      return null;
    }

    const requestParts = requestLine.split(' ');

    if (requestParts.length < 3) {
      return null;
    }

    const method = requestParts[0];
    const path = requestParts[1];
    const httpVersionFull = requestParts[2]; // e.g., "HTTP/1.1"

    if (!method || !path || !httpVersionFull) {
      return null;
    }

    const httpVersion = httpVersionFull.replace(/^HTTP\//, ''); // e.g., "1.1"

    // Parse headers
    const headers: Record<string, string> = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const headerName = line.substring(0, colonIndex).trim().toLowerCase();
      const headerValue = line.substring(colonIndex + 1).trim();

      headers[headerName] = headerValue;
    }

    // Create request object
    const request: IHttpRequest = {
      method,
      path,
      httpVersion,
      headers,
      body: bodySection,
      getHeader(name: string): string | undefined {
        return this.headers[name.toLowerCase()];
      },
      getSize(): number {
        return Buffer.byteLength(this.body, 'utf8');
      },
    };

    return request;
  }
}

export { Request, type IHttpRequest };
