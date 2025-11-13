import type { ILogger } from "../contracts/logger";
import { NullLogger } from "./null-logger";

/**
 * Log Facade
 *
 * A singleton facade for accessing the global logger instance.
 * Provides static methods that proxy to the underlying logger implementation.
 * Defaults to NullLogger if no logger is explicitly set.
 *
 * @example
 * ```typescript
 * // Set the logger instance
 * Log.setLogger(new StandardLogger());
 *
 * // Use the logger
 * Log.info('Server started', 'Listening on port 8080');
 * Log.error('Connection failed');
 * Log.debug('Channel created: presence-chat');
 * Log.message('{"event":"pusher:subscribe"}');
 * Log.line(2);
 * ```
 */
export class Log {
  /**
   * The global logger instance.
   */
  private static logger: ILogger | null = null;

  /**
   * Set the global logger instance.
   *
   * @param logger - The logger implementation to use globally
   */
  static setLogger(logger: ILogger): void {
    Log.logger = logger;
  }

  /**
   * Get the current logger instance.
   * Returns NullLogger if no logger has been set.
   *
   * @returns The current logger instance
   */
  static getLogger(): ILogger {
    if (!Log.logger) {
      Log.logger = new NullLogger();
    }
    return Log.logger;
  }

  /**
   * Log an informational message.
   *
   * @param title - The main title or summary of the log entry
   * @param message - Optional additional details or context
   */
  static info(title: string, message?: string | null): void {
    Log.getLogger().info(title, message);
  }

  /**
   * Log an error message.
   *
   * @param message - The error message to log
   */
  static error(message: string): void {
    Log.getLogger().error(message);
  }

  /**
   * Log a debug message.
   *
   * @param message - The debug message to log
   */
  static debug(message: string): void {
    Log.getLogger().debug(message);
  }

  /**
   * Log a WebSocket message sent to the server.
   *
   * @param message - A JSON string containing the WebSocket message data
   */
  static message(message: string): void {
    Log.getLogger().message(message);
  }

  /**
   * Append one or more blank lines to the log output.
   *
   * @param lines - The number of blank lines to append (default: 1)
   */
  static line(lines?: number): void {
    Log.getLogger().line(lines);
  }
}
