Your job is to port this repository (Laravel Reverb - PHP) to a Bun 1.3.2 compatible package (we'll call: Revurb) and maintain the repository.

Make a commit and push your changes after every single file edit.

# Development

Keep track of your current status in 

## 2025-11-12 12:32

- Create spec `specs/2025-11-12-1232-convert-to-typescript.md`
- Run 8 parallel subagent analyses of entire codebase
- Generate comprehensive architectural documentation

## 2025-11-12 13:02

- ✅ Complete Phase 2: Core Contracts & Interfaces
- Port 5 core contract interfaces to TypeScript using 8 parallel subagents
- Create Application and Certificate classes
- Create comprehensive Pusher protocol message types (579 lines, 47 exports)
- Files created:
  - `src/contracts/websocket-connection.ts`
  - `src/contracts/connection.ts`
  - `src/contracts/logger.ts`
  - `src/contracts/application-provider.ts`
  - `src/contracts/server-provider.ts`
  - `src/application.ts`
  - `src/certificate.ts`
  - `src/types/pusher-messages.ts`
- Build passing, TypeScript compilation successful
- Minor linting issues (intentional `any` types in Application)

## 2025-11-12 13:17

- ✅ Complete Phase 3: Data Models & Utilities
- Port concrete Connection implementation and all utility functions using 7 parallel subagents
- Port all 7 exception classes (3 base + 4 Pusher protocol exceptions)
- Create comprehensive configuration type definitions
- Files created:
  - `src/connection.ts` - Concrete Connection implementation
  - `src/Events/message-sent.ts` - MessageSent event class
  - `src/Events/index.ts` - Events module exports
  - `src/utils/generates-identifiers.ts` - ID generation utility
  - `src/utils/interacts-with-applications.ts` - Application scoping mixin
  - `src/utils/serializes-connections.ts` - JSON-based connection serializer
  - `src/exceptions/invalid-application.ts`
  - `src/exceptions/invalid-origin.ts`
  - `src/exceptions/redis-connection-exception.ts`
  - `src/protocols/pusher/exceptions/pusher-exception.ts` - Abstract base
  - `src/protocols/pusher/exceptions/connection-unauthorized.ts` (code 4009)
  - `src/protocols/pusher/exceptions/connection-limit-exceeded.ts` (code 4004)
  - `src/protocols/pusher/exceptions/invalid-origin.ts` (code 4009)
  - `src/protocols/pusher/exceptions/index.ts` - Barrel exports
  - `src/config/types.ts` - Complete configuration interfaces
- Build passing, TypeScript compilation successful
- No linting errors in src/ directory
- Codex review: Pending completion

## 2025-11-12 13:36

- ✅ Complete Phase 4: HTTP Server & WebSocket Layer
- Port HTTP server and WebSocket handling using 8 parallel subagents
- Replace React/Socket + Ratchet with Bun.serve() for native WebSocket support
- Implement RFC 6455 WebSocket handshake with proper key generation
- Create HTTP request/response handling and routing infrastructure
- Files created:
  - `src/servers/reverb/http/connection.ts` - HTTP connection wrapper with buffering
  - `src/servers/reverb/http/request.ts` - HTTP request parser with EOM detection
  - `src/servers/reverb/http/response.ts` - HTTP response builder with JSON support
  - `src/servers/reverb/http/router.ts` - HTTP router with WebSocket upgrade handling
  - `src/servers/reverb/http/route.ts` - Route definition helpers for all HTTP methods
  - `src/servers/reverb/http/server.ts` - Main HTTP server using Bun.serve()
  - `src/servers/reverb/connection.ts` - WebSocket connection implementation
  - `src/servers/reverb/factory.ts` - Server factory with Pusher routes and TLS config
- Build passing, TypeScript compilation successful
- Fixed buffer naming conflict in HTTP Connection class

## 2025-11-12 21:47

- ✅ Complete Phase 5: Pusher Protocol Implementation
- Port all Pusher protocol core files using 6 parallel subagents
- Implement complete Pusher WebSocket protocol with all 15 message types
- Create event routing, dispatching, and client event handling
- Implement metrics collection and distributed server support
- Port utility concerns for channel information and serialization
- Files created:
  - `src/protocols/pusher/server.ts` - Main Pusher protocol server (300+ lines)
  - `src/protocols/pusher/event-handler.ts` - Event routing for pusher:* messages (500+ lines)
  - `src/protocols/pusher/event-dispatcher.ts` - Message dispatching to channels (250+ lines)
  - `src/protocols/pusher/client-event.ts` - Client-to-client event handling (150+ lines)
  - `src/protocols/pusher/metrics-handler.ts` - Metrics collection with distributed server support (630+ lines)
  - `src/protocols/pusher/concerns/interacts-with-channel-information.ts` - Channel info utilities (180+ lines)
  - `src/protocols/pusher/concerns/serializes-channels.ts` - Channel serialization utilities (150+ lines)
- Total: ~2,160 lines of TypeScript across 7 files
- Build passing, all new Pusher protocol files compile successfully
- Temporary interfaces for ChannelManager (will be implemented in Phase 6)
- TODO: Remove console.warn in ClientEvent once EventDispatcher is integrated
- Ready for Phase 6: Channel Management implementation

## 2025-11-12 22:05

- ✅ Complete Phase 6: Channel Management
- Port all 6 channel types with subscription flows using 10 parallel subagents
- Implement complete channel hierarchy with authentication and caching
- Create channel factory pattern with prefix-based type detection
- Implement connection management with proper isolation and cleanup
- Files created:
  - `src/Protocols/Pusher/Channels/channel.ts` - Base Channel class (460 lines)
  - `src/Protocols/Pusher/Channels/private-channel.ts` - HMAC-SHA256 authentication (151 lines)
  - `src/Protocols/Pusher/Channels/presence-channel.ts` - Member tracking with join/leave events (241 lines)
  - `src/Protocols/Pusher/Channels/cache-channel.ts` - Payload caching (167 lines)
  - `src/Protocols/Pusher/Channels/private-cache-channel.ts` - Private + cache (181 lines)
  - `src/Protocols/Pusher/Channels/presence-cache-channel.ts` - Presence + cache (368 lines)
  - `src/Protocols/Pusher/Channels/channel-broker.ts` - Factory with prefix detection (74 lines)
  - `src/Protocols/Pusher/Channels/channel-connection.ts` - Connection wrapper with metadata (117 lines)
  - `src/Protocols/Pusher/Contracts/channel-manager.ts` - Channel manager interface (221 lines)
  - `src/Protocols/Pusher/Managers/array-channel-manager.ts` - In-memory manager (328 lines)
  - `src/Protocols/Pusher/Contracts/channel-connection-manager.ts` - Connection manager interface (123 lines)
  - `src/Protocols/Pusher/Managers/array-channel-connection-manager.ts` - In-memory implementation (114 lines)
- Total: ~2,545 lines of TypeScript across 12 files
- Fixed TypeScript compilation errors with override keywords and parameter ordering
- Fixed constructor dependency injection (name, channelConnectionManager, channelManager, logger)
- Build passing, all channel files compile successfully
- Replaced temporary interfaces with proper implementations
- Channel prefix detection order: private-cache-, presence-cache-, cache-, private-, presence-, (default)
- Ready for Phase 7: Application Management

## 2025-11-12 22:12

- ✅ Complete Phase 7: Application Management
- Port application management infrastructure using 2 parallel subagents
- Implement configuration loading from environment variables
- Create complete environment variable parsing with proper type conversions
- Files created:
  - `src/application-manager.ts` - Factory for creating application providers (150 lines)
  - `src/config-application-provider.ts` - Config-based application provider (95 lines)
  - `src/config/load.ts` - Environment variable loader with helpers (285 lines)
- Fixed TypeScript exactOptionalPropertyTypes errors in config loading
- Fixed type import issues with verbatimModuleSyntax
- Fixed null checks in Pusher server and HTTP router
- Connection limit enforcement: Already implemented in Pusher server (Phase 5)
- Origin validation with glob patterns: Already implemented in Pusher server (Phase 5)
- Environment variables supported: 27 total (3 required, 24 optional with defaults)
- Build passing, TypeScript compilation successful
- Total: ~530 lines of TypeScript across 3 files
- Ready for Phase 8: Redis Pub/Sub & Scaling

## 2025-11-12 22:34

- ✅ Complete Phase 8: Redis Pub/Sub & Scaling
- Port complete Redis pub/sub infrastructure using 8 parallel subagents
- Implement dual client pattern (separate publisher/subscriber connections)
- Create auto-reconnection logic with 1s intervals and 60s timeout
- Implement event queue for zero data loss during disconnections
- Files created:
  - `src/Servers/Reverb/Contracts/pubsub-provider.ts` - PubSub provider interface (67 lines)
  - `src/Servers/Reverb/Contracts/pubsub-incoming-message-handler.ts` - Message handler interface (25 lines)
  - `src/Servers/Reverb/Publishing/redis-client.ts` - Base Redis client with reconnection (272 lines)
  - `src/Servers/Reverb/Publishing/redis-client-factory.ts` - Redis client factory with URL parsing (185 lines)
  - `src/Servers/Reverb/Publishing/redis-publish-client.ts` - Publisher with event queue (114 lines)
  - `src/Servers/Reverb/Publishing/redis-subscribe-client.ts` - Subscriber client (31 lines)
  - `src/Servers/Reverb/Publishing/redis-pubsub-provider.ts` - Pub/sub coordinator (167 lines)
  - `src/Protocols/Pusher/pubsub-incoming-message-handler.ts` - Message router (151 lines)
- Total: ~1,012 lines of TypeScript across 8 files
- Implemented EventEmitter for client events (Node.js/Bun standard)
- Used setTimeout for reconnection timing (not React EventLoop)
- JSON serialization for cross-language compatibility
- Queue-based publishing ensures zero data loss
- Proper TypeScript types with interface segregation
- Build passing, TypeScript compilation successful
- Fixed import path casing issues (Contracts vs contracts)
- Fixed Application import type (changed from type import to value import)
- Ready for Phase 9: Lifecycle & Background Jobs

## 2025-11-12 22:46

- ✅ Complete Phase 9: Lifecycle & Background Jobs
- Port connection health monitoring and cleanup jobs using 2 parallel subagents
- Implement connection state machine-based health checks
- Create proper application scoping for multi-tenant job execution
- Files created:
  - `src/jobs/ping-inactive-connections.ts` - Health check job (80 lines)
  - `src/jobs/prune-stale-connections.ts` - Stale connection cleanup (96 lines)
  - `src/jobs/index.ts` - Jobs module exports (9 lines)
- Total: ~185 lines of TypeScript across 3 files
- Key Features:
  - PingInactiveConnections: Pings inactive connections using EventHandler
  - PruneStaleConnections: Disconnects stale connections with error code 4201
  - Proper use of connection state machine (isActive(), isStale())
  - Application-scoped execution via ChannelManager.for()
  - Comprehensive logging for each ping/prune operation
- Build passing, TypeScript compilation successful
- No linting errors in jobs/ directory
- TODO: Timer setup for periodic execution (60s intervals, via setInterval)
- TODO: Graceful shutdown handling on SIGTERM/SIGINT

## 2025-11-12 14:45

- ✅ Complete Phase 10: Logging & Observability
- Port all 4 logger classes using 6 parallel subagents
- Implement complete logging infrastructure with proper ANSI color support
- Create all 5 event classes for monitoring and metrics collection
- Files created:
  - `src/Loggers/standard-logger.ts` - Standard console logger (59 lines)
  - `src/Loggers/cli-logger.ts` - CLI logger with ANSI colors (146 lines)
  - `src/Loggers/null-logger.ts` - No-op logger for testing (39 lines)
  - `src/Loggers/log.ts` - Singleton facade for global logger (88 lines)
  - `src/Loggers/index.ts` - Loggers module exports (17 lines)
  - `src/Events/channel-created.ts` - Channel creation event (27 lines)
  - `src/Events/channel-removed.ts` - Channel removal event (29 lines)
  - `src/Events/connection-pruned.ts` - Connection cleanup event (29 lines)
  - `src/Events/message-received.ts` - Incoming message event (27 lines)
  - `src/Events/index.ts` - Events module exports (updated, 5 lines)
- Total: ~466 lines of TypeScript across 10 files
- Key Features:
  - StandardLogger: Console output with JSON parsing for WebSocket messages
  - CliLogger: Two-column layout, ANSI color codes, bordered JSON output
  - NullLogger: True no-op implementation with underscore-prefixed unused params
  - Log Facade: Static singleton pattern with automatic NullLogger default
  - Event Classes: Proper TypeScript types with EventEmitter compatibility
- Build passing, TypeScript compilation successful
- All loggers properly implement ILogger interface
- All exports correctly configured in barrel files
- Ready for Phase 11: HTTP Controllers & API

---

# Conversion Plan

## Overview

**Total Files**: 94 PHP files to convert to TypeScript/Bun
**Target Runtime**: Bun 1.3.2 (Node.js-compatible)
**Project Name**: Revurb (Reverb + Bun)
**Architecture**: Event-driven WebSocket server implementing Pusher Protocol

## Key Architecture Components

### Layer 1: Foundation (Core Contracts)
- **5 core interfaces**: WebSocketConnection, Connection, Logger, ApplicationProvider, ServerProvider
- **31 methods** across all contracts
- **Dependencies**: Connection depends on WebSocketConnection and Application
- **Critical Patterns**: State machine (Active/Inactive/Stale), fluent API, facade pattern

### Layer 2: Network & Transport
- **TCP Socket Layer**: React/Socket → Bun.listen/Bun.connect (built-in)
- **HTTP Server**: React HTTP + Symfony Router → Bun.serve (built-in)
- **WebSocket Protocol**: Ratchet RFC6455 → Bun.serve WebSocket (built-in)
- **Request/Response**: PSR-7 → Bun Request/Response objects

### Layer 3: Protocol Implementation
- **Pusher Protocol Server**: 15 message types (pusher:*, pusher_internal:*, client-*)
- **Event Handler**: Route Pusher protocol events (subscribe, unsubscribe, ping, pong)
- **Client Events**: Client-to-client broadcasting with socket_id exclusion
- **Authentication**: HMAC-SHA256 for private/presence channels, origin validation

### Layer 4: Channel Management
- **6 Channel Types**: Channel, PrivateChannel, PresenceChannel, CacheChannel, PrivateCacheChannel, PresenceCacheChannel
- **Channel Broker**: Factory with prefix-based type detection
- **Channel Connection Manager**: In-memory HashMap (ArrayChannelConnectionManager)
- **Subscription Flow**: Subscribe → Validate → Auth → Member tracking → Broadcast

### Layer 5: Horizontal Scaling
- **Redis Pub/Sub**: Clue/redis-react → Bun.redis (built-in)
- **Dual Clients**: Separate publisher (with queue) and subscriber connections
- **Message Types**: message, metrics, metrics-retrieved, terminate
- **Serialization**: JSON (avoid PHP serialize())

### Layer 6: Application Management
- **Application**: Immutable value object (id, key, secret, config)
- **Multi-tenancy**: Per-application isolation via ApplicationProvider
- **Connection Limits**: Per-app quotas (error 4004)
- **Origin Validation**: Per-app allowlists with glob patterns (error 4009)

### Layer 7: Lifecycle & Jobs
- **Connection States**: Active → Inactive → Stale
- **PingInactiveConnections**: Health check job (every 60s)
- **PruneStaleConnections**: Cleanup job (every 60s, error 4201)
- **Timer Pattern**: React EventLoop → setInterval/setTimeout (Bun)

### Layer 8: Cross-Cutting Concerns
- **Loggers**: StandardLogger, CliLogger, NullLogger (3 implementations)
- **Concerns/Traits**: GeneratesIdentifiers, InteractsWithApplications, SerializesConnections
- **Event Dispatching**: Laravel events → EventEmitter pattern
- **Serialization**: PHP serialize → JSON schema

---

## Bun Dependency Mapping

| PHP Dependency | Purpose | Bun Equivalent | Notes |
|----------------|---------|----------------|-------|
| react/socket | TCP async I/O | `Bun.listen()` / `Bun.connect()` | Built-in, optimized |
| ratchet/rfc6455 | WebSocket framing | `Bun.serve()` WebSocket | RFC 6455 compliant |
| clue/redis-react | Redis async | `Bun.redis()` | Built-in, RESP3, Zig-based |
| guzzlehttp/psr7 | HTTP messages | Bun Request/Response | Web standard API |
| symfony/routing | URL routing | Custom or `@tanstack/router` | Consider simple regex |
| illuminate/* | Laravel framework | Custom utilities | Port only needed parts |
| react/promise | Promises | Native Promises | ES2015+ |
| react/event-loop | Event loop | Native event loop | Bun runtime |

---

## Implementation Phases

### Phase 1: Project Setup & Foundation (Priority 1)
**Goal**: Establish TypeScript project with build tooling

**Tasks**:
1. ✅ Create detailed conversion plan (this document)
2. ⬜ Initialize package.json with Bun 1.3.2
3. ⬜ Setup tsconfig.json (strict mode, ESNext target)
4. ⬜ Configure build tooling (Bun build, type checking)
5. ⬜ Setup testing framework (Bun test)
6. ⬜ Configure linting (Biome or ESLint)
7. ⬜ Create directory structure matching PHP layout
8. ⬜ Setup hot-reload for development

**Files to Create**:
- `package.json`
- `tsconfig.json`
- `bunfig.toml`
- `.gitignore` (TypeScript-specific)
- `src/` directory structure

**Estimated Code Reduction**: N/A (new setup)

---

### Phase 2: Core Contracts & Interfaces (Priority 2) ✅ COMPLETE
**Goal**: Port all interfaces from src/Contracts/

**Tasks**:
1. ✅ Port `WebSocketConnection` interface
2. ✅ Port `Connection` abstract class (state machine critical)
3. ✅ Port `Logger` interface
4. ✅ Port `ApplicationProvider` interface
5. ✅ Port `ServerProvider` abstract class
6. ✅ Create type definitions for Application, Certificate
7. ✅ Create utility types for Pusher messages

**Files to Convert** (5 contracts):
- `src/Contracts/WebSocketConnection.php` → `src/contracts/websocket-connection.ts`
- `src/Contracts/Connection.php` → `src/contracts/connection.ts`
- `src/Contracts/Logger.php` → `src/contracts/logger.ts`
- `src/Contracts/ApplicationProvider.php` → `src/contracts/application-provider.ts`
- `src/Contracts/ServerProvider.php` → `src/contracts/server-provider.ts`

**Critical Considerations**:
- Connection state machine (lastSeenAt: seconds → milliseconds)
- Fluent API (return `this` not class name)
- Abstract methods vs. interface methods

**Estimated LOC**: ~300-400 lines

---

### Phase 3: Data Models & Utilities (Priority 3) ✅ COMPLETE
**Goal**: Port value objects and helper utilities

**Tasks**:
1. ✅ Port `Application.php` (immutable value object)
2. ✅ Port `Certificate.php`
3. ✅ Port `Connection.php` (concrete implementation)
4. ✅ Port concerns/traits as utility functions or mixins
   - ✅ `GeneratesIdentifiers` → utility function
   - ✅ `InteractsWithApplications` → mixin or base class
   - ✅ `SerializesConnections` → custom serializer
5. ✅ Create configuration types
6. ✅ Port exception classes (7 custom exceptions)

**Files to Convert** (~10 files):
- `src/Application.php` → `src/application.ts`
- `src/Certificate.php` → `src/certificate.ts`
- `src/Connection.php` → `src/connection.ts`
- `src/Concerns/*.php` → `src/utils/*.ts`
- `src/Exceptions/*.php` → `src/exceptions/*.ts`

**Estimated LOC**: ~400-600 lines

---

### Phase 4: HTTP Server & WebSocket Layer (Priority 4)
**Goal**: Replace React/Socket + Ratchet with Bun.serve

**Tasks**:
1. ⬜ Create HTTP server using `Bun.serve()`
2. ⬜ Implement WebSocket upgrade handling
3. ⬜ Port `Http/Server.php` → `http/server.ts`
4. ⬜ Port `Http/Connection.php` → `http/connection.ts`
5. ⬜ Port `Http/Request.php` → use Bun Request (minimal adapter)
6. ⬜ Port `Http/Response.php` → use Bun Response (minimal adapter)
7. ⬜ Port `Http/Router.php` → simple routing logic
8. ⬜ Port `Http/Route.php`
9. ⬜ Implement control frame handling (PING/PONG/CLOSE)

**Files to Convert** (7 files):
- `src/Servers/Reverb/Http/*.php` → `src/servers/reverb/http/*.ts`
- `src/Servers/Reverb/Connection.php` → `src/servers/reverb/connection.ts`
- `src/Servers/Reverb/Factory.php` → `src/servers/reverb/factory.ts`

**Critical Implementation**:
```typescript
// Bun.serve with WebSocket
Bun.serve({
  port: 8080,
  fetch(req, server) {
    // HTTP routing logic
    if (server.upgrade(req)) {
      return; // WebSocket upgrade
    }
    return new Response("HTTP API", { status: 200 });
  },
  websocket: {
    open(ws) { /* connection established */ },
    message(ws, message) { /* handle Pusher protocol */ },
    close(ws, code, reason) { /* cleanup */ },
    ping(ws, data) { /* control frame */ },
    pong(ws, data) { /* control frame */ },
  },
});
```

**Estimated LOC**: ~800-1000 lines (60% reduction from ~2000 LOC PHP)

---

### Phase 5: Pusher Protocol Implementation (Priority 5)
**Goal**: Implement complete Pusher protocol

**Tasks**:
1. ⬜ Port `Protocols/Pusher/Server.php` → `protocols/pusher/server.ts`
2. ⬜ Port `EventHandler.php` → `protocols/pusher/event-handler.ts`
3. ⬜ Port `EventDispatcher.php` → `protocols/pusher/event-dispatcher.ts`
4. ⬜ Port `ClientEvent.php` → `protocols/pusher/client-event.ts`
5. ⬜ Port `MetricsHandler.php` → `protocols/pusher/metrics-handler.ts`
6. ⬜ Implement 15 message types
7. ⬜ Implement authentication (HMAC-SHA256)
8. ⬜ Implement error codes (7 types)

**Files to Convert** (5 core files + concerns):
- `src/Protocols/Pusher/*.php` → `src/protocols/pusher/*.ts`

**Message Types to Implement**:
- **Server → Client**: `pusher:connection_established`, `pusher:error`, `pusher:pong`, `pusher_internal:subscription_succeeded`, `pusher_internal:subscription_error`, `pusher_internal:member_added`, `pusher_internal:member_removed`
- **Client → Server**: `pusher:subscribe`, `pusher:unsubscribe`, `pusher:ping`, `client-*` (custom events)

**Error Codes**:
- 4000: Application only accepts SSL
- 4001: Application does not exist
- 4004: Application connection limit exceeded
- 4009: Invalid origin
- 4100: Invalid event data
- 4201: Pong timeout
- 4301: Subscription to channel failed

**Estimated LOC**: ~1000-1200 lines

---

### Phase 6: Channel Management (Priority 6)
**Goal**: Implement all 6 channel types with subscription flows

**Tasks**:
1. ⬜ Port base `Channel.php` → `channels/channel.ts`
2. ⬜ Port `PrivateChannel.php` → `channels/private-channel.ts`
3. ⬜ Port `PresenceChannel.php` → `channels/presence-channel.ts`
4. ⬜ Port `CacheChannel.php` → `channels/cache-channel.ts`
5. ⬜ Port `PrivateCacheChannel.php` → `channels/private-cache-channel.ts`
6. ⬜ Port `PresenceCacheChannel.php` → `channels/presence-cache-channel.ts`
7. ⬜ Port `ChannelBroker.php` → `channels/channel-broker.ts`
8. ⬜ Port `ChannelConnection.php` → `channels/channel-connection.ts`
9. ⬜ Port channel manager interfaces and implementations
   - ⬜ `ChannelManager` interface
   - ⬜ `ChannelConnectionManager` interface
   - ⬜ `ArrayChannelManager` implementation
   - ⬜ `ArrayChannelConnectionManager` implementation

**Files to Convert** (13 files):
- `src/Protocols/Pusher/Channels/*.php` → `src/protocols/pusher/channels/*.ts`

**Channel Prefix Logic**:
```typescript
function createChannel(name: string): Channel {
  if (name.startsWith('private-cache-')) return new PrivateCacheChannel(name);
  if (name.startsWith('presence-cache-')) return new PresenceCacheChannel(name);
  if (name.startsWith('cache')) return new CacheChannel(name);
  if (name.startsWith('private-')) return new PrivateChannel(name);
  if (name.startsWith('presence-')) return new PresenceChannel(name);
  return new Channel(name);
}
```

**Estimated LOC**: ~1200-1500 lines

---

### Phase 7: Application Management (Priority 7) ✅ COMPLETE
**Goal**: Multi-tenancy and application lifecycle

**Tasks**:
1. ✅ Port `ApplicationManager.php` → `application-manager.ts`
2. ✅ Port `ConfigApplicationProvider.php` → `config-application-provider.ts`
3. ✅ Implement connection limit enforcement
4. ✅ Implement origin validation with glob patterns
5. ✅ Setup configuration loading (environment variables)

**Files to Convert** (3 files):
- `src/ApplicationManager.php` → `src/application-manager.ts`
- `src/ApplicationManagerServiceProvider.php` → (DI setup in main)
- `src/ConfigApplicationProvider.php` → `src/config-application-provider.ts`

**Estimated LOC**: ~300-400 lines

---

### Phase 8: Redis Pub/Sub & Scaling (Priority 8)
**Goal**: Horizontal scaling via Redis

**Tasks**:
1. ⬜ Port `Publishing/RedisClient.php` → `publishing/redis-client.ts`
2. ⬜ Port `RedisClientFactory.php` → `publishing/redis-client-factory.ts`
3. ⬜ Port `RedisPubSubProvider.php` → `publishing/redis-pubsub-provider.ts`
4. ⬜ Port `RedisPublishClient.php` → `publishing/redis-publish-client.ts`
5. ⬜ Port `RedisSubscribeClient.php` → `publishing/redis-subscribe-client.ts`
6. ⬜ Port `PusherPubSubIncomingMessageHandler.php` → `protocols/pusher/pubsub-handler.ts`
7. ⬜ Implement dual client pattern (publisher + subscriber)
8. ⬜ Implement message queue for disconnection handling
9. ⬜ Replace PHP serialize() with JSON

**Files to Convert** (7 files):
- `src/Servers/Reverb/Publishing/*.php` → `src/servers/reverb/publishing/*.ts`
- `src/Protocols/Pusher/PusherPubSubIncomingMessageHandler.php` → `src/protocols/pusher/pubsub-handler.ts`

**Critical Pattern - Dual Clients**:
```typescript
// Publisher (with queue)
class RedisPublishClient {
  private client: RedisClient;
  private queue: Array<any> = [];
  private connected = false;

  async publish(data: any) {
    if (!this.connected) {
      this.queue.push(data);
      return;
    }
    await this.client.publish('reverb', JSON.stringify(data));
  }
}

// Subscriber (separate connection)
class RedisSubscribeClient {
  async subscribe(handler: (message: any) => void) {
    this.client.subscribe('reverb', (err, message) => {
      const data = JSON.parse(message);
      handler(data);
    });
  }
}
```

**Estimated LOC**: ~600-800 lines

---

### Phase 9: Lifecycle & Background Jobs (Priority 9)
**Goal**: Connection health monitoring and cleanup

**Tasks**:
1. ⬜ Port `Jobs/PingInactiveConnections.php` → `jobs/ping-inactive-connections.ts`
2. ⬜ Port `Jobs/PruneStaleConnections.php` → `jobs/prune-stale-connections.ts`
3. ⬜ Setup periodic timer (60s interval)
4. ⬜ Implement connection state tracking
5. ⬜ Implement graceful shutdown on SIGTERM/SIGINT

**Files to Convert** (2 files):
- `src/Jobs/*.php` → `src/jobs/*.ts`

**Timer Pattern**:
```typescript
// In server startup
setInterval(() => {
  new PingInactiveConnections().handle();
  new PruneStaleConnections().handle();
}, 60_000); // 60 seconds
```

**Estimated LOC**: ~200-300 lines

---

### Phase 10: Logging & Observability (Priority 10)
**Goal**: Structured logging and event tracking

**Tasks**:
1. ⬜ Port `Loggers/Logger.php` interface → `loggers/logger.ts`
2. ⬜ Port `StandardLogger.php` → `loggers/standard-logger.ts`
3. ⬜ Port `CliLogger.php` → `loggers/cli-logger.ts`
4. ⬜ Port `NullLogger.php` → `loggers/null-logger.ts`
5. ⬜ Port `Log.php` facade → `loggers/log.ts` (singleton)
6. ⬜ Implement Laravel event equivalents with EventEmitter
7. ⬜ Port event classes (MessageSent, MessageReceived, etc.)

**Files to Convert** (9 files):
- `src/Loggers/*.php` → `src/loggers/*.ts`
- `src/Events/*.php` → `src/events/*.ts`

**Event Pattern**:
```typescript
// EventEmitter-based
class EventBus extends EventEmitter {}
const events = new EventBus();

// Usage
events.emit('message:sent', { connection, message });
events.on('message:sent', (data) => { /* handle */ });
```

**Estimated LOC**: ~400-500 lines

---

### Phase 11: HTTP Controllers & API (Priority 11)
**Goal**: Pusher HTTP API endpoints

**Tasks**:
1. ⬜ Port `Http/Controllers/Controller.php` → base controller
2. ⬜ Port `ChannelsController.php` → `GET /apps/:appId/channels`
3. ⬜ Port `ChannelController.php` → `GET /apps/:appId/channels/:channel`
4. ⬜ Port `ChannelUsersController.php` → `GET /apps/:appId/channels/:channel/users`
5. ⬜ Port `EventsController.php` → `POST /apps/:appId/events`
6. ⬜ Port `EventsBatchController.php` → `POST /apps/:appId/batch_events`
7. ⬜ Port `ConnectionsController.php` → (connection info)
8. ⬜ Port `UsersTerminateController.php` → `POST /apps/:appId/users/:userId/terminate_connections`
9. ⬜ Port `HealthCheckController.php` → `GET /healthcheck`
10. ⬜ Implement HMAC signature verification for API requests

**Files to Convert** (9 files):
- `src/Protocols/Pusher/Http/Controllers/*.php` → `src/protocols/pusher/http/controllers/*.ts`

**Endpoints to Implement**:
- `GET /healthcheck` - Health check
- `GET /apps/:appId/channels` - List channels
- `GET /apps/:appId/channels/:channel` - Channel info
- `GET /apps/:appId/channels/:channel/users` - Presence users
- `POST /apps/:appId/events` - Trigger event
- `POST /apps/:appId/batch_events` - Batch trigger
- `POST /apps/:appId/users/:userId/terminate_connections` - Force disconnect

**Estimated LOC**: ~600-800 lines

---

### Phase 12: Console Commands & CLI (Priority 12)
**Goal**: CLI for starting/managing server

**Tasks**:
1. ⬜ Port `Console/Commands/StartServer.php` → `cli/start-server.ts`
2. ⬜ Port `Console/Commands/RestartServer.php` → `cli/restart-server.ts`
3. ⬜ Port `Console/Components/Message.php` → CLI rendering utilities
4. ⬜ Create main entry point (`index.ts` or `revurb.ts`)
5. ⬜ Setup command-line argument parsing
6. ⬜ Implement signal handling (SIGTERM, SIGINT, restart signal)

**Files to Convert** (3 files):
- `src/Servers/Reverb/Console/Commands/*.php` → `src/cli/*.ts`

**Entry Point**:
```typescript
#!/usr/bin/env bun
// revurb.ts
import { parseArgs } from 'util';
import { startServer } from './cli/start-server';

const args = parseArgs({
  options: {
    host: { type: 'string', default: '0.0.0.0' },
    port: { type: 'string', default: '8080' },
    debug: { type: 'boolean', default: false },
  }
});

startServer(args.values);
```

**Estimated LOC**: ~300-400 lines

---

### Phase 13: Testing Infrastructure (Priority 13)
**Goal**: Comprehensive test coverage

**Tasks**:
1. ⬜ Port unit tests from `tests/Unit/` → `tests/unit/`
2. ⬜ Port feature tests from `tests/Feature/` → `tests/feature/`
3. ⬜ Create test helpers (FakeConnection, FakeApplicationProvider)
4. ⬜ Setup Bun test runner configuration
5. ⬜ Create WebSocket test client
6. ⬜ Port Pusher spec tests (client-spec.json compliance)
7. ⬜ Setup CI/CD (GitHub Actions)

**Test Files to Convert** (~30 test files):
- `tests/Unit/**/*.php` → `tests/unit/**/*.test.ts`
- `tests/Feature/**/*.php` → `tests/feature/**/*.test.ts`

**Test Pattern**:
```typescript
import { describe, test, expect } from 'bun:test';

