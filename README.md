# Revurb

A Bun-powered real-time WebSocket server implementing the Pusher protocol - a TypeScript port of Laravel Reverb.

## Overview

Revurb is a complete TypeScript port of Laravel Reverb, designed to run on Bun runtime. It provides a high-performance WebSocket server that implements the Pusher protocol, enabling real-time communication for your applications.

## Features

- ✅ **WebSocket Server** - Native Bun WebSocket support with TLS/SSL
- ✅ **Pusher Protocol** - Full Pusher protocol implementation
- ✅ **Channel Management** - Public, private, and presence channels
- ✅ **HTTP API** - RESTful API for server management and event triggering
- ✅ **Redis Pub/Sub** - Production-ready Redis integration using ioredis for multi-server deployments
- ✅ **Authentication** - Application key/secret validation
- ✅ **Event System** - Comprehensive event dispatching
- ✅ **Connection Management** - Lifecycle management and pruning
- ✅ **CLI Interface** - Full command-line interface
- ✅ **Health Checks** - Built-in health monitoring

## Requirements

- Bun >= 1.3.2
- Node.js 18+ (for Bun)

## Installation

```bash
# Clone the repository
git clone https://github.com/tomnagengast/revurb
cd revurb

# Install dependencies
bun install

# Build the project
bun run build
```

## Usage

### Start the Server

```bash
# Development mode with watch
bun run dev

# Production mode
bun run start

# Or directly
bun run src/cli.ts start --host=127.0.0.1 --port=8080
```

### Configuration

Create a configuration file or use environment variables:

```typescript
// reverb.config.ts
export default {
  default: "reverb",
  servers: {
    reverb: {
      host: "127.0.0.1",
      port: 8080,
      path: "",
    },
  },
  apps: {
    provider: "config",
    apps: [
      {
        app_id: "your-app-id",
        key: "your-app-key",
        secret: "your-app-secret",
        allowed_origins: ["*"],
        ping_interval: 60,
        activity_timeout: 30,
      },
    ],
  },
};
```

### Environment Variables

- `REVERB_SERVER_HOST` - Server host (default: 127.0.0.1)
- `REVERB_SERVER_PORT` - Server port (default: 8080)
- `REVERB_SERVER_PATH` - WebSocket path
- `REVERB_APP_ID` - Application ID
- `REVERB_APP_KEY` - Application key
- `REVERB_APP_SECRET` - Application secret
- `REVERB_ALLOWED_ORIGINS` - Allowed origins (comma-separated)

### Programmatic API

Revurb can be embedded in your application using the `createServer` function:

```typescript
import { createServer } from 'revurb';

// Create server with inline config
const { server, shutdown } = await createServer({
  config: {
    default: "reverb",
    servers: {
      reverb: {
        host: "127.0.0.1",
        port: 8080,
      },
    },
    apps: {
      provider: "config",
      apps: [{
        app_id: "my-app-id",
        key: "my-app-key",
        secret: "my-app-secret",
      }],
    },
  },
});

console.log(`Server running on port ${server.port}`);

// Gracefully shutdown when done
await shutdown();
```

**Options:**

- `config` - Config object (takes precedence over configPath)
- `configPath` - Path to config file to load
- `serverName` - Server name to use (overrides config.default)
- `host` - Host override
- `port` - Port override (string or number)
- `path` - Path prefix override
- `hostname` - Hostname override
- `maxRequestSize` - Max request size override
- `enableEventLogging` - Enable debug event logging (default: false)
- `enableJobs` - Enable periodic jobs for ping/prune (default: false)
- `enableSignals` - Enable signal handlers for graceful shutdown (default: false)

**Load config from file:**

```typescript
const { server, shutdown } = await createServer({
  configPath: './reverb.config.ts',
  enableJobs: true,
  enableSignals: true,
});
```

**Override configuration:**

```typescript
const { server, shutdown } = await createServer({
  configPath: './reverb.config.ts',
  host: '0.0.0.0',
  port: 9090,
  path: '/ws',
});
```

**Multiple isolated servers:**

Each call to `createServer` followed by `shutdown` resets internal state, allowing you to create multiple isolated server instances:

```typescript
// First server
const server1 = await createServer({ config: config1 });
await server1.shutdown();

// Second server with different config
const server2 = await createServer({ config: config2 });
await server2.shutdown();
```

