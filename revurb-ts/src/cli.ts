#!/usr/bin/env bun

/**
 * Revurb CLI - Command-line interface for managing the WebSocket server
 *
 * A TypeScript port of Laravel Reverb's CLI commands
 *
 * @module cli
 */

import { Factory } from './Servers/Reverb/factory';
import { loadConfig } from './config/load';
import type { ReverbConfig } from './config/types';
import { PruneStaleConnections } from './jobs/prune-stale-connections';
import { PingInactiveConnections } from './jobs/ping-inactive-connections';
import { EventDispatcher } from './events/event-dispatcher';
import { ChannelCreated } from './events/channel-created';
import { ChannelRemoved } from './events/channel-removed';
import { ConnectionPruned } from './events/connection-pruned';
import { MessageSent } from './events/message-sent';
import { MessageReceived } from './events/message-received';
import type { ChannelConnection } from './Protocols/Pusher/Channels/channel-connection';

/**
 * CLI argument parsing result
 */
interface ParsedArgs {
  command: string;
  options: Record<string, string | boolean>;
  args: string[];
}

/**
 * Parse command-line arguments
 */
function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // Remove 'bun' and script path
  const command = args[0] || 'help';
  const options: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if this is a boolean flag or has a value
      if (!nextArg || nextArg.startsWith('--') || nextArg.startsWith('-')) {
        options[key] = true;
      } else {
        options[key] = nextArg;
        i++; // Skip next arg since we used it as value
      }
    } else if (arg.startsWith('-')) {
      // Short flags are always boolean
      const key = arg.slice(1);
      options[key] = true;
    } else {
      positional.push(arg);
    }
  }

  return { command, options, args: positional };
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
Revurb - Bun-powered WebSocket server implementing the Pusher protocol

USAGE:
  revurb <command> [options]

COMMANDS:
  start       Start the WebSocket server
  help        Display this help message
  version     Display version information

START OPTIONS:
  --host <address>      The IP address the server should bind to (default: from config)
  --port <number>       The port the server should listen on (default: from config)
  --path <path>         The path prefix for all routes (default: from config)
  --hostname <name>     The hostname for TLS certificate resolution (default: from config)
  --debug               Enable debug logging to console
  --config <path>       Path to configuration file

EXAMPLES:
  revurb start                                    # Start with default config
  revurb start --host 127.0.0.1 --port 8080      # Start with custom host/port
  revurb start --debug                            # Start with debug logging
  revurb start --config ./reverb.config.ts        # Start with custom config

CONFIGURATION:
  Revurb looks for configuration in the following locations:
  1. Path specified by --config option
  2. Environment variables (REVERB_*)
  3. ./reverb.config.ts
  4. Built-in defaults

  See documentation for full configuration options.