describe('Channel', () => {
  test('creates public channel', () => {
    const channel = new Channel('my-channel');
    expect(channel.name()).toBe('my-channel');
  });
});
```

**Estimated LOC**: ~2000-3000 lines (tests)

---

### Phase 14: Configuration & Deployment (Priority 14)
**Goal**: Production-ready deployment

**Tasks**:
1. ⬜ Create default configuration file
2. ⬜ Port `config/reverb.php` → `.env` or `revurb.config.ts`
3. ⬜ Setup environment variable loading
4. ⬜ Create Docker container
5. ⬜ Create deployment documentation
6. ⬜ Setup performance benchmarks
7. ⬜ Create migration guide from Reverb to Revurb

**Configuration Structure**:
```typescript
// revurb.config.ts
export default {
  server: {
    host: process.env.REVERB_HOST || '0.0.0.0',
    port: parseInt(process.env.REVERB_PORT || '8080'),
  },
  apps: {
    apps: [
      {
        id: process.env.REVERB_APP_ID,
        key: process.env.REVERB_APP_KEY,
        secret: process.env.REVERB_APP_SECRET,
        max_connections: 1000,
        allowed_origins: ['*'],
      }
    ]
  },
  redis: {
    enabled: process.env.REVERB_SCALING_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }
};
```

**Estimated LOC**: ~200-300 lines

---

### Phase 15: Documentation & Examples (Priority 15)
**Goal**: Complete documentation

**Tasks**:
1. ⬜ Update README.md with Revurb branding
2. ⬜ Create API documentation
3. ⬜ Create usage examples
4. ⬜ Document Bun-specific features
5. ⬜ Create performance comparison (Reverb vs Revurb)
6. ⬜ Document breaking changes from Reverb

**Note**: Per user guidelines, do NOT create documentation proactively. Only if explicitly requested.

---

## File Conversion Checklist

### High Priority (Phases 1-6)
- [ ] **Phase 1**: Project setup (package.json, tsconfig, etc.) - 8 tasks
- [ ] **Phase 2**: Core contracts (5 interfaces) - 7 tasks
- [ ] **Phase 3**: Data models (10 files) - 6 tasks
- [ ] **Phase 4**: HTTP/WebSocket layer (7 files) - 9 tasks
- [ ] **Phase 5**: Pusher protocol (5 files) - 8 tasks
- [ ] **Phase 6**: Channel management (13 files) - 10 tasks

**Total**: 48 tasks, ~25-30 files, Est. 4000-5000 LOC

### Medium Priority (Phases 7-10)
- [ ] **Phase 7**: Application management (3 files) - 5 tasks
- [ ] **Phase 8**: Redis pub/sub (7 files) - 9 tasks
- [ ] **Phase 9**: Lifecycle jobs (2 files) - 5 tasks
- [ ] **Phase 10**: Logging (9 files) - 7 tasks

**Total**: 26 tasks, ~21 files, Est. 1700-2000 LOC

### Lower Priority (Phases 11-15)
- [ ] **Phase 11**: HTTP controllers (9 files) - 10 tasks
- [ ] **Phase 12**: Console commands (3 files) - 6 tasks
- [ ] **Phase 13**: Testing (~30 files) - 7 tasks
- [ ] **Phase 14**: Configuration (misc) - 7 tasks
- [ ] **Phase 15**: Documentation - 6 tasks

**Total**: 36 tasks, ~42 files, Est. 3100-4500 LOC

---

## Code Size Estimates

| Component | PHP LOC | TypeScript LOC | Reduction |
|-----------|---------|----------------|-----------|
| Contracts | 500 | 350 | 30% |
| Data Models | 800 | 600 | 25% |
| HTTP/WebSocket | 2000 | 1000 | 50% |
| Pusher Protocol | 1500 | 1200 | 20% |
| Channels | 2000 | 1500 | 25% |
| Application Mgmt | 500 | 400 | 20% |
| Redis Pub/Sub | 1000 | 700 | 30% |
| Jobs | 400 | 250 | 37% |
| Loggers | 600 | 450 | 25% |
| Controllers | 1000 | 700 | 30% |
| Console | 500 | 350 | 30% |
| Tests | 3000 | 2500 | 17% |
| **Total** | **~13,800** | **~10,000** | **~27%** |

**Expected Code Reduction**: 25-35% due to:
- Bun built-ins replacing external libraries
- Native async/await vs. React promises
- Simpler type system (TypeScript vs. PHP)
- Less boilerplate for DI/service containers

---

## Critical Implementation Details

### 1. Time Handling (CRITICAL)
```php
// PHP: seconds
$lastSeenAt = time(); // 1699999999
```
```typescript
// TypeScript: milliseconds
const lastSeenAt = Date.now(); // 1699999999000

