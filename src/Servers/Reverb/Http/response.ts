/**
 * HTTP Response class for JSON responses
 *
 * Represents an HTTP JSON response with support for:
 * - Custom status codes
 * - Custom headers
 * - Automatic Content-Length calculation
 * - Serialization to HTTP response format
 */
export class Response {
  /**
   * The response body content (stringified JSON)
   */
  private content: string;

  /**
   * HTTP status code (e.g., 200, 404, 500)
   */
  private statusCode: number;

  /**
   * HTTP response headers
   */
  private headers: Map<string, string>;

  /**
   * Create a new HTTP Response instance
   *
   * @param data - The response data (will be JSON stringified)
   * @param statusCode - HTTP status code (default: 200)
   * @param headers - Object containing response headers
   * @param json - Whether the data is already JSON string (default: false)
   *
   * @example
   * ```typescript
   * const response = new Response({ message: 'Hello' }, 200);
   * const response = new Response({ error: 'Not found' }, 404);
   * ```
   */
  constructor(
    data: unknown = null,
    statusCode: number = 200,
    headers: Record<string, string> = {},
    json: boolean = false
  ) {
    this.statusCode = statusCode;
    this.headers = new Map();

    // Initialize headers from the provided object
    Object.entries(headers).forEach(([key, value]) => {
      this.headers.set(key, value);
    });

    // Set default Content-Type header for JSON responses if not already set
    // Use case-insensitive check to avoid duplicate headers
    if (!this.hasHeaderCaseInsensitive('Content-Type')) {
      this.headers.set('Content-Type', 'application/json');
    }

    // Stringify the content
    if (json && typeof data === 'string') {
      this.content = data;
    } else {
      this.content = JSON.stringify(data);
    }

    // Automatically set Content-Length header
    this.setContentLength();
  }

  /**
   * Check if a header exists (case-insensitive)
   *
   * @param key - The header key to check (case-insensitive)
   * @returns true if the header exists, false otherwise
   *
   * @private
   */
  private hasHeaderCaseInsensitive(key: string): boolean {
    const lowerKey = key.toLowerCase();
    for (const headerKey of this.headers.keys()) {
      if (headerKey.toLowerCase() === lowerKey) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate and set the Content-Length header based on current content
   *
   * @private
   */
  private setContentLength(): void {
    // Content-Length should be the byte length of the UTF-8 encoded content
    const byteLength = Buffer.byteLength(this.content, 'utf8');
    this.headers.set('Content-Length', String(byteLength));
  }

  /**
   * Get the HTTP status code
   *
   * @returns The HTTP status code
   */
  getStatusCode(): number {
    return this.statusCode;
  }

  /**
   * Set the HTTP status code
   *
   * @param statusCode - The HTTP status code to set
   * @returns This Response instance for method chaining
   */
  setStatusCode(statusCode: number): this {
    this.statusCode = statusCode;
    return this;
  }

  /**
   * Get the response body content (JSON string)
   *
   * @returns The stringified JSON content
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Set the response body content
   *
   * Updates the content and automatically recalculates Content-Length header.
   *
   * @param content - The new content string
   * @returns This Response instance for method chaining
   */
  setContent(content: string): this {
    this.content = content;
    this.setContentLength();
    return this;
  }

  /**
   * Get a specific header value
   *
   * @param key - The header key (case-sensitive)
   * @returns The header value or undefined if not set
   */
  getHeader(key: string): string | undefined {
    return this.headers.get(key);
  }

  /**
   * Set a header
   *
   * @param key - The header key
   * @param value - The header value
   * @returns This Response instance for method chaining
   */
  setHeader(key: string, value: string): this {
    this.headers.set(key, value);
    return this;
  }

  /**
   * Get all headers
   *
   * @returns Object containing all headers
   */
  getHeaders(): Record<string, string> {
    const result: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Set multiple headers at once
   *
   * @param headers - Object containing headers to set
   * @returns This Response instance for method chaining
   */
  setHeaders(headers: Record<string, string>): this {
    Object.entries(headers).forEach(([key, value]) => {
      this.headers.set(key, value);
    });
    return this;
  }

  /**
   * Serialize the response to an HTTP response string
   *
   * Generates a complete HTTP response including status line, headers, and body.
   * This can be sent directly over a socket.
   *
   * @returns The HTTP response as a string
   *
   * @example
   * ```typescript
   * const response = new Response({ data: 'test' }, 200);
   * const httpString = response.toString();
   * // Output:
   * // HTTP/1.1 200 OK
   * // Content-Length: 17
   * // ...
   * //
   * // {"data":"test"}
   * ```
   */
  toString(): string {
    // Build HTTP status line
    const statusText = this.getStatusText();
    let httpResponse = `HTTP/1.1 ${this.statusCode} ${statusText}\r\n`;

    // Add headers
    this.headers.forEach((value, key) => {
      httpResponse += `${key}: ${value}\r\n`;
    });

    // Add blank line to separate headers from body
    httpResponse += '\r\n';

    // Add body
    httpResponse += this.content;

    return httpResponse;
  }

  /**
   * Get the HTTP status text for a given status code
   *
   * Returns common HTTP status reason phrases.
   * Falls back to generic "Unknown" for uncommon codes.
   *
   * @returns The HTTP status text
   *
   * @private
   */
  private getStatusText(): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return statusTexts[this.statusCode] ?? 'Unknown';
  }
}
