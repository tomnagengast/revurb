/**
 * Factory for creating Reverb WebSocket servers
 *
 * Creates and configures HTTP servers with WebSocket support for the Pusher protocol.
 * Handles routing, TLS/SSL configuration, and protocol selection.
 *
 * @module Servers/Reverb/Factory
 */

import type { ServeOptions } from "bun";
import type { Application } from "../../application";
import { ApplicationManager } from "../../application-manager";
import { Certificate } from "../../certificate";
import type { ReverbConfig } from "../../config/types";
import { Connection as ReverbConnection } from "../../connection";
import type { IApplicationProvider } from "../../contracts/application-provider";
import { ServerProvider } from "../../contracts/server-provider";
import { CliLogger } from "../../loggers/cli-logger";
import { Log } from "../../loggers/log";
import type { NullLogger } from "../../loggers/null-logger";
import { ClientEvent } from "../../protocols/pusher/client-event";
import { EventHandler } from "../../protocols/pusher/event-handler";
import { ChannelController } from "../../protocols/pusher/http/controllers/channel-controller";
import { channelUsersController } from "../../protocols/pusher/http/controllers/channel-users-controller";
import { ChannelsController } from "../../protocols/pusher/http/controllers/channels-controller";
import { connectionsController } from "../../protocols/pusher/http/controllers/connections-controller";
import { EventsBatchController } from "../../protocols/pusher/http/controllers/events-batch-controller";
import { EventsController } from "../../protocols/pusher/http/controllers/events-controller";
import { UsersTerminateController } from "../../protocols/pusher/http/controllers/users-terminate-controller";
import { ArrayChannelConnectionManager } from "../../protocols/pusher/managers/array-channel-connection-manager";
import { ArrayChannelManager } from "../../protocols/pusher/managers/array-channel-manager";
import { MetricsHandler } from "../../protocols/pusher/metrics-handler";
import { Server as PusherServer } from "../../protocols/pusher/server";
import { Connection as WebSocketConnection } from "./connection";
import { Response as HttpResponse } from "./http/response";

/**
 * WebSocket connection data stored in Bun's ws.data
 */
interface WebSocketData {
  app?: Application;
  origin?: string | null;
  connection?: ReverbConnection;
  onMessage?: (message: string | Buffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onPing?: () => void;
  onPong?: () => void;
}

/**
 * Route definition for HTTP handlers
 */
interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: (
    req: Request,
    params: Record<string, string>,
    server?: any,
  ) => Response | Promise<Response> | undefined;
}

/**
 * Router for handling HTTP requests with pattern matching
 */
class Router {
  private routes: RouteDefinition[] = [];

  /**
   * Add a GET route
   */
  public get(path: string, handler: RouteDefinition["handler"]): this {
    this.routes.push({ method: "GET", path, handler });
    return this;
  }

  /**
   * Add a POST route
   */
  public post(path: string, handler: RouteDefinition["handler"]): this {
    this.routes.push({ method: "POST", path, handler });
    return this;
  }

  /**
   * Add a route
   */
  public add(
    method: "GET" | "POST",
    path: string,
    handler: RouteDefinition["handler"],
  ): this {
    this.routes.push({ method, path, handler });
    return this;
  }

  /**
   * Match a request to a route and extract parameters
   */
  public match(
    method: string,
    pathname: string,
  ): {
    handler: RouteDefinition["handler"];
    params: Record<string, string>;
  } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = this.matchPath(route.path, pathname);
      if (params !== null) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  /**
   * Match a path pattern to a URL pathname
   * Converts /apps/{appId}/events to regex and extracts parameters
   */
  private matchPath(
    pattern: string,
    pathname: string,
  ): Record<string, string> | null {
    // Convert pattern to regex: /apps/{appId}/events => /apps\/([^/]+)\/events/
    const regexPattern = pattern
      .replace(/\//g, "\\/")
      .replace(/\{([^}]+)\}/g, "([^/]+)");

    const regex = new RegExp(`^${regexPattern}$`);
    const match = pathname.match(regex);

    if (!match) return null;

    // Extract parameter names from pattern
    const paramNames: string[] = [];
    let match_params;
    const paramRegex = /\{([^}]+)\}/g;
    while ((match_params = paramRegex.exec(pattern)) !== null) {
      if (match_params[1]) {
        paramNames.push(match_params[1]);
      }
    }

