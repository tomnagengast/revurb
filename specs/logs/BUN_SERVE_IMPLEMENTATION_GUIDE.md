# Bun.serve Implementation Guide for Laravel Reverb

This guide outlines the specific requirements and patterns for implementing a Bun.serve equivalent to replace React PHP architecture in Laravel Reverb.

---

## 1. Core Implementation Requirements

### 1.1 TCP Server Binding

**React Implementation:**
```php
new SocketServer($uri, $options, $loop);  // "0.0.0.0:8080" or "tls://0.0.0.0:8080"
```

**Bun.serve Equivalent:**
```javascript
Bun.serve({
  hostname: "0.0.0.0",
  port: 8080,
  tls: {
    cert: Bun.file("/path/to/cert.pem"),
    key: Bun.file("/path/to/key.pem"),
  },
  fetch(req) { /* ... */ },
  websocket: { /* ... */ },
})
```

**Key Differences:**
- Bun combines HTTP and WebSocket into single `Bun.serve()` call
- TLS configuration embedded in options object
- No separate event loop management needed (built-in)

### 1.2 HTTP Request Parsing and Buffering

**React Implementation:**
- Manual buffering with `\r\n\r\n` delimiter detection
- Incremental append to buffer
- GuzzleHttp PSR7 parsing after complete header received
- Content-Length validation

**Bun Equivalent:**
```javascript
// Bun automatically handles HTTP parsing
fetch(req: Request): Response | Promise<Response> {
  // req is fully parsed by Bun
  const url = new URL(req.url);
  const method = req.method;
  
  // Body available as readable stream if needed
  const body = await req.text();
  
  return new Response(body);
}
```

**Buffer Management Strategy:**
- For large payloads, use Bun's `ReadableStream` API
- Implement max size checks before processing
- Monitor memory usage during incremental reads

### 1.3 WebSocket Upgrade Flow

**React Implementation:**
```php
if ($request->getHeader('Upgrade')[0] === 'websocket') {
    $response = $this->negotiator->handshake($request);
    $connection->write(Message::toString($response));
    return new ReverbConnection($connection);
}
```

**Bun Equivalent:**
```javascript
Bun.serve({
  websocket: {
    open(ws) {
      // Called after successful upgrade
    },
    message(ws, message) {
      // Handle incoming WebSocket message
    },
    close(ws) {
      // Connection closed
    },
  },
  fetch(req) {
    // Detect upgrade request
    if (req.headers.get("upgrade") === "websocket") {
      if (Bun.serve.websocket(req)) {
        return;  // Handled by WebSocket handler
      }
    }
    return new Response("Upgrade failed", { status: 400 });
  },
})
```

**Handshake Handling:**
- Bun automatically handles RFC 6455 handshake
- Return upgraded connection from fetch handler
- No manual header manipulation needed

### 1.4 Connection State Management

**React Implementation:**
```php
class Connection {
    protected bool $connected = false;
    
    public function connect(): void { $this->connected = true; }
    public function isConnected(): bool { return $this->connected; }
}
```

**Bun Equivalent:**
```javascript
// Per-connection state in WebSocket data property
const connections = new Map();

// In open handler:
connections.set(ws, {
  id: ws.data?.id || generateId(),
  app: null,
  maxMessageSize: 10000,
  channels: new Set(),
  userId: null,
});

// Retrieve state:
const state = connections.get(ws);
```

**Key Difference:**
- Store per-connection state in `ws.data` object in Bun
- No separate connection ID derivation needed (use unique Map key)

### 1.5 HTTP Message Buffer Implementation

**React Implementation:**
```php
class Connection {
    protected string $buffer = '';
    
    public function appendToBuffer($message): void { $this->buffer .= $message; }
    public function clearBuffer(): void { $this->buffer = ''; }
}
```

**Bun Equivalent:**
```javascript
// Implement custom buffering for incremental HTTP parsing
class HTTPBuffer {
  constructor(maxSize = 10000) {
    this.buffer = new Uint8Array(maxSize);
    this.length = 0;
    this.maxSize = maxSize;
  }
  
  append(chunk) {
    if (this.length + chunk.length > this.maxSize) {
      throw new Error("Buffer overflow");
    }
    this.buffer.set(chunk, this.length);
    this.length += chunk.length;
  }
  
  getContent() {
    return new TextDecoder().decode(this.buffer.slice(0, this.length));
  }
  
  clear() {
    this.length = 0;
  }
}
```

