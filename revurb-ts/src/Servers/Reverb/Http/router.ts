import { createHash } from 'crypto';
import type { Connection } from '../../../connection';

/**
 * HTTP Router for request dispatch and WebSocket upgrade handling
 *
 * The Router class handles:
 * - Request routing and dispatch to controllers
 * - WebSocket upgrade detection and handshake (RFC 6455)
 * - Controller parameter resolution
 * - HTTP error handling (404, 405, 500)
 *
 * Key Features:
 * - dispatch() method matches request to route and calls controller
 * - WebSocket upgrade detection via "Upgrade: websocket" header
 * - RFC 6455 WebSocket handshake negotiation with proper key generation
 * - Controller parameter resolution from route and request context
 * - Graceful HTTP error responses (404, 405, 500)
 *
 * @example
 * ```typescript
 * const router = new Router(routeMatcher);
 * const result = await router.dispatch(request, connection);
 * ```
 */
export class Router {
  /**
   * WebSocket upgrade magic GUID as defined in RFC 6455
   * @see https://datatracker.ietf.org/doc/html/rfc6455#section-1.3
   */
  private static readonly WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

  /**
   * Create a new Router instance
   *
   * @param matcher - The route matcher instance (implements IRouteMatcher)
   */
  constructor(private matcher: IRouteMatcher) {}

  /**
   * Dispatch the HTTP request to the appropriate controller
   *
   * This method:
   * 1. Matches the request URI to a route
   * 2. Extracts the controller and route parameters
   * 3. Handles WebSocket upgrades if requested
   * 4. Resolves controller parameters from route and request context
   * 5. Calls the controller with appropriate arguments
   * 6. Handles HTTP errors (404, 405, 500)
   *
   * @param request - The HTTP request object
   * @param connection - The connection object
   * @returns The controller response (Promise, string, or any result)
   *
   * @throws Will close connection with appropriate HTTP error code if route matching fails
   */
  async dispatch(request: IHttpRequest, connection: Connection): Promise<any> {
    try {
      // Set up route matcher context
      this.matcher.setContext({
        method: request.getMethod(),
        host: request.getHost(),
      });

      // Attempt to match the route
      let route: Record<string, any>;
      try {
        route = this.matcher.match(request.getPath());
      } catch (error) {
        if (this.isMethodNotAllowedException(error)) {
          const allowedMethods = this.getAllowedMethods(error);
          this.close(connection, 405, 'Method not allowed.', { Allow: allowedMethods });
          return null;
        }

        if (this.isResourceNotFoundException(error)) {
          this.close(connection, 404, 'Not found.');
          return null;
        }

        throw error;
      }

      // Get the controller from the route
      const controller = this.controller(route);

      // Check if this is a WebSocket upgrade request
      if (this.isWebSocketRequest(request)) {
        const wsConnection = this.attemptUpgrade(request, connection);

        // Call the controller with websocket connection and route parameters
        const routeParams = this.extractRouteParams(route);
        return await controller(request, wsConnection, ...Object.values(routeParams));
      }

      // For HTTP requests, resolve parameters and call controller
      const routeParameters = {
        ...this.extractRouteParams(route),
        request,
        connection,
      };

      const args = this.arguments(controller, routeParameters);
      const response = await controller(...args);

      // Send response and close connection
      return this.sendResponse(connection, response);
    } catch (error) {
      // Handle unexpected errors
      this.close(connection, 500, 'Internal server error.');
      throw error;
    }
  }

  /**
   * Get the controller callable for the given route
   *
   * @param route - The matched route object
   * @returns The controller function/callback
   *
   * @private
   */
  private controller(route: Record<string, any>): ControllerCallback {
    return route['_controller'];
  }

  /**
   * Determine whether the request is for a WebSocket connection
   *
   * Checks for the "Upgrade: websocket" header as defined in RFC 6455
   *
   * @param request - The HTTP request object
   * @returns true if the request is a WebSocket upgrade request
   *
   * @private
   */
  private isWebSocketRequest(request: IHttpRequest): boolean {
    const upgradeHeader = request.getHeader('upgrade')?.toLowerCase();
    return upgradeHeader === 'websocket';
  }