## Example Application

Revurb includes a complete example chat application demonstrating real-time WebSocket communication. The example shows how to:

- Programmatically embed Revurb using `createServer`
- Connect to the Revurb WebSocket server
- Subscribe to channels
- Send and receive client events
- Handle ping/pong heartbeats
- Switch between channels

The example embeds Revurb directly in the same process as the frontend dev server, demonstrating how to use the `createServer` API programmatically.

To run the example:

```bash
cd example
bun install
bun run dev
```

This single command starts both:
- **Revurb WebSocket server** on `ws://0.0.0.0:8080` with app key `my-app-key`
- **Frontend dev server** with hot module reloading

The example app will be available at the URL shown in the console output (typically `http://localhost:3000`). Both servers run in the same process and shut down together gracefully.

## Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Type check
bun run typecheck
```

### WebSocket Protocol Compliance

Revurb includes Autobahn WebSocket Testsuite integration to validate protocol compliance:

```bash
# Run Autobahn spec tests
docker run -it --rm \
  --platform linux/amd64 \
  --network host \
  -v "${PWD}/tests/spec:/config" \
  -v "${PWD}/tests/spec/reports:/mnt/autobahn/reports" \
  crossbario/autobahn-testsuite \
  wstest -m fuzzingclient -s /config/client-spec.json
```

The spec tests validate WebSocket protocol compliance including frame handling, UTF-8 validation, and binary message support.

## Project Structure

```
revurb/
├── src/
│   ├── protocols/pusher/     # Pusher protocol implementation
│   ├── servers/reverb/        # Server factory and HTTP handling
│   ├── events/                # Event system
│   ├── loggers/               # Logging implementations
│   ├── contracts/             # TypeScript interfaces
│   └── cli.ts                 # CLI entry point
├── tests/
│   ├── e2e/                   # End-to-end tests
│   ├── feature/               # Feature tests
│   ├── spec/                  # WebSocket protocol spec tests (Autobahn)
│   └── unit/                  # Unit tests
├── example/                   # Example chat application
└── dist/                      # Compiled output
```

## API Endpoints

- `GET /up` - Health check
- `POST /apps/{appId}/events` - Trigger single event
- `POST /apps/{appId}/batch_events` - Trigger batch events
- `GET /apps/{appId}/channels` - List channels
- `GET /apps/{appId}/channels/{channel}` - Channel info
- `GET /apps/{appId}/channels/{channel}/users` - Channel users (presence)
- `GET /apps/{appId}/connections` - List connections
- `POST /apps/{appId}/users/{userId}/terminate_connections` - Terminate user connections

## WebSocket Protocol

Revurb implements the Pusher WebSocket protocol. Connect using:

```
wss://your-server:8080/app/your-app-key?protocol=7&client=js&version=8.4.0
```

## Development

```bash
# Format code
bun run format

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix

# Clean build artifacts
bun run clean
```

## Continuous Integration

Revurb includes comprehensive automated testing through GitHub Actions:

- **Unit/Feature/E2E Tests** - Full test suite runs on every push with Redis service for integration testing
- **WebSocket Protocol Compliance** - Autobahn Testsuite validates protocol conformance against Pusher spec
- **Example Integration** - Smoke tests ensure `createServer` API and example app work end-to-end
- **Static Analysis** - TypeScript checking and linting on all branches
- **Code Formatting** - Automatic formatting fixes on main branch

All workflows run on push to `main` and on pull requests, ensuring every change is validated before merge.

## Port Status

This is a complete TypeScript port of Laravel Reverb. All core functionality has been ported and tested:

- ✅ 89 tests passing (100%)
- ✅ 0 TypeScript compilation errors
- ✅ All core features implemented
- ✅ Production ready for multi-server deployments
- ✅ Redis Pub/Sub: Full production-ready Redis integration using ioredis with TLS support, automatic reconnection, and event queueing

### Not Ported (Laravel-Specific)

The following Laravel framework-specific components were intentionally not ported:

- Service Providers (Laravel DI container)
- Laravel Artisan Commands
- Laravel Pulse Integration
- Livewire Components

## License

MIT License - see LICENSE.md for details.

## Credits

Port of [Laravel Reverb](https://github.com/laravel/reverb) to TypeScript/Bun.