    // Build params object from matched groups
    const params: Record<string, string> = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1] || "";
    });

    return params;
  }
}

/**
 * TLS/SSL configuration context
 */
interface TlsContext {
  local_cert?: string;
  local_pk?: string;
  verify_peer?: boolean;
  [key: string]: unknown;
}

/**
 * HTTP Server options for Bun
 */
interface HttpServerOptions {
  tls?: TlsContext;
  [key: string]: unknown;
}

/**
 * Factory for creating Reverb WebSocket servers with Pusher protocol support
 *
 * @class Factory
 * @example
 * ```typescript
 * const server = Factory.make('0.0.0.0', '8080', '', 'localhost');
 * ```
 */
export class Factory {
  /**
   * Application manager for app lookup and validation
   */
  private static appManager: ApplicationManager | null = null;

  /**
   * Channel manager for managing Pusher channels
   */
  private static channelManager: ArrayChannelManager | null = null;

  /**
   * Pusher protocol server instance
   */
  private static pusherServer: PusherServer | null = null;

  /**
   * Logger instance
   */
  private static logger: CliLogger | NullLogger | null = null;

  /**
   * Metrics handler instance
   */
  private static metricsHandler: MetricsHandler | null = null;

  /**
   * Controller instances
   */
  private static eventsController: EventsController | null = null;
  private static eventsBatchController: EventsBatchController | null = null;
  private static channelsController: ChannelsController | null = null;
  private static channelController: ChannelController | null = null;
  private static usersTerminateController: UsersTerminateController | null =
    null;

  /**
   * Application provider instance (used by controllers)
   */
  private static applicationProvider: IApplicationProvider | null = null;

  /**
   * Server provider instance (used by controllers)
   */
  private static serverProvider: any = null;

  /**
   * Initialize the factory with configuration
   *
   * @param config - The Reverb configuration
   */
  public static initialize(config: ReverbConfig): void {
    Factory.logger = new CliLogger();
    // Set the logger in the Log facade so it's available globally
    Log.setLogger(Factory.logger);
    Factory.appManager = new ApplicationManager(config);

    // Create application provider and channel connection manager
    Factory.applicationProvider = Factory.appManager.driver();
    const channelConnectionManager = new ArrayChannelConnectionManager();

    Factory.channelManager = new ArrayChannelManager(
      Factory.applicationProvider,
      channelConnectionManager,
      Factory.logger,
    );

    const eventHandler = new EventHandler(Factory.channelManager);
    const clientEvent = new ClientEvent(Factory.channelManager);

    Factory.pusherServer = new PusherServer(
      Factory.channelManager,
      eventHandler,
      clientEvent,
      Factory.logger,
    );

    // Create a minimal server provider
    // By default, server does not subscribe to events (standalone mode)
    Factory.serverProvider = new (class extends ServerProvider {
      override subscribesToEvents(): boolean {
        return false;
      }
    })();

    // Initialize metrics handler with all required dependencies
    Factory.metricsHandler = new MetricsHandler(
      Factory.serverProvider as any,
      Factory.channelManager as any,
      null as any,
    );

    // Initialize class-based controllers with proper dependencies
    Factory.eventsController = new EventsController(
      Factory.channelManager,
      Factory.metricsHandler,
    );
    Factory.eventsBatchController = new EventsBatchController(
      Factory.metricsHandler,
    );
    Factory.channelsController = new ChannelsController(
      Factory.metricsHandler,
      Factory.applicationProvider,
      Factory.channelManager,
    );
    Factory.channelController = new ChannelController(
      Factory.applicationProvider,
      Factory.channelManager,
      Factory.metricsHandler,
    );
    Factory.usersTerminateController = new UsersTerminateController(
      Factory.applicationProvider,
      Factory.channelManager,
      Factory.serverProvider,
      undefined,
    );
  }

  /**
   * Get the channel manager instance
   *
   * @returns The channel manager instance
   * @throws {Error} If factory has not been initialized
   */
  public static getChannelManager(): ArrayChannelManager {
    if (!Factory.channelManager) {
      throw new Error(
        "Factory not initialized. Call Factory.initialize() first.",
      );
    }
    return Factory.channelManager;
  }

