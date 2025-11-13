import { Connection as ReverbConnection } from '../../../../connection';
import type { IApplicationProvider } from '../../../../contracts/application-provider';
import type { Server as PusherServer } from '../../server';
import type { Connection } from '../../../../Servers/Reverb/connection';
import type { IHttpRequest } from '../../../../Servers/Reverb/Http/request';
import type { Frame } from '../../../../contracts/websocket-connection';

/**
 * Pusher Controller
 *
 * Base controller for handling Pusher WebSocket connections.
 * Provides the core functionality for:
 * - Connection validation and initialization
 * - Application lookup and verification
 * - Event handler registration (message, control, close)
 * - WebSocket lifecycle management
 *
 * This controller acts as the entry point for Pusher protocol WebSocket
 * connections, delegating specific protocol operations to the PusherServer.
 *
 * @example
 * ```typescript
 * const controller = new PusherController(pusherServer, applications);
 * await controller.__invoke(request, connection, appKey);
 * ```
 */
export class PusherController {
  /**
   * Create a new controller instance.
   *
   * @param server - The Pusher protocol server instance
   * @param applications - The application provider for looking up app configurations
   */
  constructor(
    protected readonly server: PusherServer,
    protected readonly applications: IApplicationProvider
  ) {}

  /**
   * Invoke the Reverb WebSocket server.
   *
   * Handles the initialization of a WebSocket connection for the Pusher protocol.
   * This method:
   * 1. Validates the connection and looks up the application
   * 2. Configures the connection with the application's max message size
   * 3. Registers event handlers for messages, control frames, and close events
   * 4. Opens the connection buffer to begin receiving frames
   * 5. Notifies the server to open the connection
   *
   * @param request - The HTTP request that initiated the WebSocket upgrade
   * @param connection - The WebSocket connection wrapper
   * @param appKey - The application key from the request path
   */
  __invoke(request: IHttpRequest, connection: Connection, appKey: string): void {
    const reverbConnection = this.connection(request, connection, appKey);

    if (!reverbConnection) {
      return;
    }

    connection.withMaxMessageSize(reverbConnection.app().maxMessageSize());

    connection.onMessage(
      (message: string | Buffer) => this.server.message(reverbConnection, String(message))
    );

    connection.onControl(
      (message: Frame) => this.server.control(reverbConnection, message)
    );

    connection.onClose(
      () => this.server.close(reverbConnection)
    );

    // Note: openBuffer() is not needed in TypeScript implementation
    // as Bun's WebSocket handles buffering automatically

    this.server.open(reverbConnection);
  }

  /**
   * Get the Reverb connection instance for the request.
   *
   * Looks up the application by key and creates a new ReverbConnection
   * with the application context and origin information.
   *
   * If the application is not found, sends an error message to the client
   * and closes the connection.
   *
   * @param request - The HTTP request
   * @param connection - The WebSocket connection wrapper
   * @param key - The application key
   * @returns The Reverb connection instance, or null if the application is invalid
   */
  protected connection(
    request: IHttpRequest,
    connection: Connection,
    key: string
  ): ReverbConnection | null {
    try {
      const application = this.applications.findByKey(key);

      return new ReverbConnection(
        connection,
        application,
        request.getHeader('Origin') || null
      );
    } catch (e) {
      const error = e as Error;

      // Check if it's an InvalidApplication error
      if (error.name === 'InvalidApplication') {
        connection.send(
          '{"event":"pusher:error","data":"{\\"code\\":4001,\\"message\\":\\"Application does not exist\\"}"}'
        );

        connection.close();
        return null;
      }

      // Re-throw other errors
      throw error;
    }
  }
}
