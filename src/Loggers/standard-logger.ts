import type { ILogger } from "../contracts/logger";

/**
 * Standard Logger Implementation
 *
 * A standard logger that outputs to the console using Bun's native console API.
 * This logger is suitable for production environments where logs should be
 * captured by a logging system or written to stdout/stderr.
 *
 * @implements {ILogger}
 */
export class StandardLogger implements ILogger {
  /**
   * Log an informational message
   */
  info(title: string, message?: string | null): void {
    let output = title;

    if (message) {
      output += `: ${message}`;
    }

    console.log(output);
  }

  /**
   * Log an error message.
   */
  error(message: string): void {
    console.error(message);
  }

  /**
   * Log a debug message.
   */
  debug(message: string): void {
    console.log(`DEBUG: ${message}`);
  }

  /**
   * Log a message sent to the server.
   */
  message(message: string): void {
    try {
      let parsed: any = JSON.parse(message);

      if (parsed.data?.channel_data) {
        parsed.data.channel_data = JSON.parse(parsed.data.channel_data);
      }

      const formatted = JSON.stringify(parsed, null, 2);
      console.log(formatted);
    } catch (error) {
      // If JSON parsing fails, log the original message
      console.log(message);
    }
  }

  /**
   * Append a new line to the log.
   */
  line(_lines: number = 1): void {
    // No-op for standard logger
  }
}
