# Laravel Reverb Server Analysis Documentation

This directory contains comprehensive architectural analysis of the Laravel Reverb server implementation, with focus on preparing for a Bun.serve equivalent.

## Documents

### 1. REVERB_SERVER_ARCHITECTURE.md (29 KB, 997 lines)

**Complete architectural analysis of the entire Reverb server stack.**

**Key Sections:**
- Entry points and server lifecycle (console command, factory initialization, signal handling)
- HTTP connection handling and WebSocket upgrade flow (TCP acceptance, message parsing, request dispatching, routing)
- Request/Response/Router implementation details (PSR-7 parsing, Symfony routing, parameter resolution)
- TCP socket management (React SocketServer, TLS configuration, connection wrapping, event handling)
- Critical dependencies on React libraries (event loop, socket server, promises, Redis async client)
- Ratchet RFC6455 WebSocket protocol (handshake, frame parsing, control frames)
- PubSub and horizontal scaling (Redis integration, reconnection strategy)
- Periodic maintenance tasks (garbage collection, stale connection pruning, restart monitoring)
- File structure reference with detailed annotations

**Best for:** Understanding the complete architecture, component interactions, and data flow.

---

### 2. BUN_SERVE_IMPLEMENTATION_GUIDE.md (21 KB, 948 lines)

**Practical implementation guide with side-by-side comparisons of React vs Bun equivalents.**

**Key Sections:**
- Core implementation requirements (TCP binding, HTTP parsing, WebSocket upgrade, connection state)
- Request/Response handling (routing patterns, response generation, async controllers)
- WebSocket frame handling (message parsing, control frames, message size limits)
- Event loop and async operations (integration patterns, promise handling)
- Signal handling and graceful shutdown (signal handlers, connection cleanup)
- Redis PubSub integration (client connection, subscriptions, publishing, reconnection)
- Configuration and initialization (parameter mapping, application startup)
- Performance optimizations (connection pooling, memory management, backpressure)
- Testing and debugging (health checks, debug logging)
- Migration checklist (17 steps for complete implementation)

**Best for:** Implementing the Bun server replacement with concrete code examples and patterns.

---

## Key Findings

### React PHP Architecture Summary

**Server Lifecycle:**
```
reverb:start command
  → Factory::make() creates HttpServer
  → Server::start() runs event loop (blocking)
  → Event loop manages all I/O, timers, and connections
```

**HTTP/WebSocket Flow:**
```
TCP Connection
  → HTTP request buffering (manual with \r\n\r\n delimiter)
  → PSR7 parsing (GuzzleHttp)
  → Route matching (Symfony Routing)
  → WebSocket upgrade check (Ratchet RFC6455)
  → Frame parsing loop (Ratchet MessageBuffer)
```

**Critical Components:**
1. **Event Loop:** React EventLoop - central to all async operations
2. **Socket Server:** React SocketServer - TCP/TLS binding
3. **WebSocket Protocol:** Ratchet RFC6455 - handshake and frame parsing
4. **HTTP Parsing:** GuzzleHttp PSR7 - incremental request parsing
5. **Routing:** Symfony Routing - URL pattern matching
6. **Redis:** Clue React Redis - async pub/sub for scaling
7. **Periodic Tasks:** Timer-based maintenance (GC, pruning, restart checks)

---

## Bun.serve Equivalents

### Major Differences from React PHP

| Aspect | React PHP | Bun.serve |
|--------|-----------|-----------|
| **Event Loop** | Explicit Loop::get(), $loop->run() | Built-in, automatic |
| **HTTP Parsing** | Manual buffering, PSR7 parsing | Automatic, Request object |
| **WebSocket** | Separate upgrade flow | Integrated in Bun.serve config |
| **Frame Handling** | Ratchet MessageBuffer | Built-in, automatic |
| **TLS** | URI scheme + context options | Config object |
| **Connection State** | Wrapper class with flags | ws.data object |
| **Routing** | Symfony Routing matcher | Regex pattern matching |
| **Signals** | SignalableCommandInterface | process.on() |
| **Promises** | React Promise chaining | native async/await |
| **Redis** | Clue React Redis | Native Redis clients |

### Implementation Complexity