---

## 2. Request/Response Handling

### 2.1 HTTP Routing

**React Implementation:**
```php
$route = $this->matcher->match($uri->getPath());  // Symfony Routing
$controller = $this->controller($route);
$response = $controller(...$this->arguments($controller, $routeParameters));
```

**Bun Equivalent:**
```javascript
// Use URL pattern matching
function matchRoute(path, method) {
  const patterns = [
    { pattern: /^\/app\/([^/]+)$/, method: "GET", handler: pusherController },
    { pattern: /^\/apps\/([^/]+)\/events$/, method: "POST", handler: eventsController },
    // ... more routes
  ];
  
  for (const route of patterns) {
    if (route.method === method) {
      const match = path.match(route.pattern);
      if (match) {
        return { handler: route.handler, params: match.slice(1) };
      }
    }
  }
  return null;
}

// In fetch handler:
const { handler, params } = matchRoute(url.pathname, req.method) || {};
if (!handler) {
  return new Response("Not found", { status: 404 });
}

const response = await handler(req, ...params);
```

**Parameter Extraction:**
- Use regex captures instead of Reflection
- Build parameter map from route pattern matches
- Pass to controller functions directly

### 2.2 Response Generation

**React Implementation (Symfony JsonResponse):**
```php
class Response extends JsonResponse {
    public function __construct(mixed $data = null, int $status = 200, array $headers = []) {
        parent::__construct($data, $status, $headers, true);
        $this->headers->set('Content-Length', (string) strlen($this->content));
    }
}

// Usage:
$connection->send(Message::toString($response));
$connection->close();
```

**Bun Equivalent:**
```javascript
function createResponse(data, status = 200, headers = {}) {
  const body = JSON.stringify(data);
  const responseHeaders = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body).toString(),
    ...headers,
  };
  
  return new Response(body, {
    status,
    headers: responseHeaders,
  });
}

// Usage:
ws.send(createResponse({ message: "error" }));
ws.close();
```

### 2.3 Promise-based Async Controllers

**React Implementation:**
```php
$response = $controller(...$this->arguments($controller, $routeParameters));

return $response instanceof PromiseInterface ?
    $response->then(fn ($response) => $connection->send($response)->close()) :
    $connection->send($response)->close();
```

**Bun Equivalent:**
```javascript
async function dispatchController(handler, params) {
  try {
    const response = await Promise.resolve(handler(...params));
    return response;
  } catch (error) {
    return createResponse({ error: error.message }, 500);
  }
}

// In fetch handler:
const response = await dispatchController(handler, params);
return response instanceof Response ? response : createResponse(response);
```

---

## 3. WebSocket Frame Handling

### 3.1 Message Parsing

**React Implementation (Ratchet):**
```php
$this->buffer = new MessageBuffer(
    new CloseFrameChecker,
    maxMessagePayloadSize: $this->maxMessageSize,
    onMessage: $this->onMessage ?: fn () => null,
    onControl: fn (FrameInterface $message) => $this->control($message),
    sender: [$this->connection, 'send']
);
```

**Bun Equivalent:**
```javascript
websocket: {
  message(ws, message) {
    // message is already parsed by Bun
    // Could be string, Buffer, or ArrayBuffer
    
    if (typeof message === "string") {
      // Text frame
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } else {
      // Binary frame
      const data = new DataView(message);
      handleBinaryMessage(ws, data);
    }
  },
  
  close(ws, code, message) {
    // Handle close frame
    // code: RFC 6455 close code
    // message: optional reason
  },
}
```

**Key Differences:**
- Bun automatically parses frames
- No manual frame buffering needed
- Message type detected automatically

### 3.2 Control Frames (Ping/Pong)

**React Implementation:**
```php
public function control(FrameInterface $message): void {
    match ($message->getOpcode()) {
        Frame::OP_PING => $this->send(new Frame($message->getPayload(), opcode: Frame::OP_PONG)),
        Frame::OP_PONG => fn () => null,
        Frame::OP_CLOSE => $this->close($message),
    };
}
```

