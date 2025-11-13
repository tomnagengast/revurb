import { PusherException } from "./pusher-exception";

/**
 * Exception thrown when a connection is unauthorized.
 * WebSocket close code: 4009
 */
export class ConnectionUnauthorized extends PusherException {
  /**
   * The error code associated with the exception.
   */
  protected code = 4009;

  /**
   * The error message associated with the exception.
   */
  protected errorMessage = "Connection is unauthorized";
}
