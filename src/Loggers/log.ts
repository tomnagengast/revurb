import type { ILogger } from "../contracts/logger";
import { NullLogger } from "./null-logger";

/**
 * The global logger instance.
 */
let logger: ILogger | null = null;

/**
 * Get the current logger instance.
 * Returns NullLogger if no logger has been set.
 *
 * @returns The current logger instance
 */
function getLogger(): ILogger {
  if (!logger) {
    logger = new NullLogger();
  }
  return logger;
}

/**
 * Set the global logger instance.
 *
 * @param loggerInstance - The logger implementation to use globally
 */
function setLogger(loggerInstance: ILogger): void {
  logger = loggerInstance;
}

/**
 * Log an informational message.
 *
 * @param title - The main title or summary of the log entry
 * @param message - Optional additional details or context
 */
function logInfo(title: string, message?: string | null): void {
  getLogger().info(title, message);
}

/**
 * Log an error message.
 *
 * @param message - The error message to log
 */
function logError(message: string): void {
  getLogger().error(message);
}

/**
 * Log a debug message.
 *
 * @param message - The debug message to log
 */
function logDebug(message: string): void {
  getLogger().debug(message);
}

/**
 * Log a WebSocket message sent to the server.
 *
 * @param message - A JSON string containing the WebSocket message data
 */
function logMessage(message: string): void {
  getLogger().message(message);
}

/**
 * Append one or more blank lines to the log output.
 *
 * @param lines - The number of blank lines to append (default: 1)
 */
function logLine(lines?: number): void {
  getLogger().line(lines);
}

/**
 * Log Facade
 *
 * A singleton facade for accessing the global logger instance.
 * Provides functions that proxy to the underlying logger implementation.
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
export const Log = {
  setLogger,
  getLogger,
  info: logInfo,
  error: logError,
  debug: logDebug,
  message: logMessage,
  line: logLine,
};