**Bun Equivalent:**
```javascript
// Bun handles ping/pong automatically
// No manual intervention needed

websocket: {
  backpressure: "ignore", // or "drain" 
  // Bun sends pong automatically on ping
  
  message(ws, message) {
    // Only application messages arrive here
  },
  
  close(ws, code, reason) {
    // Handle close - don't need to send close frame
    // Bun handles the close handshake
  },
}
```

### 3.3 Message Size Limits

**React Implementation:**
```php
$this->buffer = new MessageBuffer(
    ...,
    maxMessagePayloadSize: $this->maxMessageSize,
    ...
);
```

**Bun Equivalent:**
```javascript
// Per-connection limit tracking
const connectionLimits = new Map();

websocket: {
  open(ws) {
    connectionLimits.set(ws, {
      maxMessageSize: 10000, // or per-app config
    });
  },
  
  message(ws, message) {
    const limit = connectionLimits.get(ws)?.maxMessageSize;
    const size = typeof message === "string" 
      ? Buffer.byteLength(message) 
      : message.byteLength;
    
    if (size > limit) {
      ws.send(JSON.stringify({ 
        event: "pusher:error", 
        data: { message: "Message too large" } 
      }));
      ws.close(1009); // MANDATORY_EXTENSION
      return;
    }
    
    handleMessage(ws, message);
  },
}
```

---

## 4. Event Loop and Async Operations

### 4.1 Event Loop Integration

**React Implementation:**
```php
$loop = Loop::get();
$loop->run();  // Blocking call

// Periodic tasks:
$loop->addPeriodicTimer(30, fn () => gc_collect_cycles());
$loop->addPeriodicTimer(60, fn () => pruneConnections());
$loop->addTimer(5, fn () => checkRestart());
```

**Bun Equivalent:**
```javascript
// Bun has built-in event loop, no explicit management needed
// Use setInterval for periodic tasks

setInterval(() => {
  gc();  // Bun's garbage collection
}, 30000);

setInterval(() => {
  pruneConnections();
}, 60000);

setInterval(() => {
  checkRestart();
}, 5000);
```

**Key Differences:**
- Bun automatically manages event loop
- No explicit `loop->run()` call needed
- `setInterval` available globally

### 4.2 Promise Handling

**React Implementation:**
```php
use React\Promise\PromiseInterface;

$response instanceof PromiseInterface ?
    $response->then(fn ($r) => $connection->send($r)->close()) :
    $connection->send($response)->close();
```

**Bun Equivalent:**
```javascript
async function sendResponse(ws, responsePromise) {
  try {
    const response = await responsePromise;
    ws.send(typeof response === "string" ? response : JSON.stringify(response));
    ws.close();
  } catch (error) {
    ws.send(JSON.stringify({ error: error.message }));
    ws.close(1011);  // Server error
  }
}
```

---

## 5. Signal Handling and Graceful Shutdown

### 5.1 Signal Handlers

**React Implementation:**
```php
public function getSubscribedSignals(): array {
    return [SIGINT, SIGTERM, SIGTSTP];
}

public function handleSignal(int $signal = 0): int|false {
    $this->gracefullyDisconnect();
    return $signal;
}
```

**Bun Equivalent:**
```javascript
const connections = new Set();

Bun.listen({
  socket: [
    parseInt(process.env.SIGINT || "2"),
    parseInt(process.env.SIGTERM || "15"),
  ],
  
  data(socket, data) {
    const signal = data[0];
    if (signal === 2 || signal === 15) {  // SIGINT, SIGTERM
      gracefulShutdown();
    }
  },
});

function gracefulShutdown() {
  console.log("Gracefully terminating connections");
  
  for (const ws of connections) {
    ws.close(1001, "Server shutting down");  // Going Away
  }
  
  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
```

### 5.2 Connection Cleanup on Shutdown

**React Implementation:**
```php
$this->laravel->make(ChannelManager::class)
    ->for($application)
    ->connections()
    ->each->disconnect();
```

**Bun Equivalent:**
```javascript
function gracefulShutdown() {
  // Get all active channels/subscriptions
  const apps = getApplications();
  
  for (const app of apps) {
    const channelManager = getChannelManager(app);
    const allConnections = channelManager.connections();
    
    for (const conn of allConnections) {
      // Send close frame with reason
      conn.close(1001, "Server shutting down");
    }
  }
}
```

---

## 6. Redis PubSub Integration

### 6.1 Redis Client Connection