  /**
   * Negotiate the WebSocket connection upgrade (RFC 6455 Handshake)
   *
   * This method implements the WebSocket opening handshake as defined in RFC 6455:
   * 1. Generates the Sec-WebSocket-Accept header using SHA-1 hash
   * 2. Creates the upgrade response with required headers
   * 3. Sends the response to the client
   * 4. Wraps the raw connection in a ReverbConnection
   *
   * @see https://datatracker.ietf.org/doc/html/rfc6455#section-4
   *
   * @param request - The HTTP request object
   * @param connection - The raw socket connection
   * @returns A new ReverbConnection instance for WebSocket communication
   *
   * @private
   */
  private attemptUpgrade(request: IHttpRequest, connection: Connection): any {
    // Get the Sec-WebSocket-Key from the request
    const secWebSocketKey = request.getHeader('sec-websocket-key');

    if (!secWebSocketKey) {
      this.close(connection, 400, 'Missing Sec-WebSocket-Key header.');
      throw new Error('WebSocket upgrade failed: missing Sec-WebSocket-Key');
    }

    // Generate the accept key using RFC 6455 algorithm
    const acceptKey = this.generateAcceptKey(secWebSocketKey);

    // Build the upgrade response
    const statusLine = 'HTTP/1.1 101 Switching Protocols\r\n';
    const headers = [
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      'X-Powered-By: Reverb',
    ];

    const responseHeaders = headers.join('\r\n') + '\r\n\r\n';
    const upgradeResponse = statusLine + responseHeaders;

    // Send the upgrade response
    connection.send(upgradeResponse);

    // Return the connection wrapped as a WebSocket connection
    // In a real implementation, this would wrap the raw connection
    // For now, return the connection as-is (the actual WebSocket upgrade
    // would be handled by the underlying socket layer)
    return connection;
  }

  /**
   * Generate the Sec-WebSocket-Accept header value (RFC 6455)
   *
   * The accept key is generated by:
   * 1. Concatenating the client's Sec-WebSocket-Key with the magic GUID
   * 2. Generating a SHA-1 hash of the concatenated string
   * 3. Base64 encoding the hash
   *
   * @see https://datatracker.ietf.org/doc/html/rfc6455#section-4.2.2
   *
   * @param secWebSocketKey - The client's Sec-WebSocket-Key header value
   * @returns The Sec-WebSocket-Accept header value
   *
   * @private
   */
  private generateAcceptKey(secWebSocketKey: string): string {
    const concatenated = secWebSocketKey + Router.WS_GUID;
    const hash = createHash('sha1').update(concatenated).digest();
    return hash.toString('base64');
  }

  /**
   * Get the arguments for the controller
   *
   * Resolves controller parameters from the available route parameters.
   * Uses reflection to determine parameter names and matches them to
   * values from the route parameters object.
   *
   * @param controller - The controller function/callback
   * @param routeParameters - Object containing all available parameters
   * @returns Array of arguments in the correct order for the controller
   *
   * @private
   */
  private arguments(controller: ControllerCallback, routeParameters: Record<string, any>): any[] {
    const params = this.parameters(controller);

    return params.map((param) => {
      return routeParameters[param.name] ?? null;
    });
  }

  /**
   * Get the parameters for the controller function
   *
   * Uses JavaScript introspection to extract parameter names from the function.
   * Returns an array of parameter metadata.
   *
   * @param controller - The controller function/callback
   * @returns Array of parameter metadata objects with name, type, and position
   *
   * @private
   */
  private parameters(controller: ControllerCallback): Array<{ name: string; position: number }> {
    if (typeof controller !== 'function') {
      return [];
    }

    // Extract parameter names from function signature
    const functionStr = controller.toString();

    // Match function parameters using regex
    const match = functionStr.match(/\(([^)]*)\)/);
    if (!match || !match[1]) {
      return [];
    }

    const paramStr = match[1];
    if (!paramStr) {
      return [];
    }

    const paramNames = paramStr
      .split(',')
      .map((param) => param.trim().split('=')[0]?.split(':')[0]?.trim() || '')
      .filter((name) => name.length > 0);

