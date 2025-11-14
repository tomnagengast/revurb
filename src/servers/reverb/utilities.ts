/**
 * Utilities for server lifecycle management
 *
 * Shared functions for event logging, periodic tasks, and graceful shutdown
 * Used by both CLI and programmatic server creation
 *
 * @module Servers/Reverb/Utilities
 */

import type { IApplicationProvider } from "../../contracts/application-provider";
import type { ChannelCreated } from "../../events/channel-created";
import type { ChannelRemoved } from "../../events/channel-removed";
import type { ConnectionPruned } from "../../events/connection-pruned";
import { EventDispatcher } from "../../events/event-dispatcher";
import type { MessageReceived } from "../../events/message-received";
import type { MessageSent } from "../../events/message-sent";
import { PingInactiveConnections } from "../../jobs/ping-inactive-connections";
import { PruneStaleConnections } from "../../jobs/prune-stale-connections";
import type { CliLogger } from "../../loggers/cli-logger";
import type { NullLogger } from "../../loggers/null-logger";
import type { ChannelConnection } from "../../protocols/pusher/channels/channel-connection";
import type { ArrayChannelManager } from "../../protocols/pusher/managers/array-channel-manager";

/**
 * Setup event listeners for observability and logging
 *
 * @param logger - Logger instance for debug output
 * @param debug - Whether to enable debug logging
 * @returns Cleanup function to remove all listeners
 */
export function setupEventListeners(
  logger: CliLogger | NullLogger,
  debug: boolean,
): () => void {
  if (!debug) {
    return () => {
      // No listeners to clean up
    };
  }

  const channelCreatedHandler = (event: ChannelCreated) => {
    logger.debug(`Channel created: ${event.channel.name()}`);
  };
  EventDispatcher.on("channel:created", channelCreatedHandler);

  const channelRemovedHandler = (event: ChannelRemoved) => {
    logger.debug(`Channel removed: ${event.channel.name()}`);
  };
  EventDispatcher.on("channel:removed", channelRemovedHandler);

  const connectionPrunedHandler = (event: ConnectionPruned) => {
    logger.debug(`Connection pruned: ${event.connection.id()}`);
  };
  EventDispatcher.on("connection:pruned", connectionPrunedHandler);

  const messageSentHandler = (event: MessageSent) => {
    logger.debug(`Message sent to connection ${event.connection.id()}`);
  };
  EventDispatcher.on("message:sent", messageSentHandler);

  const messageReceivedHandler = (event: MessageReceived) => {
    logger.debug(`Message received from connection ${event.connection.id()}`);
  };
  EventDispatcher.on("message:received", messageReceivedHandler);

  return () => {
    EventDispatcher.off("channel:created", channelCreatedHandler);
    EventDispatcher.off("channel:removed", channelRemovedHandler);
    EventDispatcher.off("connection:pruned", connectionPrunedHandler);
    EventDispatcher.off("message:sent", messageSentHandler);
    EventDispatcher.off("message:received", messageReceivedHandler);
  };
}

/**
 * Setup periodic tasks for connection management
 *
 * @param applicationProvider - Application provider instance
 * @param logger - Logger instance for error output
 * @param channelManager - Channel manager instance
 * @returns Array of interval timers that can be cancelled
 */
export function setupPeriodicTasks(
  applicationProvider: IApplicationProvider,
  logger: CliLogger | NullLogger,
  channelManager: ArrayChannelManager,
): Timer[] {
  const pruneJob = new PruneStaleConnections(
    applicationProvider,
    logger,
    channelManager,
  );
  const pingJob = new PingInactiveConnections(
    applicationProvider,
    logger,
    channelManager,
  );

  const intervals: Timer[] = [];

  const pingInterval = setInterval(async () => {
    try {
      await pingJob.handle();
    } catch (error) {
      logger.error(`Error pinging inactive connections: ${error}`);
    }
  }, 60_000);
  intervals.push(pingInterval);

  const pruneInterval = setInterval(async () => {
    try {
      await pruneJob.handle();
    } catch (error) {
      logger.error(`Error pruning stale connections: ${error}`);
    }
  }, 60_000);
  intervals.push(pruneInterval);

  return intervals;
}

/**
 * Setup graceful shutdown handlers for process signals
 *
 * @param server - Bun server instance to stop
 * @param channelManager - Channel manager for disconnecting connections
 * @param applicationProvider - Application provider for accessing apps
 * @param cleanup - Optional cleanup function to run before shutdown
 * @returns Cleanup function to remove signal handlers
 */
export function setupSignalHandlers(
  server: ReturnType<typeof Bun.serve>,
  channelManager: ArrayChannelManager,
  applicationProvider: IApplicationProvider,
  cleanup?: () => void,
): () => void {
  const signals = ["SIGINT", "SIGTERM", "SIGQUIT"] as const;
  const handlers = new Map<string, () => void>();

  for (const signal of signals) {
    const handler = async () => {
      console.log("");
      console.log(`⏹️  Received ${signal}, shutting down gracefully...`);

      try {
        const applications = applicationProvider.all();

        console.log("  Disconnecting active connections...");

        let totalDisconnected = 0;
        for (const application of applications) {
          const scopedChannels = channelManager.for(application);
          const allConnections = scopedChannels.connections();

          for (const [, channelConnection] of Object.entries(allConnections)) {
            const channelConn = channelConnection as ChannelConnection;
            const connection = channelConn.connection();

            try {
              channelConn.send(
                JSON.stringify({
                  event: "pusher:error",
                  data: JSON.stringify({
                    code: 4200,
                    message: "Server shutting down",
                  }),
                }),
              );

              scopedChannels.unsubscribeFromAll(connection);
              channelConn.disconnect();
              totalDisconnected++;
            } catch (_error) {
              // Ignore individual connection errors during shutdown
            }
          }
        }

        console.log(`  Disconnected ${totalDisconnected} connection(s)`);
      } catch (error) {
        console.error("  Error during graceful shutdown:", error);
      }

      if (cleanup) {
        cleanup();
      }

      server.stop();

      console.log("✅ Server stopped");
      process.exit(0);
    };

    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler);
    }
  };
}

/**
 * Perform graceful shutdown without signal handlers
 *
 * This is the core shutdown logic that can be called programmatically
 * Used by both signal handlers and manual shutdown functions
 *
 * @param server - Bun server instance to stop
 * @param channelManager - Channel manager for disconnecting connections
 * @param applicationProvider - Application provider for accessing apps
 */
export async function performGracefulShutdown(
  server: ReturnType<typeof Bun.serve>,
  channelManager: ArrayChannelManager,
  applicationProvider: IApplicationProvider,
): Promise<void> {
  const applications = applicationProvider.all();

  let totalDisconnected = 0;
  for (const application of applications) {
    const scopedChannels = channelManager.for(application);
    const allConnections = scopedChannels.connections();

    for (const [, channelConnection] of Object.entries(allConnections)) {
      const channelConn = channelConnection as ChannelConnection;
      const connection = channelConn.connection();

      try {
        channelConn.send(
          JSON.stringify({
            event: "pusher:error",
            data: JSON.stringify({
              code: 4200,
              message: "Server shutting down",
            }),
          }),
        );

        scopedChannels.unsubscribeFromAll(connection);
        channelConn.disconnect();
        totalDisconnected++;
      } catch (_error) {
        // Ignore individual connection errors during shutdown
      }
    }
  }

  server.stop();
}
