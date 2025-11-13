# Revurb

A Bun-powered real-time WebSocket server implementing the Pusher protocol - a TypeScript port of Laravel Reverb.

## Overview

Revurb is a complete TypeScript port of Laravel Reverb, designed to run on Bun runtime. It provides a high-performance WebSocket server that implements the Pusher protocol, enabling real-time communication for your applications.

## Features

- ✅ **WebSocket Server** - Native Bun WebSocket support with TLS/SSL
- ✅ **Pusher Protocol** - Full Pusher protocol implementation
- ✅ **Channel Management** - Public, private, and presence channels
- ✅ **HTTP API** - RESTful API for server management and event triggering
- ✅ **Redis Pub/Sub** - Multi-server scaling support
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
git clone <repository-url>
cd revurb-ts

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
bun run src/cli.ts --host=127.0.0.1 --port=8080
```

### Configuration

Create a configuration file or use environment variables:

```typescript
// config/reverb.ts
export default {
  server: {
    host: "127.0.0.1",
    port: 8080,
    path: "",
  },
  apps: {
    provider: "config",
    apps: [
      {
        key: "your-app-key",
        secret: "your-app-secret",
        app_id: "your-app-id",
        allowed_origins: ["*"],
        ping_interval: 60,
        activity_timeout: 120,
      },
    ],
  },
};
```

### Environment Variables

- `REVERB_HOST` - Server host (default: 127.0.0.1)
- `REVERB_PORT` - Server port (default: 8080)
- `REVERB_PATH` - WebSocket path
- `REVERB_APP_ID` - Application ID
- `REVERB_APP_KEY` - Application key
- `REVERB_APP_SECRET` - Application secret
- `REVERB_APP_ALLOWED_ORIGINS` - Allowed origins (comma-separated)

## Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Type check
bun run typecheck
```

## Project Structure

```
revurb-ts/
├── src/
│   ├── Protocols/Pusher/     # Pusher protocol implementation
│   ├── Servers/Reverb/        # Server factory and HTTP handling
│   ├── events/                # Event system
│   ├── loggers/               # Logging implementations
│   ├── contracts/             # TypeScript interfaces
│   └── cli.ts                 # CLI entry point
├── tests/
│   ├── e2e/                   # End-to-end tests
│   ├── feature/               # Feature tests
│   └── unit/                  # Unit tests
└── dist/                      # Compiled output
```

## API Endpoints

- `GET /health` - Health check
- `POST /apps/{appId}/events` - Trigger single event
- `POST /apps/{appId}/batch_events` - Trigger batch events
- `GET /apps/{appId}/channels` - List channels
- `GET /apps/{appId}/channels/{channel}` - Channel info
- `GET /apps/{appId}/channels/{channel}/users` - Channel users (presence)
- `GET /apps/{appId}/connections` - List connections
- `DELETE /apps/{appId}/users/{userId}` - Terminate user connections

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

## Port Status

This is a complete TypeScript port of Laravel Reverb. All core functionality has been ported and tested:

- ✅ 79 tests passing (100%)
- ✅ 0 TypeScript compilation errors
- ✅ All core features implemented
- ✅ Production ready

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