**React Implementation:**
```php
$this->clientFactory->make($this->loop, $redisUrl)->then(
    fn (Client $client) => $this->onConnection($client),
    fn (Exception $e) => $this->onFailedConnection($e),
);
```

**Bun Equivalent:**
```javascript
import { Redis } from "@upstash/redis";

async function connectRedis(redisUrl) {
  try {
    const redis = new Redis({
      url: redisUrl,
    });
    
    // Test connection
    await redis.ping();
    return redis;
  } catch (error) {
    console.error("Redis connection failed:", error);
    throw error;
  }
}
```

### 6.2 Pub/Sub Subscription

**React Implementation:**
```php
$this->subscriber->subscribe();
$this->subscriber->on('message', function (string $channel, string $payload) {
    $this->messageHandler->handle($payload);
});
```

**Bun Equivalent:**
```javascript
async function setupPubSub(redis) {
  const channel = "reverb";
  
  const pubsub = redis.subscribe(channel);
  
  pubsub.on("message", (message) => {
    const payload = JSON.parse(message);
    handleIncomingMessage(payload);
  });
  
  pubsub.on("error", (error) => {
    console.error("Redis subscription error:", error);
    // Reconnect logic
    reconnectRedis();
  });
}
```

### 6.3 Publishing Events

**React Implementation:**
```php
public function publish(array $payload): PromiseInterface {
    if (! $this->isConnected($this->client)) {
        $this->queueEvent($payload);
        return new Promise(fn () => new RuntimeException);
    }
    
    return $this->client->publish($this->channel, json_encode($payload));
}
```

**Bun Equivalent:**
```javascript
const eventQueue = [];

async function publishEvent(payload) {
  try {
    await redis.publish("reverb", JSON.stringify(payload));
  } catch (error) {
    // Queue event for retry
    eventQueue.push(payload);
    console.error("Publish failed, queued:", error);
    
    // Retry queued events on reconnection
    scheduleRetry();
  }
}

async function processQueuedEvents() {
  while (eventQueue.length > 0) {
    const payload = eventQueue.shift();
    try {
      await redis.publish("reverb", JSON.stringify(payload));
    } catch (error) {
      eventQueue.unshift(payload);  // Put back in queue
      break;
    }
  }
}
```

### 6.4 Reconnection Strategy

**React Implementation:**
```php
public function reconnect(): void {
    if (! $this->shouldRetry) return;
    
    $this->loop->addTimer(1, fn () => $this->attemptReconnection());
}

protected function attemptReconnection(): void {
    $this->retryTimer++;
    
    if ($this->retryTimer >= $this->retryTimeout()) {
        throw RedisConnectionException::failedAfter($this->name, $this->retryTimeout());
    }
    
    $this->connect();
}
```

**Bun Equivalent:**
```javascript
class RedisClient {
  constructor(url, timeout = 60) {
    this.url = url;
    this.timeout = timeout;
    this.retryCount = 0;
    this.shouldRetry = true;
  }
  
  async reconnect() {
    if (!this.shouldRetry) return;
    
    await sleep(1000);
    
    if (this.retryCount >= this.timeout) {
      throw new Error(`Redis reconnection failed after ${this.timeout}s`);
    }
    
    this.retryCount++;
    await this.connect();
  }
  
  async connect() {
    try {
      this.client = await connectRedis(this.url);
      this.retryCount = 0;
      console.log("Redis connection established");
    } catch (error) {
      console.log("Redis connection failed, retrying...");
      await this.reconnect();
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 7. Configuration and Initialization

### 7.1 Server Configuration

**React Implementation (PHP Config):**
```php
[
    'servers' => [
        'reverb' => [
            'host' => env('REVERB_SERVER_HOST', '0.0.0.0'),
            'port' => env('REVERB_SERVER_PORT', 8080),
            'hostname' => env('REVERB_SERVER_HOSTNAME'),
            'max_request_size' => 10_000,
            'options' => [
                'tls' => [
                    'local_cert' => env('REVERB_SERVER_CERT_PATH'),
                    'local_pk' => env('REVERB_SERVER_KEY_PATH'),
                ],
            ],
        ],
    ],
]
```

**Bun Equivalent (JavaScript Config):**
```javascript
const config = {
  host: process.env.REVERB_SERVER_HOST || "0.0.0.0",
  port: parseInt(process.env.REVERB_SERVER_PORT || "8080"),
  hostname: process.env.REVERB_SERVER_HOSTNAME,
  maxRequestSize: 10000,
  tls: process.env.REVERB_SERVER_CERT_PATH ? {
    cert: Bun.file(process.env.REVERB_SERVER_CERT_PATH),
    key: Bun.file(process.env.REVERB_SERVER_KEY_PATH),
  } : undefined,
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    timeout: 60,
  },
};