// ALWAYS convert for consistency
const lastSeenAt = Math.floor(Date.now() / 1000); // seconds
```

### 2. Connection State Machine
```typescript
enum ConnectionState {
  ACTIVE,    // time < lastSeenAt + pingInterval
  INACTIVE,  // time >= lastSeenAt + pingInterval && !hasBeenPinged
  STALE,     // time >= lastSeenAt + pingInterval && hasBeenPinged
}
```

### 3. Channel Prefix Matching (Order Matters)
```typescript
// Most specific first!
if (name.startsWith('private-cache-')) return new PrivateCacheChannel(name);
if (name.startsWith('presence-cache-')) return new PresenceCacheChannel(name);
if (name.startsWith('cache')) return new CacheChannel(name);
// ... less specific patterns
```

### 4. HMAC Authentication
```php
// PHP
$signature = hash_hmac('sha256', $string_to_sign, $secret);
```
```typescript
// TypeScript/Bun
const encoder = new TextEncoder();
const key = await crypto.subtle.importKey(
  'raw',
  encoder.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);
const signature = await crypto.subtle.sign(
  'HMAC',
  key,
  encoder.encode(string_to_sign)
);
const hex = Array.from(new Uint8Array(signature))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
```

### 5. Redis Dual Client Pattern (MANDATORY)
```typescript
// NEVER use same connection for pub and sub!
const publisher = new RedisPublishClient(config);
const subscriber = new RedisSubscribeClient(config);

