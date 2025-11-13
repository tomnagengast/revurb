/**
 * HTTP Request Parser
 *
 * Handles parsing raw HTTP message strings into Request objects.
 * Implements HTTP message buffering with size limits and End-Of-Message (EOM) detection.
 */

// Re-export IHttpRequest for use by controllers
export type { IHttpRequest } from "./router";

import type { IHttpRequest } from "./router";

/**
 * Extended HTTP Request interface with additional properties for internal use.
 */
interface IHttpRequestInternal extends IHttpRequest {
  /** HTTP method (GET, POST, etc.) - property for direct access */
  method: string;
  /** Request path with query string - property for direct access */
  path: string;
  /** HTTP version (1.0, 1.1, 2.0) */
  httpVersion: string;
  /** Headers mapping header names to values */
  headers: Record<string, string>;
  /** Request body content */
  body: string;
  /** Get body size in bytes */
  getSize(): number;
}

/**
 * End of message delimiter per HTTP specification.
 */
const EOM = "\r\n\r\n";

/**
 * Determine if the message has been fully received per HTTP specification.
 *
 * Checks for the End-Of-Message marker "\r\n\r\n" which indicates
 * the end of HTTP headers. This marker must be present for the message
 * to be considered complete (headers-wise).
 *
 * @param message - The HTTP message buffer to check
 * @returns true if EOM marker is found, false otherwise
 *
 * @example
 * ```typescript
 * const hasEom = isEndOfMessage('GET / HTTP/1.1\r\n\r\n');
 * // Returns true
 * ```
 */
function isEndOfMessage(message: string): boolean {
  return message.includes(EOM);
}

/**
 * Parse raw HTTP message into a structured Request object.
 *
 * Parses the request line (method, path, HTTP version) and headers.
 * Separates headers from body using the EOM delimiter.
 *
 * @param buffer - The complete HTTP message buffer
 * @returns Parsed request object or null if parsing fails
 *
 * @example
 * ```typescript
 * const request = parseRequest('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n');
 * // Returns { method: 'GET', path: '/', httpVersion: '1.1', headers: {...}, body: '' }
 * ```
 */
function parseRequest(buffer: string): IHttpRequestInternal | null {
  // Split headers and body by EOM marker
  const eomIndex = buffer.indexOf(EOM);
  if (eomIndex === -1) {
    return null;
  }

  const headerSection = buffer.substring(0, eomIndex);
  const bodySection = buffer.substring(eomIndex + EOM.length);

  // Split header section into lines
  const lines = headerSection.split("\r\n");

  if (lines.length === 0) {
    return null;
  }

  // Parse request line
  const requestLine = lines[0];
  if (!requestLine) {
    return null;
  }

  const requestParts = requestLine.split(" ");

  if (requestParts.length < 3) {
    return null;
  }

  const method = requestParts[0];
  const path = requestParts[1];
  const httpVersionFull = requestParts[2]; // e.g., "HTTP/1.1"

  if (!method || !path || !httpVersionFull) {
    return null;
  }

  const httpVersion = httpVersionFull.replace(/^HTTP\//, ""); // e.g., "1.1"

  // Parse headers
  const headers: Record<string, string> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const headerName = line.substring(0, colonIndex).trim().toLowerCase();
    const headerValue = line.substring(colonIndex + 1).trim();

    headers[headerName] = headerValue;
  }

  // Extract host from headers
  const host = headers.host || "";

  // Create request object matching Router's IHttpRequest interface
  const request: IHttpRequestInternal = {
    method,
    path,
    httpVersion,
    headers,
    body: bodySection,
    getMethod(): string {
      return method;
    },
    getPath(): string {
      return path;
    },
    getHost(): string {
      return host;
    },
    getHeader(name: string): string | undefined {
      return headers[name.toLowerCase()];
    },
    getHeaders(): Record<string, string> {
      return { ...headers };
    },
    getUri(): { path: string; host: string } {
      return { path, host };
    },
    getSize(): number {
      return Buffer.byteLength(bodySection, "utf8");
    },
  };

  return request;
}

/**
 * Parse a raw HTTP message string into a Request object.
 *
 * This function handles the core logic of:
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
 * const request = parseHttpRequest(httpMessage, connection, 4096);
 * if (request) {
 *   console.log(request.method, request.path);
 * }
 * ```
 */
function parseHttpRequest(
  message: string,
  connection: {
    appendToBuffer(msg: string): void;
    bufferLength(): number;
    buffer(): string;
    clearBuffer(): void;
  },
  maxRequestSize: number,
): IHttpRequestInternal | null {
  // Append message to buffer
  connection.appendToBuffer(message);

  // Check if buffer exceeds maximum size
  if (connection.bufferLength() > maxRequestSize) {
    throw new Error(`Maximum HTTP buffer size of ${maxRequestSize} exceeded.`);
  }

  const buffer = connection.buffer();

  // Check if we have reached the end of message
  if (!isEndOfMessage(buffer)) {
    return null;
  }

  // Parse the request
  const request = parseRequest(buffer);

  if (!request) {
    return null;
  }

  // Get Content-Length header if present
  const contentLength = request.getHeader("content-length");

  // If no Content-Length header, return immediately
  if (!contentLength) {
    connection.clearBuffer();
    return request;
  }

  // Validate that we have received the full body
  const expectedLength = Number.parseInt(contentLength, 10);
  const bodySize = request.getSize();

  if (bodySize < expectedLength) {
    return null;
  }

  // Clear buffer on successful parse
  connection.clearBuffer();

  return request;
}

/**
 * Request namespace for backward compatibility.
 * Use parseHttpRequest directly instead.
 */
const Request = {
  from: parseHttpRequest,
};

export { Request, parseHttpRequest };