    return paramNames.map((name, index) => ({
      name,
      position: index,
    }));
  }

  /**
   * Extract route parameters (excluding internal keys like _controller and _route)
   *
   * @param route - The matched route object
   * @returns Object containing only the route parameters
   *
   * @private
   */
  private extractRouteParams(route: Record<string, any>): Record<string, any> {
    const params: Record<string, any> = {};

    Object.entries(route).forEach(([key, value]) => {
      if (!key.startsWith('_')) {
        params[key] = value;
      }
    });

    return params;
  }

  /**
   * Check if an error is a method not allowed exception
   *
   * @param error - The error to check
   * @returns true if the error is a method not allowed exception
   *
   * @private
   */
  private isMethodNotAllowedException(error: any): boolean {
    return error?.name === 'MethodNotAllowedException' || error?.code === 405;
  }

  /**
   * Check if an error is a resource not found exception
   *
   * @param error - The error to check
   * @returns true if the error is a resource not found exception
   *
   * @private
   */
  private isResourceNotFoundException(error: any): boolean {
    return error?.name === 'ResourceNotFoundException' || error?.code === 404;
  }

  /**
   * Get allowed methods from a method not allowed exception
   *
   * @param error - The method not allowed exception
   * @returns Comma-separated string of allowed methods
   *
   * @private
   */
  private getAllowedMethods(error: any): string {
    if (Array.isArray(error?.allowedMethods)) {
      return error.allowedMethods.join(', ');
    }
    if (typeof error?.allowedMethods === 'string') {
      return error.allowedMethods;
    }
    return 'OPTIONS, GET, POST, PUT, DELETE, PATCH';
  }

  /**
   * Send an HTTP response to the connection
   *
   * @param connection - The connection to send the response to
   * @param response - The response data
   * @returns The connection for chaining
   *
   * @private
   */
  private sendResponse(connection: any, response: any): any {
    if (response) {
      connection.send(response);
    }
    connection.close();
    return connection;
  }

  /**
   * Close a connection with an HTTP error response
   *
   * Sends a properly formatted HTTP error response and closes the connection.
   *
   * @param connection - The connection to close
   * @param statusCode - The HTTP status code
   * @param message - The error message
   * @param additionalHeaders - Optional additional headers to include
   *
   * @private
   */
  private close(
    connection: any,
    statusCode: number,
    message: string,
    additionalHeaders: Record<string, string> = {}
  ): void {
    const statusText = this.getStatusText(statusCode);
    const body = JSON.stringify({ error: message });
    const bodyLength = Buffer.byteLength(body, 'utf8');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(bodyLength),
      ...additionalHeaders,
    };

    const headerLines = Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');

    const response = `HTTP/1.1 ${statusCode} ${statusText}\r\n${headerLines}\r\n\r\n${body}`;

    try {
      connection.send(response);
    } catch (error) {
      // Connection may already be closed
    }

    try {
      connection.close();
    } catch (error) {
      // Connection may already be closed
    }
  }

  /**
   * Get the HTTP status text for a given status code
   *
   * @param statusCode - The HTTP status code
   * @returns The HTTP status reason phrase
   *
   * @private
   */
  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      400: 'Bad Request',
      404: 'Not Found',
      405: 'Method Not Allowed',
      500: 'Internal Server Error',
    };

    return statusTexts[statusCode] ?? 'Unknown';
  }
}

/**
 * HTTP Request interface
 *
 * Represents an HTTP request object with methods to access headers, method, path, etc.
 */
export interface IHttpRequest {
  /**
   * HTTP method (GET, POST, PUT, DELETE, etc.) - property for direct access
   */
  method: string;

  /**
   * Request path with query string - property for direct access
   */
  path: string;

  /**
   * Request body content - property for direct access
   */
  body: string;

  /**
   * Get the HTTP method (GET, POST, PUT, DELETE, etc.)
   */
  getMethod(): string;

  /**
   * Get the request path
   */
  getPath(): string;

  /**
   * Get the request host
   */
  getHost(): string;

  /**
   * Get a specific header value
   */
  getHeader(name: string): string | undefined;

  /**
   * Get all headers
   */
  getHeaders(): Record<string, string>;

  /**
   * Get the request URI
   */
  getUri(): {
    path: string;
    host: string;
  };
}

/**
 * Route matcher interface
 *
 * Handles route matching and context management
 */
export interface IRouteMatcher {
  /**
   * Set the matcher context (method, host, etc.)
   */
  setContext(context: MatcherContext): void;

  /**
   * Match a path to a route
   */
  match(path: string): Record<string, any>;

  /**
   * Get the current context
   */
  getContext(): MatcherContext;
}

/**
 * Route matcher context
 */
export interface MatcherContext {
  method: string;
  host: string;
}

/**
 * Controller callback type
 *
 * Represents a controller function that can be called with request and route parameters
 */
export type ControllerCallback = (
  ...args: any[]
) => any | Promise<any>;