// Subscriber blocks on subscribe() call
await subscriber.subscribe('reverb', handler);

// Publisher sends asynchronously
await publisher.publish({ type: 'message', data });
```

### 6. Serialization (Avoid PHP serialize)
```php
// PHP (avoid in cross-language)
$data = serialize($application);
```
```typescript
// TypeScript (use JSON)
const data = JSON.stringify(application.toJSON());
```

### 7. Event Dispatching Pattern
```typescript
// Event emitter approach
class EventBus extends EventEmitter {}
const bus = new EventBus();

// Dispatch
bus.emit('message:sent', { connection, message });

// Subscribe
bus.on('message:sent', ({ connection, message }) => {
  logger.info('Message sent', message);
});
```

---

## Testing Strategy

### Unit Tests (Priority: High)
- Test each class in isolation
- Mock dependencies (connections, channels, Redis)
- Cover edge cases (disconnections, invalid data, limits)
- Aim for >80% code coverage

### Integration Tests (Priority: High)
- Test WebSocket connection lifecycle
- Test channel subscription flows
- Test authentication mechanisms
- Test Redis pub/sub integration
- Test HTTP API endpoints

### Specification Tests (Priority: Medium)
- Port `tests/Specification/client-spec.json` compliance tests
- Ensure Pusher protocol compatibility
- Test against official Pusher clients

### Performance Tests (Priority: Low)
- Benchmark concurrent connections
- Test message throughput
- Memory usage profiling
- Compare with original Reverb

---

## Risk Mitigation

### High-Risk Areas
1. **WebSocket Framing**: Ensure RFC 6455 compliance (Bun handles this)
2. **Time Handling**: Seconds vs. milliseconds conversion
3. **Redis Serialization**: PHP serialize() incompatibility
4. **HMAC Authentication**: Crypto API differences
5. **Channel Prefix Logic**: Order-dependent matching
6. **Connection State Machine**: Race conditions with timers

### Mitigation Strategies
- Use Bun's built-in WebSocket (already RFC 6455 compliant)
- Create utility functions for time conversion
- Use JSON instead of PHP serialize()
- Thorough testing of authentication flows
- Unit tests for channel broker factory
- Mutex/lock patterns for state transitions

---

## Performance Considerations

### Expected Improvements with Bun
- **Startup time**: 3-5x faster (Bun's fast runtime)
- **Memory usage**: 20-30% reduction (no PHP overhead)
- **WebSocket throughput**: 2-3x higher (native implementation)
- **Cold start**: Near-instant (no JIT warmup)

### Optimization Opportunities
- Use Bun's native `Bun.serve()` for WebSocket (no library overhead)
- Use Bun's native `Bun.redis()` for Redis (Zig-based, faster)
- Use `Map` for channel storage (O(1) lookups)
- Use `Set` for connection tracking
- Leverage Bun's fast JSON parsing
- Use Bun's built-in routing if available

---

## Breaking Changes from Reverb

### Configuration
- Environment variables remain the same
- Configuration file format changes (PHP → TypeScript/JSON)
- No Laravel-specific dependencies

### API Compatibility
- Pusher protocol: 100% compatible
- HTTP API: 100% compatible
- Redis message format: JSON instead of PHP serialize()

### Deployment
- No PHP/Composer required
- Bun 1.3.2+ required
- Docker images will be smaller (~50-100 MB vs ~500 MB)

---

## Success Criteria

### Functional Parity
- [ ] All Pusher protocol messages supported
- [ ] All 6 channel types working
- [ ] Authentication (origin + HMAC) working
- [ ] Redis pub/sub scaling working
- [ ] HTTP API endpoints functional
- [ ] Connection lifecycle working
- [ ] All tests passing

### Performance Targets
- [ ] >10,000 concurrent connections on single core
- [ ] <10ms message latency
- [ ] <100ms WebSocket upgrade time
- [ ] <50 MB memory for 1000 connections

### Quality Targets
- [ ] >80% test coverage
- [ ] Zero TypeScript errors (strict mode)
- [ ] All linting rules passing
- [ ] Documentation complete (if requested)

---

## Next Steps

1. **Review this plan with Codex** for completeness and accuracy
2. **Initialize Bun project structure** (Phase 1)
3. **Start with Phase 2** (core contracts) using parallel subagents
4. **Iterate through phases** with continuous testing
5. **Commit after each file** per user requirements

---

## Progress Log

### 2025-11-12
- ✅ Analyzed all 94 PHP files with 8 parallel subagents
- ✅ Created comprehensive conversion plan with 15 phases
- ✅ Documented all architectural components
- ✅ Identified Bun equivalents for all PHP dependencies
- ⬜ Review plan with Codex (next step)
- ⬜ Initialize Bun project (Phase 1)
