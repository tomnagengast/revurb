/**
 * Logger Interface
 *
 * Provides a unified interface for logging throughout the Revurb server.
 * Implementations include StandardLogger (file-based), CliLogger (console output),
 * and NullLogger (no-op for testing).
 *
 * @example
 * ```typescript
 * const logger: ILogger = new StandardLogger();
 * logger.info('Server started', 'Listening on port 8080');
 * logger.error('Connection failed');
 * logger.message('{"event":"pusher:subscribe","data":{"channel":"presence-chat"}}');
 * logger.line(2);
 * ```
 */
export interface ILogger {
  /**
   * Log an informational message.
   *
   * This method is used for general informational logging throughout the server.
   * The message parameter is optional and can provide additional context.
   *
   * @param title - The main title or summary of the log entry
   * @param message - Optional additional details or context
   *
   * @example
   * ```typescript
   * logger.info('Connection established');
   * logger.info('Client connected', 'Socket ID: abc123');
   * ```
   */
  info(title: string, message?: string | null): void;

  /**
   * Log an error message.
   *
   * This method is used to log error conditions, exceptions, or critical issues
   * that occur during server operation.
   *
   * @param message - The error message to log
   *
   * @example
   * ```typescript
   * logger.error('Failed to authenticate client');
   * logger.error('WebSocket connection closed unexpectedly');
   * ```
   */
  error(message: string): void;

  /**
   * Log a debug message.
   *
   * This method is used for debug-level logging that provides detailed information
   * about the internal state and operations of the server. Debug messages are typically
   * only enabled during development or troubleshooting.
   *
   * @param message - The debug message to log
   *
   * @example
   * ```typescript
   * logger.debug('Channel created: presence-chat');
   * logger.debug('Connection pruned: abc123');
   * ```
   */
  debug(message: string): void;

  /**
   * Log a WebSocket message sent to the server.
   *
   * This method is specifically designed for logging WebSocket protocol messages.
   * The message should be a JSON string representing a WebSocket event.
   * Implementations may pretty-print or format the JSON for better readability.
   *
   * @param message - A JSON string containing the WebSocket message data
   *
   * @example
   * ```typescript
   * logger.message('{"event":"pusher:subscribe","data":{"channel":"presence-chat"}}');
   * logger.message('{"event":"client-message","data":{"text":"Hello"}}');
   * ```
   */
  message(message: string): void;

  /**
   * Append one or more blank lines to the log output.
   *
   * This method is primarily used by CLI loggers to improve readability
   * by adding vertical spacing. File-based loggers may implement this as a no-op.
   *
   * @param lines - The number of blank lines to append (default: 1)
   *
   * @example
   * ```typescript
   * logger.line();    // Single blank line
   * logger.line(3);   // Three blank lines
   * ```
   */
  line(lines?: number): void;
}