**Core Server:** ≈ 200-300 lines Bun vs React's multi-class architecture
**WebSocket Handling:** Automatic in Bun vs manual frame parsing in React
**Event Loop:** Implicit in Bun vs explicit management in React
**Async/Await:** Native in JS vs Promise chaining in PHP

---

## Configuration Parameters Reference

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `host` | `0.0.0.0` | TCP bind address |
| `port` | `8080` | TCP listen port |
| `hostname` | - | Virtual hostname for routing |
| `path` | - | Route prefix |
| `max_request_size` | `10000` | HTTP buffer limit |
| `tls.cert` | - | TLS certificate path |
| `tls.key` | - | TLS private key path |
| `redis.url` | - | Redis connection URI |
| `redis.timeout` | `60` | Reconnection timeout (seconds) |

### Periodic Task Intervals

| Task | Interval | Purpose |
|------|----------|---------|
| Garbage Collection | 30 seconds | Force PHP GC cycles |
| Connection Pruning | 60 seconds | Remove stale connections |
| Inactivity Ping | 60 seconds | Detect dead sockets |
| Restart Check | 5 seconds | Monitor restart signals |
| Pulse Ingestion | Configurable | Laravel Pulse metrics |
| Telescope Storage | 15 seconds | Laravel Telescope entries |

---

## Implementation Priority

### Phase 1: Core Server (High Priority)
- [ ] TCP server binding with TLS
- [ ] HTTP request parsing
- [ ] WebSocket upgrade
- [ ] Route matching and dispatching

### Phase 2: WebSocket Features (High Priority)
- [ ] Frame message handling
- [ ] Message size validation
- [ ] Connection state management
- [ ] Close frame handling

### Phase 3: Scaling & Resilience (Medium Priority)
- [ ] Redis PubSub integration
- [ ] Automatic reconnection
- [ ] Event queuing during disconnects

### Phase 4: Operations (Medium Priority)
- [ ] Graceful shutdown
- [ ] Signal handling
- [ ] Periodic maintenance tasks
- [ ] Health check endpoint

### Phase 5: Production (Lower Priority)
- [ ] Performance monitoring
- [ ] Debug logging
- [ ] Load testing
- [ ] Documentation

---

## File Structure in Reverb

```
src/Servers/Reverb/
├── Http/                          # HTTP server core
│   ├── Server.php                 # Main server class
│   ├── Connection.php             # HTTP connection wrapper
│   ├── Request.php                # HTTP request parsing
│   ├── Response.php               # HTTP response builder
│   ├── Router.php                 # WebSocket upgrade + routing
│   └── Route.php                  # Route DSL
├── Connection.php                 # WebSocket wrapper
├── Factory.php                    # Server factory
├── Console/Commands/
│   ├── StartServer.php            # Entry point
│   └── RestartServer.php          # Graceful restart
├── Publishing/                    # Redis PubSub
│   ├── RedisPubSubProvider.php
│   ├── RedisClient.php
│   ├── RedisPublishClient.php
│   ├── RedisSubscribeClient.php
│   └── RedisClientFactory.php
├── Concerns/
│   └── ClosesConnections.php      # Connection teardown
└── Contracts/
    ├── PubSubProvider.php
    └── PubSubIncomingMessageHandler.php
```

---

## Key Dependencies

### Composer Dependencies Required for Bun Equivalent

```javascript
// Core
- "bun": Latest version with WebSocket support

// Optional
- "@upstash/redis": For managed Redis PubSub
- "node-gyp": For native modules if needed
```

### License & Attribution
- React PHP: MIT
- Ratchet: MIT
- GuzzleHttp: MIT
- Symfony: MIT

---

## Next Steps

1. **Read REVERB_SERVER_ARCHITECTURE.md** for complete understanding of current implementation
2. **Review BUN_SERVE_IMPLEMENTATION_GUIDE.md** for specific code patterns and examples
3. **Cross-reference** sections between both documents for deeper learning
4. **Use Migration Checklist** in BUN_SERVE_IMPLEMENTATION_GUIDE.md for tracking implementation progress
5. **Reference Configuration Parameters** section for feature parity validation

---

**Analysis Date:** November 12, 2025
**Analyzer:** Claude Agent - File Search & Code Analysis
**Analysis Depth:** Thorough - Complete codebase exploration
**Documentation Level:** Production-ready

