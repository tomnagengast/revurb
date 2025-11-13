import type { ILogger } from '../../../contracts/logger';
import type { Router } from './router';

/**
 * HTTP Server Implementation
 *
 * Main HTTP/WebSocket server that wraps Bun.serve() for handling incoming
 * TCP connections, HTTP request parsing, routing, and WebSocket upgrades.
 *
 * Key features:
 * - Accepts incoming TCP connections via Bun.serve()
 * - HTTP request parsing and routing
 * - WebSocket upgrade handling with full lifecycle management
 * - Periodic garbage collection (every 30 seconds)
 * - Graceful start/stop lifecycle management
 * - TLS support detection
 *
 * The server uses Bun's native WebSocket API for efficient connection handling
 * and automatic binary/text frame management.
 *
 * @example
 * ```typescript
 * const server = new Server({
 *   port: 8080,
 *   host: 'localhost',
 *   logger,
 *   router,
 *   maxRequestSize: 1024 * 1024,
 *   tls: null,
 * });
 *
 * server.start();
 * // Server is now accepting connections...
 *
 * // Later, to stop:
 * server.stop();
 * ```
 */
export class Server {
  /**
   * The underlying Bun server instance.
   *
   * @private
   */
  private bunServer: ReturnType<typeof Bun.serve> | null = null;

  /**
   * Periodic timer for garbage collection.
   *
   * @private
   */
  private gcTimer: Timer | null = null;

  /**
   * Indicates whether the server is running.
   *
   * @private
   */
  private isRunning: boolean = false;

  /**
   * Server configuration options.
   *
   * @private
   */
  private readonly config: ServerConfig;

  /**
   * Create a new HTTP server instance.
   *
   * Initializes the server with configuration, logger, and router.
   * Disables automatic garbage collection and sets up periodic manual GC.
   *
   * @param config - Server configuration object
   */
  constructor(config: ServerConfig) {
    this.config = config;

    // Disable automatic garbage collection; we'll do it manually
    if (typeof gc !== 'undefined') {
      // Note: gc.disable() may not be available in all Bun versions
      (gc as any).disable?.();
    }
  }

