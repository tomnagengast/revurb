#!/usr/bin/env bun

/**
 * Revurb CLI - Command-line interface for managing the WebSocket server
 *
 * A TypeScript port of Laravel Reverb's CLI commands
 *
 * @module cli
 */

import { createServer } from "./servers/reverb/factory";

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
  const command = args[0] || "help";
  const options: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if this is a boolean flag or has a value
      if (!nextArg || nextArg.startsWith("--") || nextArg.startsWith("-")) {
        options[key] = true;
      } else {
        options[key] = nextArg;
        i++; // Skip next arg since we used it as value
      }
    } else if (arg.startsWith("-")) {
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
  revurb start --host 127.0.0.1 --port 8080       # Start with custom host/port
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
  const pkg = require("../package.json");
  console.log(`Revurb v${pkg.version}`);
  console.log(`Bun ${Bun.version}`);
}

/**
 * Start the WebSocket server
 */
async function startServer(
  options: Record<string, string | boolean>,
): Promise<void> {
  const configPath =
    typeof options.config === "string" ? options.config : undefined;
  const serverName =
    typeof options.server === "string" ? options.server : undefined;

  const { config, serverConfig } = await createServer({
    ...(configPath && { configPath }),
    ...(serverName && { serverName }),
    ...(typeof options.host === "string" && { host: options.host }),
    ...(typeof options.port === "string" && { port: options.port }),
    ...(typeof options.path === "string" && { path: options.path }),
    ...(typeof options.hostname === "string" && { hostname: options.hostname }),
    ...(typeof options.maxRequestSize === "string" && {
      maxRequestSize: Number.parseInt(options.maxRequestSize, 10),
    }),
    enableEventLogging: options.debug === true,
    enableJobs: true,
    enableSignals: true,
  });

  const host =
    (typeof options.host === "string" ? options.host : undefined) ??
    serverConfig.host;
  const port =
    (typeof options.port === "string" ? options.port : undefined) ??
    String(serverConfig.port);
  const path =
    (typeof options.path === "string" ? options.path : undefined) ??
    serverConfig.path ??
    "";
  const hostname =
    (typeof options.hostname === "string" ? options.hostname : undefined) ??
    serverConfig.hostname;
  const serverOptions = serverConfig.options ?? {};

  console.log("🚀 Starting Revurb WebSocket Server");
  console.log("");
  console.log("Configuration:");
  console.log(`  Host:     ${host}`);
  console.log(`  Port:     ${port}`);
  if (path) {
    console.log(`  Path:     ${path}`);
  }
  if (hostname && hostname !== host) {
    console.log(`  Hostname: ${hostname}`);
  }
  console.log("  Protocol: pusher");
  console.log("");

  const apps = config.apps.apps ?? [];
  console.log(`Applications: ${apps.length}`);
  for (const app of apps) {
    console.log(`  - ${app.app_id} (key: ${app.key})`);
  }
  console.log("");

  const hasTls =
    serverOptions.tls && (serverOptions.tls.cert || serverOptions.tls.key);
  const scheme = hasTls ? "wss" : "ws";
  const httpScheme = hasTls ? "https" : "http";

  console.log("✅ Server started successfully");
  console.log("");
  console.log(`  WebSocket: ${scheme}://${hostname || host}:${port}${path}`);
  console.log(
    `  HTTP API:  ${httpScheme}://${hostname || host}:${port}${path}`,
  );
  console.log("");
  console.log("Press Ctrl+C to stop the server");
  console.log("");
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  switch (parsed.command) {
    case "start":
      try {
        await startServer(parsed.options);
      } catch (error) {
        console.error("❌ Failed to start server:", error);
        if (error instanceof Error) {
          console.error(error.message);
          if (parsed.options.debug) {
            console.error(error.stack);
          }
        }
        process.exit(1);
      }
      break;

    case "version":
    case "--version":
    case "-v":
      displayVersion();
      break;

    default:
      displayHelp();
      break;
  }
}

// Run CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