`);
}

/**
 * Display version information
 */
function displayVersion(): void {
  const pkg = require('../package.json');
  console.log(`Revurb v${pkg.version}`);
  console.log(`Bun ${Bun.version}`);
}

/**
 * Start the WebSocket server
 */
async function startServer(options: Record<string, string | boolean>): Promise<void> {
  try {
    // Load configuration
    const configPath = typeof options.config === 'string' ? options.config : undefined;
    const config: ReverbConfig = await loadConfig(configPath);

    // Get server configuration (use 'reverb' as default server name)
    const serverName = config.default || 'reverb';
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      console.error(`❌ Server configuration not found for: ${serverName}`);
      process.exit(1);
    }

    // Override with CLI options
    const host = (typeof options.host === 'string' ? options.host : undefined) || serverConfig.host;
    const port = (typeof options.port === 'string' ? options.port : undefined) || String(serverConfig.port);
    const path = (typeof options.path === 'string' ? options.path : undefined) || serverConfig.path || '';
    const hostname = (typeof options.hostname === 'string' ? options.hostname : undefined) || serverConfig.hostname;
    const maxRequestSize = serverConfig.max_request_size || 10000;
    const serverOptions = serverConfig.options || {};

    // Log configuration
    console.log('🚀 Starting Revurb WebSocket Server');
    console.log('');
    console.log('Configuration:');
    console.log(`  Host:     ${host}`);
    console.log(`  Port:     ${port}`);
    if (path) {
      console.log(`  Path:     ${path}`);
    }
    if (hostname && hostname !== host) {
      console.log(`  Hostname: ${hostname}`);
    }
    console.log(`  Protocol: pusher`);
    console.log('');

    // Log applications
    const apps = config.apps.apps || [];
    console.log(`Applications: ${apps.length}`);
    for (const app of apps) {
      console.log(`  - ${app.app_id} (key: ${app.key})`);
    }
    console.log('');

    // Initialize factory with configuration
    Factory.initialize(config);

    // Setup event listeners for observability
    setupEventListeners(options.debug === true);

    // Create and start server
    const server = Factory.make(
      host,
      port,
      path,
      hostname,
      maxRequestSize,
      serverOptions as { tls?: Record<string, unknown>; [key: string]: unknown },
      'pusher',
    );

    // Setup periodic tasks (equivalent to Laravel's scheduled jobs)
    setupPeriodicTasks();

    // Setup graceful shutdown
    setupGracefulShutdown(server);

    // Check if TLS is actually configured (not just an empty object)
    const hasTls = serverOptions.tls && (serverOptions.tls.cert || serverOptions.tls.key);
    const scheme = hasTls ? 'wss' : 'ws';
    const httpScheme = hasTls ? 'https' : 'http';

    console.log('✅ Server started successfully');
    console.log('');
    console.log(`  WebSocket: ${scheme}://${hostname || host}:${port}${path}`);
    console.log(`  HTTP API:  ${httpScheme}://${hostname || host}:${port}${path}`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');

    // Keep process alive
    // Bun.serve() returns a server that keeps the process running

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error instanceof Error) {
      console.error(error.message);
      if (options.debug) {
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
}

/**
 * Setup event listeners for observability and logging
 */
function setupEventListeners(debug: boolean = false): void {
  const logger = Factory.getLogger();

  // Channel lifecycle events
  EventDispatcher.on('channel:created', (event: ChannelCreated) => {
    if (debug) {
      logger.debug(`Channel created: ${event.channel.name()}`);
    }
  });

  EventDispatcher.on('channel:removed', (event: ChannelRemoved) => {
    if (debug) {
      logger.debug(`Channel removed: ${event.channel.name()}`);
    }
  });

  // Connection lifecycle events
  EventDispatcher.on('connection:pruned', (event: ConnectionPruned) => {
    if (debug) {
      logger.debug(`Connection pruned: ${event.connection.id()}`);
    }
  });

  // Message events
  EventDispatcher.on('message:sent', (event: MessageSent) => {
    if (debug) {
      logger.debug(`Message sent to connection ${event.connection.id()}`);
    }
  });

  EventDispatcher.on('message:received', (event: MessageReceived) => {
    if (debug) {
      logger.debug(`Message received from connection ${event.connection.id()}`);
    }
  });
}

/**
 * Setup periodic tasks for connection management
 */
function setupPeriodicTasks(): void {
  const channelManager = Factory.getChannelManager();
  const applicationProvider = Factory.getApplicationProvider();
  const logger = Factory.getLogger();

  const pruneJob = new PruneStaleConnections(applicationProvider, logger, channelManager);
  const pingJob = new PingInactiveConnections(applicationProvider, logger, channelManager);

  // Ping inactive connections every 60 seconds
  setInterval(async () => {
    try {
      await pingJob.handle();
    } catch (error) {
      logger.error(`Error pinging inactive connections: ${error}`);
    }
  }, 60_000);

  // Prune stale connections every 60 seconds (offset by 30 seconds from ping)
  setInterval(async () => {
    try {
      await pruneJob.handle();
    } catch (error) {
      logger.error(`Error pruning stale connections: ${error}`);
    }
  }, 60_000);
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(server: ReturnType<typeof Factory.make>): void {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

  for (const signal of signals) {
    process.on(signal, async () => {
      console.log('');
      console.log(`⏹️  Received ${signal}, shutting down gracefully...`);

      try {
        // Get all connections and disconnect them gracefully
        const channelManager = Factory.getChannelManager();
        const applicationProvider = Factory.getApplicationProvider();
        const applications = applicationProvider.all();

        console.log('  Disconnecting active connections...');

        let totalDisconnected = 0;
        for (const application of applications) {
          const scopedChannels = channelManager.for(application);
          const allConnections = scopedChannels.connections();

          for (const [, channelConnection] of Object.entries(allConnections)) {
            const channelConn = channelConnection as ChannelConnection;
            const connection = channelConn.connection();

            try {
              // Send closing message
              channelConn.send(
                JSON.stringify({
                  event: 'pusher:error',
                  data: JSON.stringify({
                    code: 4200,
                    message: 'Server shutting down',
                  }),
                })
              );

              // Unsubscribe from all channels (requires underlying Connection)
              scopedChannels.unsubscribeFromAll(connection);

              // Disconnect
              channelConn.disconnect();
              totalDisconnected++;
            } catch (error) {
              // Ignore individual connection errors during shutdown
            }
          }
        }

        console.log(`  Disconnected ${totalDisconnected} connection(s)`);
      } catch (error) {
        console.error('  Error during graceful shutdown:', error);
      }

      // Stop the server
      server.stop();

      console.log('✅ Server stopped');
      process.exit(0);
    });
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  switch (parsed.command) {
    case 'start':
      await startServer(parsed.options);
      break;

    case 'version':
    case '--version':
    case '-v':
      displayVersion();
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      displayHelp();
      break;
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