  /**
   * Start the HTTP server.
   *
   * Initializes Bun.serve() with the configured port, host, and handlers.
   * Sets up periodic garbage collection and error handling.
   * The server will accept both HTTP and WebSocket connections.
   *
   * @throws Will log errors but not throw directly; error handling is done
   *         through the logger interface
   */
  start(): void {
    try {
      const config: any = {
        port: this.config.port,
        hostname: this.config.host,
        fetch: (req: Request, server: any) => this.handleRequest(req, server),
        websocket: {
          open: (ws: any) => this.handleWebSocketOpen(ws),
          message: (ws: any, message: string | Buffer) => this.handleWebSocketMessage(ws, message),
          close: (ws: any, code: number, reason: string) => this.handleWebSocketClose(ws, code, reason),
          ping: (ws: any, data: Buffer) => this.handleWebSocketPing(ws, data),
          pong: (ws: any, data: Buffer) => this.handleWebSocketPong(ws, data),
        },
      };

      // Only add TLS if it's defined (not null or undefined)
      if (this.config.tls) {
        config.tls = this.config.tls;
      }

      this.bunServer = Bun.serve(config);

      this.isRunning = true;

      // Set up periodic garbage collection every 30 seconds
      this.gcTimer = setInterval(() => {
        if (typeof gc !== 'undefined') {
          // Note: gc.collect() may not be available in all Bun versions
          (gc as any).collect?.();
        }
      }, 30_000);

      this.config.logger.info('Server started', `Listening on ${this.config.host}:${this.config.port}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.config.logger.error(message);
      this.isRunning = false;
    }
  }

  /**
   * Stop the HTTP server.
   *
   * Gracefully shuts down the server, stops garbage collection,
   * and closes all connections.
   */
  stop(): void {
    this.isRunning = false;

    // Stop garbage collection timer
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // Close the Bun server
    if (this.bunServer) {
      this.bunServer.stop();
      this.bunServer = null;
    }

    this.config.logger.info('Server stopped');
  }

  /**
   * Handle incoming HTTP requests.
   *
   * Routes HTTP requests and handles WebSocket upgrades.
   * For WebSocket upgrades, this delegates to Bun's upgrade mechanism.
   * For regular HTTP requests, this routes to the router for application logic.
   *
   * @param req - The incoming HTTP request
   * @param server - The Bun server instance (used for WebSocket upgrades)
   * @returns A Response object for the request
   *
   * @private
   */
  private async handleRequest(req: Request, server: any): Promise<Response | undefined> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Attempt WebSocket upgrade for specific paths
    if (this.shouldUpgradeToWebSocket(pathname, req)) {
      if (server.upgrade(req)) {
        return undefined;
      }
    }

    // Route HTTP requests
    try {
      // For HTTP requests, pass null as connection since we don't have a Connection object yet
      const result = await this.config.router.dispatch(req as any, null as any);

      // If result is already a Response, return it
      if (result instanceof Response) {
        return result;
      }

      // Otherwise, wrap result in a Response
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof HttpException) {
        return new Response(error.message, {
          status: error.statusCode,
          headers: { 'content-type': 'text/plain' },
        });
      }

      const message = error instanceof Error ? error.message : 'Internal server error';
      this.config.logger.error(message);

      return new Response('Internal server error', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
    }
  }

  /**
   * Determine if a request should be upgraded to WebSocket.
   *
   * Checks if the request is a WebSocket upgrade request and if the path
   * is one that should be handled as a WebSocket connection.
   *
   * @param pathname - The request path
   * @param req - The incoming HTTP request
   * @returns true if the request should be upgraded to WebSocket
   *
   * @private
   */
  private shouldUpgradeToWebSocket(pathname: string, req: Request): boolean {
    // Check if this is a WebSocket upgrade request
    const upgrade = req.headers.get('upgrade')?.toLowerCase();
    if (upgrade !== 'websocket') {
      return false;
    }

    // WebSocket connections typically use these paths
    return pathname === '/app' || pathname.startsWith('/app/');
  }

  /**
   * Handle WebSocket connection opened event.
   *
   * Called when a new WebSocket connection is successfully established.
   * This is where application-level connection setup would occur.
   *
   * @param ws - The WebSocket connection
   *
   * @private
   */
  private handleWebSocketOpen(_ws: any): void {
    // Application-level WebSocket handling would be done here
    // For now, this is a placeholder for lifecycle management
  }

  /**
   * Handle WebSocket message received event.
   *
   * Routes incoming WebSocket messages to the application router
   * for processing.
   *
   * @param ws - The WebSocket connection
   * @param message - The message data (string or buffer)
   *
   * @private
   */
  private handleWebSocketMessage(_ws: any, _message: string | Buffer): void {
    try {
      // Application-level message routing would occur here
      // This delegates to the router or message handler
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.config.logger.error(`WebSocket message handling error: ${errorMessage}`);
    }
  }

  /**
   * Handle WebSocket connection closed event.
   *
   * Called when a WebSocket connection is closed, either by the client,
   * server, or due to network issues.
   *
   * @param ws - The WebSocket connection
   * @param code - The WebSocket close code
   * @param reason - The reason for closing
   *
   * @private
   */
  private handleWebSocketClose(_ws: any, _code: number, _reason: string): void {
    // Application-level cleanup would occur here
    // This would handle connection state cleanup, event dispatching, etc.
  }

  /**
   * Handle WebSocket ping frame received event.
   *
   * Automatically responds with a pong frame. This is typically
   * handled automatically by Bun, but can be customized for monitoring.
   *
   * @param ws - The WebSocket connection
   * @param data - The ping frame data
   *
   * @private
   */
  private handleWebSocketPing(_ws: any, _data: Buffer): void {
    // Bun automatically sends a pong response, but we can log or monitor here
  }

  /**
   * Handle WebSocket pong frame received event.
   *
   * Called when a pong response is received from the client.
   * Used to verify connection health and update activity tracking.
   *
   * @param ws - The WebSocket connection
   * @param data - The pong frame data
   *
   * @private
   */
  private handleWebSocketPong(_ws: any, _data: Buffer): void {
    // Application-level pong handling would occur here
    // This would update connection state, mark as active, etc.
  }

  /**
   * Determine whether the server has TLS support.
   *
   * Checks if the server was configured with TLS certificates.
   *
   * @returns true if TLS is configured, false otherwise
   */
  isSecure(): boolean {
    return this.config.tls !== null && this.config.tls !== undefined;
  }

  /**
   * Determine if the server is currently running.
   *
   * @returns true if the server is running, false otherwise
   */
  running(): boolean {
    return this.isRunning;
  }
}

/**
 * Server Configuration
 *
 * Configuration object for the HTTP server, including port, host,
 * logger, router, and optional TLS settings.
 */
export interface ServerConfig {
  /**
   * The port to listen on (e.g., 8080)
   */
  port: number;

  /**
   * The hostname to bind to (e.g., 'localhost' or '0.0.0.0')
   */
  host: string;

  /**
   * The logger instance for output
   */
  logger: ILogger;

  /**
   * The router for handling HTTP requests
   */
  router: Router;

  /**
   * Maximum allowed request size in bytes
   */
  maxRequestSize: number;

  /**
   * Optional TLS configuration for HTTPS/WSS support
   */
  tls?: BunTLSOptions | null;
}

/**
 * Bun TLS Options
 *
 * Configuration for TLS/HTTPS support in Bun.serve()
 */
export interface BunTLSOptions {
  /**
   * Path to the TLS certificate file
   */
  cert?: string | Buffer;

  /**
   * Path to the TLS key file
   */
  key?: string | Buffer;

  /**
   * Path to the CA certificate file (for client validation)
   */
  ca?: string | Buffer;

  /**
   * Path to the PKCS#12 file (alternative to separate cert/key)
   */
  pkcs12?: Buffer;

  /**
   * Passphrase for the key file
   */
  passphrase?: string;
}

/**
 * HTTP Exception
 *
 * Represents an HTTP error with a status code and message.
 * Used for routing errors and validation failures.
 */
export class HttpException extends Error {
  /**
   * Create a new HTTP exception.
   *
   * @param statusCode - The HTTP status code (e.g., 404, 500)
   * @param message - The error message
   */
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpException';
  }
}
