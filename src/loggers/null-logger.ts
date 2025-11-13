import type { ILogger } from "../contracts/logger";

/**
 * NullLogger
 *
 * A no-op implementation of the Logger contract for testing or when logging is disabled.
 * All logging methods do nothing, making it useful for environments where logging
 * overhead should be completely eliminated.
 */
export class NullLogger implements ILogger {
  /**
   * Log an informational message.
   */
  info(_title: string, _message?: string | null): void {
    //
  }

  /**
   * Log an error message.
   */
  error(_message: string): void {
    //
  }

  /**
   * Log a debug message.
   */
  debug(_message: string): void {
    //
  }

  /**
   * Log a message sent to the server.
   */
  message(_message: string): void {
    //
  }

  /**
   * Append a new line to the log.
   */
  line(_lines = 1): void {
    //
  }
}