  /**
   * Get the application provider instance
   *
   * @returns The application provider instance
   * @throws {Error} If factory has not been initialized
   */
  public static getApplicationProvider(): IApplicationProvider {
    if (!Factory.applicationProvider) {
      throw new Error(
        "Factory not initialized. Call Factory.initialize() first.",
      );
    }
    return Factory.applicationProvider;
  }

  /**
   * Get the logger instance
   *
   * @returns The logger instance
   * @throws {Error} If factory has not been initialized
   */
  public static getLogger(): CliLogger | NullLogger {
    if (!Factory.logger) {
      throw new Error(
        "Factory not initialized. Call Factory.initialize() first.",
      );
    }
    return Factory.logger;
  }

  /**
   * Get the metrics handler instance
   *
   * @returns The metrics handler instance
   * @throws {Error} If factory has not been initialized
   */
  public static getMetricsHandler(): MetricsHandler {
    if (!Factory.metricsHandler) {
      throw new Error(
        "Factory not initialized. Call Factory.initialize() first.",
      );
    }
    return Factory.metricsHandler;
  }

  /**
   * Create a new WebSocket server instance
   *
   * Creates and configures an HTTP server with WebSocket support using Bun.
   * Handles TLS/SSL configuration and protocol routing.
   *
   * @param host - Server host address (default: '0.0.0.0')
   * @param port - Server port (default: '8080')
   * @param path - URL path prefix for all routes (default: '')
   * @param hostname - Hostname for TLS certificate resolution (optional)
   * @param maxRequestSize - Maximum request size in bytes (default: 10000)
   * @param options - Additional server options (default: {})
   * @param protocol - Protocol to use ('pusher' only for now) (default: 'pusher')
   * @param environment - The environment name (default: NODE_ENV or 'development')
   *                      Used to determine TLS peer verification settings
   * @returns The configured Bun server instance
   *
   * @throws {Error} If protocol is unsupported
   *
   * @example
   * ```typescript
   * const server = Factory.make('127.0.0.1', '8080', '', 'myapp.test', 10000, {}, 'pusher', 'production');
   * console.log('Server running on port 8080');
   * ```
   */
  public static make(
    host = "0.0.0.0",
    port = "8080",
    path = "",
    hostname?: string,
    maxRequestSize = 10000,
    options: HttpServerOptions = {},
    protocol = "pusher",
    environment: string = process.env.NODE_ENV || "development",
  ) {
    if (protocol !== "pusher") {
      throw new Error(`Unsupported protocol [${protocol}].`);
    }

    const router = Factory.makePusherRouter(path);
    const tlsContext = Factory.configureTls(
      options.tls ?? {},
      hostname,
      environment,
    );
    const portNum = Number.parseInt(port, 10);

    // Build Bun server options
    const serveOptions: ServeOptions & { maxRequestBodySize?: number } = {
      hostname: host,
      port: portNum,
      maxRequestBodySize: maxRequestSize,
      fetch: async (req: Request, server: any) =>
        Factory.handleRequest(req, router, server),
      websocket: {
        open: (ws: any) => {
          // WebSocket open handler - create connection and notify Pusher server
          const data = ws.data as WebSocketData | undefined;
          if (!data || !data.app) {
            console.error("WebSocket opened without app data");
            ws.close();
            return;
          }

          try {
            // Create WebSocket connection wrapper
            const wsConnection = new WebSocketConnection(ws);

            // Create Reverb connection with app and origin
            const connection = new ReverbConnection(
              wsConnection,
              data.app,
              data.origin || null,
            );

            // Store connection in ws.data for later use
            data.connection = connection;

            // Notify Pusher server of new connection
            if (Factory.pusherServer) {
              Factory.pusherServer.open(connection);
            }
          } catch (error) {
            console.error("Error opening WebSocket connection:", error);
            ws.close();
          }
        },
        message: (ws: any, message: string | Buffer) => {
          // WebSocket message handler
          const data = ws.data as WebSocketData | undefined;
          if (!data?.connection) {
            console.error("WebSocket message received without connection");
            return;
          }

          try {
            const messageStr =
              typeof message === "string" ? message : message.toString("utf-8");

            // Pass message to Pusher server
            if (Factory.pusherServer) {
              Factory.pusherServer.message(data.connection, messageStr);
            }
          } catch (error) {
            console.error("Error handling WebSocket message:", error);
          }
        },
        close: (ws: any) => {
          // WebSocket close handler
          const data = ws.data as WebSocketData | undefined;
          if (!data?.connection) {
            return;
          }

          try {
            // Notify Pusher server of connection close
            if (Factory.pusherServer) {
              Factory.pusherServer.close(data.connection);
            }
          } catch (error) {
            console.error("Error closing WebSocket connection:", error);
          }
        },
        ping: (ws: any) => {
          // Ping handler
          const data = ws.data as WebSocketData | undefined;
          if (!data?.connection) {
            return;
          }

          try {
            // Create PING frame and pass to Pusher server
            if (Factory.pusherServer) {
              Factory.pusherServer.control(data.connection, {
                opcode: 0x9 as any,
                payload: "",
                getContents: () => "",
              });
            }
          } catch (error) {
            console.error("Error handling ping:", error);
          }
        },
        pong: (ws: any) => {
          // Pong handler
          const data = ws.data as WebSocketData | undefined;
          if (!data?.connection) {
            return;
          }

          try {
            // Create PONG frame and pass to Pusher server
            if (Factory.pusherServer) {
              Factory.pusherServer.control(data.connection, {
                opcode: 0xa as any,
                payload: "",
                getContents: () => "",
              });
            }
          } catch (error) {
            console.error("Error handling pong:", error);
          }
        },
      },
    };

    // Add TLS configuration if present
    if (
      Factory.usesTls(tlsContext) &&
      tlsContext.local_cert &&
      tlsContext.local_pk
    ) {
      serveOptions.tls = {
        cert: Bun.file(tlsContext.local_cert),
        key: Bun.file(tlsContext.local_pk),
      };
    }

    return Bun.serve(serveOptions);
  }

