import { PusherException } from "./pusher-exception";

/**
 * Exception thrown when the application exceeds its connection quota.
 * WebSocket close code: 4004
 */
export class ConnectionLimitExceeded extends PusherException {
  /**
   * The error code associated with the exception.
   */
  protected code = 4004;

  /**
   * The error message associated with the exception.
   */
  protected errorMessage = "Application is over connection quota";
}