export default config;
```

### 7.2 Application Initialization

**React Implementation:**
```php
$server = ServerFactory::make(
    $host = $this->option('host') ?: $config['host'],
    $port = $this->option('port') ?: $config['port'],
    $path = $this->option('path') ?: $config['path'] ?? '',
    $hostname = $this->option('hostname') ?: $config['hostname'],
    $config['max_request_size'] ?? 10_000,
    $config['options'] ?? [],
    loop: $loop
);

$server->start();
```

**Bun Equivalent:**
```javascript
import config from "./config.js";
import { setupServer } from "./server.js";
import { setupPubSub } from "./pubsub.js";

async function start() {
  console.log(`Starting server on ${config.host}:${config.port}`);
  
  // Initialize Redis PubSub
  if (config.redis.url) {
    await setupPubSub(config.redis);
  }
  
  // Setup periodic maintenance
  setupPeriodicTasks();
  
  // Start server
  const server = setupServer(config);
  console.log(`Server listening on ${server.hostname}:${server.port}`);
}

start().catch(console.error);
```

---

## 8. Performance Optimizations

### 8.1 Connection Pooling

**Pattern:**
```javascript
const connections = new Set();
const connectionsByApp = new Map();

websocket: {
  open(ws) {
    const appId = extractAppId(ws.url);
    connections.add(ws);
    
    if (!connectionsByApp.has(appId)) {
      connectionsByApp.set(appId, new Set());
    }
    connectionsByApp.get(appId).add(ws);
  },
  
  close(ws) {
    const appId = extractAppId(ws.url);
    connections.delete(ws);
    connectionsByApp.get(appId)?.delete(ws);
  },
}
```

### 8.2 Memory Management

```javascript
// Periodic cleanup
setInterval(() => {
  // Remove orphaned connections
  for (const [appId, conns] of connectionsByApp.entries()) {
    conns.forEach(ws => {
      if (ws.readyState !== WebSocket.OPEN) {
        conns.delete(ws);
      }
    });
    
    if (conns.size === 0) {
      connectionsByApp.delete(appId);
    }
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}, 30000);
```

### 8.3 Backpressure Handling

```javascript
websocket: {
  backpressure: "drain",  // or "ignore"
  
  drain(ws) {
    // Called when send buffer is drained
    // Resume processing queued messages
    resumeMessageQueue(ws);
  },
}
```

---

## 9. Testing and Debugging

### 9.1 Health Check Endpoint

**PHP Implementation:**
```php
Route::get('/up', new HealthCheckController)
```

**Bun Equivalent:**
```javascript
const routes = [
  // ... other routes
  {
    pattern: /^\/up$/,
    method: "GET",
    handler: (req) => new Response(JSON.stringify({ status: "up" }), {
      headers: { "Content-Type": "application/json" },
    }),
  },
];
```

### 9.2 Debug Logging

```javascript
// Conditional debug logging
const DEBUG = process.env.DEBUG === "true";

function log(level, message, context = {}) {
  if (level === "debug" && !DEBUG) return;
  
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, context);
}

// Usage
log("info", "WebSocket connected", { wsId: ws.remoteAddress });
log("debug", "Message received", { appId, message });
```

---

## 10. Migration Checklist

- [ ] Setup Bun project structure
- [ ] Implement HTTP server with Bun.serve()
- [ ] Create route matching system
- [ ] Implement WebSocket upgrade flow
- [ ] Add per-connection state management
- [ ] Implement frame message parsing
- [ ] Add message size validation
- [ ] Create signal handlers for graceful shutdown
- [ ] Implement Redis PubSub client
- [ ] Setup automatic reconnection logic
- [ ] Add periodic maintenance tasks (GC, pruning)
- [ ] Create health check endpoint
- [ ] Add debug logging
- [ ] Test with WebSocket clients
- [ ] Load testing and performance tuning
- [ ] Document configuration parameters
- [ ] Create deployment guide