  /**
   * Handle incoming HTTP requests and route them appropriately
   *
   * @param req - The incoming request
   * @param router - The router instance
   * @param server - The Bun server instance for WebSocket upgrades
   * @returns Response to send back to client
   *
   * @private
   */
  private static async handleRequest(
    req: Request,
    router: Router,
    server: any,
  ): Promise<Response | undefined> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    const match = router.match(method, pathname);
    if (!match) {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      // Pass server to handler for WebSocket upgrade support
      return await Promise.resolve(match.handler(req, match.params, server));
    } catch (error) {
      console.error("Route handler error:", error);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * Create a new router for the Pusher protocol
   *
   * Sets up all routes required for Pusher protocol support.
   * This includes WebSocket connections and HTTP API endpoints.
   *
   * @param path - URL path prefix for all routes
   * @returns Router - Configured router instance
   *
   * @private
   */
  private static makePusherRouter(path: string): Router {
    const router = new Router();

    // Set up Pusher routes with optional path prefix
    const routes = Factory.pusherRoutes(path);

    for (const route of routes) {
      if (route.method === "GET") {
        router.get(route.path, route.handler);
      } else if (route.method === "POST") {
        router.post(route.path, route.handler);
      }
    }

    return router;
  }

  /**
   * Generate the routes required to handle Pusher protocol requests
   *
   * Defines all HTTP API endpoints for:
   * - WebSocket connections
   * - Event triggering
   * - Connection management
   * - Channel information
   * - Health checks
   *
   * @param path - URL path prefix for all routes
   * @returns Array of route definitions
   *
   * @private
   */
  private static pusherRoutes(path: string): RouteDefinition[] {
    const basePath = path || "";
    const prefix = (route: string) => `${basePath}${route}`;

    return [
      {
        method: "GET",
        path: prefix("/app/{appKey}"),
        handler: Factory.handleWebSocketConnection.bind(Factory),
      },
      {
        method: "POST",
        path: prefix("/apps/{appId}/events"),
        handler: Factory.handleEvents.bind(Factory),
      },
      {
        method: "POST",
        path: prefix("/apps/{appId}/batch_events"),
        handler: Factory.handleBatchEvents.bind(Factory),
      },
      {
        method: "GET",
        path: prefix("/apps/{appId}/connections"),
        handler: Factory.handleConnections.bind(Factory),
      },
      {
        method: "GET",
        path: prefix("/apps/{appId}/channels"),
        handler: Factory.handleChannels.bind(Factory),
      },
      {
        method: "GET",
        path: prefix("/apps/{appId}/channels/{channel}"),
        handler: Factory.handleChannelInfo.bind(Factory),
      },
      {
        method: "GET",
        path: prefix("/apps/{appId}/channels/{channel}/users"),
        handler: Factory.handleChannelUsers.bind(Factory),
      },
      {
        method: "POST",
        path: prefix("/apps/{appId}/users/{userId}/terminate_connections"),
        handler: Factory.handleTerminateConnections.bind(Factory),
      },
      {
        method: "GET",
        path: prefix("/up"),
        handler: Factory.handleHealthCheck.bind(Factory),
      },
    ];
  }

  /**
   * Handle WebSocket connection requests
   *
   * @param req - The incoming request
   * @param params - Route parameters including appKey
   * @param server - The Bun server instance for WebSocket upgrades
   * @returns Response with WebSocket upgrade or error, or undefined for successful upgrade
   *
   * @private
   */
  private static handleWebSocketConnection(
    req: Request,
    params: Record<string, string>,
    server?: any,
  ): Response | undefined {
    // Check if this is a WebSocket upgrade request
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
    }

    if (!server) {
      return new Response("Server instance not available", { status: 500 });
    }

    if (!Factory.appManager || !Factory.pusherServer) {
      return new Response(
        "Server not initialized. Call Factory.initialize() first.",
        { status: 500 },
      );
    }

    const appKey = params.appKey;
    if (!appKey) {
      return new Response("Missing app key", { status: 400 });
    }

    // Find application by key
    let app: Application | null = null;
    try {
      const provider = Factory.appManager.driver();
      app = provider.findByKey(appKey);
    } catch (error) {
      console.error("Error finding application:", error);
      return new Response("Invalid application", { status: 404 });
    }

    if (!app) {
      return new Response("Application not found", { status: 404 });
    }

    // Get origin from request
    const origin = req.headers.get("origin");

    // Set up WebSocket data with app and origin for use in handlers
    const wsData: WebSocketData = {
      app,
      origin,
    };

    // Upgrade the connection to WebSocket
    const upgraded = server.upgrade(req, {
      data: wsData,
    });

    if (!upgraded) {
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Return undefined to indicate successful upgrade (Bun requirement)
    // The actual connection handling will happen in the websocket.open handler
    return undefined;
  }

  /**
   * Handle event triggering
   *
   * @param req - The incoming request
   * @param params - Route parameters including appId
   * @returns JSON response with result
   *
   * @private
   */
  private static async handleEvents(
    req: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    if (
      !Factory.eventsController ||
      !Factory.channelManager ||
      !Factory.appManager
    ) {
      return new Response("Server not initialized", { status: 500 });
    }

    if (!params.appId) {
      return new Response("Missing appId parameter", { status: 400 });
    }

    try {
      // Convert Bun Request to IHttpRequest
      const httpRequest = await Factory.convertToHttpRequest(req);
      const httpConnection = Factory.createHttpConnection();

      // Get the application
      const app = Factory.appManager.driver().findById(params.appId);
      const channelManager = Factory.channelManager.for(app);

      // Call the controller
      const response = await Factory.eventsController.__invoke(
        httpRequest,
        httpConnection,
        app,
        channelManager,
      );

      return Factory.convertToResponse(response);
    } catch (error) {
      console.error("Error handling events:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Handle batch event triggering
   *
   * @param req - The incoming request
   * @param params - Route parameters including appId
   * @returns JSON response with result
   *
   * @private
   */
  private static async handleBatchEvents(
    req: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    if (
      !Factory.eventsBatchController ||
      !Factory.channelManager ||
      !Factory.appManager
    ) {
      return new Response("Server not initialized", { status: 500 });
    }

    if (!params.appId) {
      return new Response("Missing appId parameter", { status: 400 });
    }

    try {
      const httpRequest = await Factory.convertToHttpRequest(req);
      const httpConnection = Factory.createHttpConnection();
      const app = Factory.appManager.driver().findById(params.appId);
      const channelManager = Factory.channelManager.for(app);

      const response = await Factory.eventsBatchController.handle(
        httpRequest,
        httpConnection,
        params.appId,
        app,
        channelManager,
      );

      return Factory.convertToResponse(response);
    } catch (error) {
      console.error("Error handling batch events:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Handle connection listing
   *
   * @param req - The incoming request
   * @param params - Route parameters including appId
   * @returns JSON response with list of connections
   *
   * @private
   */
  private static async handleConnections(
    req: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    if (!Factory.appManager) {
      return new Response("Server not initialized", { status: 500 });
    }

    if (!params.appId) {
      return new Response("Missing appId parameter", { status: 400 });
    }

    try {
      const httpRequest = await Factory.convertToHttpRequest(req);
      const httpConnection = Factory.createHttpConnection();
      const response = await connectionsController(
        httpRequest,
        httpConnection,
        params.appId,
      );

      return Factory.convertToResponse(response);
    } catch (error) {
      console.error("Error handling connections:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Handle channel listing
   *
   * @param req - The incoming request
   * @param params - Route parameters including appId
   * @returns JSON response with list of channels
   *
   * @private
   */
  private static async handleChannels(
    req: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    if (!Factory.channelsController || !Factory.appManager) {
      return new Response("Server not initialized", { status: 500 });
    }

    if (!params.appId) {
      return new Response("Missing appId parameter", { status: 400 });
    }

    try {
      const httpRequest = await Factory.convertToHttpRequest(req);
      const httpConnection = Factory.createHttpConnection();
      const response = await Factory.channelsController.__invoke(
        httpRequest,
        httpConnection,
        params.appId,
      );

      return Factory.convertToResponse(response);
    } catch (error) {
      console.error("Error handling channels:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Handle channel information request
   *
   * @param req - The incoming request
   * @param params - Route parameters including appId and channel
   * @returns JSON response with channel info
   *
   * @private
   */
  private static async handleChannelInfo(
    req: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    if (!Factory.channelController || !Factory.appManager) {
      return new Response("Server not initialized", { status: 500 });
    }

    if (!params.appId || !params.channel) {
      return new Response("Missing appId or channel parameter", {
        status: 400,
      });
    }

    try {
      const response = await Factory.channelController.handle(
        req,
        params.appId,
        params.channel,
      );

      return Factory.convertToResponse(response);
    } catch (error) {
      console.error("Error handling channel info:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Handle channel users listing (presence)
   *
   * @param req - The incoming request
   * @param params - Route parameters including appId and channel
   * @returns JSON response with list of users in channel
   *
   * @private
   */
  private static async handleChannelUsers(
    req: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    if (!Factory.appManager) {
      return new Response("Server not initialized", { status: 500 });
    }

    if (!params.appId || !params.channel) {
      return new Response("Missing appId or channel parameter", {
        status: 400,
      });
    }

    try {
      const httpRequest = await Factory.convertToHttpRequest(req);
      const httpConnection = Factory.createHttpConnection();
      const response = await channelUsersController(
        httpRequest,
        httpConnection,
        params.channel,
        params.appId,
      );

      return Factory.convertToResponse(response);
    } catch (error) {
      console.error("Error handling channel users:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Handle user connection termination
   *
   * @param req - The incoming request
   * @param params - Route parameters including appId and userId
   * @returns JSON response with result
   *
   * @private
   */
  private static async handleTerminateConnections(
    req: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    if (!Factory.usersTerminateController || !Factory.appManager) {
      return new Response("Server not initialized", { status: 500 });
    }

    if (!params.appId || !params.userId) {
      return new Response("Missing appId or userId parameter", { status: 400 });
    }

    try {
      const response = await Factory.usersTerminateController.handle(
        req,
        params.appId,
        params.userId,
      );

      return Factory.convertToResponse(response);
    } catch (error) {
      console.error("Error handling terminate connections:", error);
      return new Response(
        JSON.stringify({
          error:
            error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Handle health check request
   *
   * @param req - The incoming request
   * @param params - Route parameters (none for this endpoint)
   * @returns Response indicating server health
   *
   * @private
   */
  private static handleHealthCheck(
    _req: Request,
    _params: Record<string, string>,
  ): Response {
    return Response.json({ health: "OK" }, { status: 200 });
  }

  /**
   * Configure TLS context for the server
   *
   * Filters out null values and attempts to auto-detect certificates
   * for the given hostname if not explicitly provided.
   * Sets verify_peer to true in production environments for better security.
   *
   * @param context - Initial TLS context (may contain null values)
   * @param hostname - Hostname for certificate auto-detection
   * @param environment - The environment name (default: NODE_ENV or 'development')
   *                     Used to determine TLS peer verification settings
   * @returns Configured TLS context
   *
   * @private
   */
  private static configureTls(
    context: TlsContext,
    hostname?: string,
    environment: string = process.env.NODE_ENV || "development",
  ): TlsContext {
    // Filter out null/undefined values
    const filtered: TlsContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (value !== null && value !== undefined) {
        filtered[key] = value;
      }
    }

    // Try to auto-detect certificates if not provided and hostname is given
    if (
      !Factory.usesTls(filtered) &&
      hostname &&
      Certificate.exists(hostname)
    ) {
      const certs = Certificate.resolve(hostname);
      if (certs) {
        const [certPath, keyPath] = certs;
        filtered.local_cert = certPath;
        filtered.local_pk = keyPath;
        // Enable peer verification in production for better security
        filtered.verify_peer = environment === "production";
      }
    }

    return filtered;
  }

  /**
   * Determine whether the server uses TLS
   *
   * Checks if TLS context has both certificate and key configured.
   *
   * @param context - TLS context to check
   * @returns True if TLS is configured, false otherwise
   *
   * @private
   */
  private static usesTls(context: TlsContext): boolean {
    return !!(context.local_cert || context.local_pk);
  }

  /**
   * Convert Bun Request to IHttpRequest
   *
   * @param req - The Bun Request object
   * @returns IHttpRequest interface
   *
   * @private
   */
  private static async convertToHttpRequest(req: Request): Promise<any> {
    const url = new URL(req.url);
    const body = req.method !== "GET" ? await req.text() : "";
    const method = req.method;
    // Store pathname + search for full path, but pathname only for signature verification
    const pathWithQuery = url.pathname + url.search;
    const pathWithoutQuery = url.pathname;
    const host = url.host;

    // Convert Headers to Record<string, string>
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      method,
      path: pathWithQuery,
      url: req.url, // Include full URL with query string for controllers to access query params
      httpVersion: "1.1",
      headers,
      body,
      getMethod(): string {
        return method;
      },
      getPath(): string {
        // Return path without query string for Pusher signature verification
        // Pusher signatures are calculated over the path without the query string
        return pathWithoutQuery;
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
        return { path: pathWithoutQuery, host };
      },
      getSize(): number {
        return Buffer.byteLength(body, "utf8");
      },
    };
  }

  /**
   * Create a mock HTTP connection for controller use
   *
   * @returns HTTP Connection object
   *
   * @private
   */
  private static createHttpConnection(): any {
    return {
      id: Math.floor(Math.random() * 1000000),
      connected: true,
      _buffer: "",
      getId() {
        return this.id;
      },
      connect() {
        this.connected = true;
        return this;
      },
      isConnected() {
        return this.connected;
      },
      buffer() {
        return this._buffer;
      },
      hasBuffer() {
        return this._buffer !== "";
      },
      bufferLength() {
        return this._buffer.length;
      },
      appendToBuffer(msg: string) {
        this._buffer += msg;
        return this;
      },
      clearBuffer() {
        this._buffer = "";
        return this;
      },
      send() {
        return this;
      },
    };
  }

  /**
   * Convert controller Response to Bun Response
   *
   * @param controllerResponse - The response from the controller
   * @returns Bun Response object
   *
   * @private
   */
  private static convertToResponse(controllerResponse: any): Response {
    // Check if it's our custom HttpResponse class
    if (controllerResponse instanceof HttpResponse) {
      const status = controllerResponse.getStatusCode();
      const body = controllerResponse.getContent();
      const headers = controllerResponse.getHeaders();

      return new Response(body, {
        status,
        headers,
      });
    }

    // Fallback for other response types
    const status = controllerResponse.status || 200;
    const body =
      typeof controllerResponse.content === "string"
        ? controllerResponse.content
        : JSON.stringify(controllerResponse.content);

    return new Response(body, {
      status,
      headers: {
        "Content-Type":
          typeof controllerResponse.content === "string"
            ? "text/plain"
            : "application/json",
      },
    });
  }
}
