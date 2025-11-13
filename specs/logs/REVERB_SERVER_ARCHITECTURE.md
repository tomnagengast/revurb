# Laravel Reverb Server Architecture Analysis

## Overview

Laravel Reverb is a real-time WebSocket communication backend built on React PHP event loop architecture. This document provides detailed architectural analysis for implementing a Bun.serve equivalent.

**Repository Path:** `/Users/tom/personal/revurb/src/Servers/Reverb/`

---

## 1. Entry Points and Server Lifecycle

### 1.1 Console Command Entry Point

**File:** `Console/Commands/StartServer.php`

The server lifecycle begins via the `reverb:start` Artisan command:

```php
#[AsCommand(name: 'reverb:start')]
class StartServer extends Command implements SignalableCommandInterface
```

**Command Signature:**
```php
protected $signature = 'reverb:start
    {--host= : The IP address the server should bind to}
    {--port= : The port the server should listen on}
    {--path= : The path the server should prefix to all routes}
    {--hostname= : The hostname the server is accessible from}
    {--debug : Indicates whether debug messages should be displayed in the terminal}';
```

### 1.2 Lifecycle Flow

```
StartServer::handle()
  ├── Retrieve server config from 'config/reverb.servers.reverb'
  ├── Get or create React EventLoop (Loop::get())
  ├── Call Factory::make() to create HttpServer instance
  ├── Ensure Horizontal Scalability (Redis PubSub)
  ├── Ensure Stale Connection Cleanup
  ├── Ensure Restart Command is Respected
  ├── Ensure Pulse Events Collection (if enabled)
  ├── Ensure Telescope Entries Collection (if enabled)
  ├── Log startup message
  └── Call $server->start() to run the event loop
```

### 1.3 Server Factory Initialization

**File:** `Factory.php`

```php
public static function make(
    string $host = '0.0.0.0',
    string $port = '8080',
    string $path = '',
    ?string $hostname = null,
    int $maxRequestSize = 10_000,
    array $options = [],
    string $protocol = 'pusher',
    ?LoopInterface $loop = null
): HttpServer
```

**Factory Responsibilities:**
1. Determine protocol handler (currently only 'pusher' supported)
2. Configure TLS/SSL if needed
3. Create React SocketServer
4. Create Router with protocol-specific routes
5. Return configured HttpServer instance

### 1.4 Server Lifecycle Methods

**File:** `Http/Server.php`

```php
public function __construct(
    protected ServerInterface $socket,
    protected Router $router,
    protected int $maxRequestSize,
    protected ?LoopInterface $loop = null
)

public function start(): void {
    try {
        $this->loop->run();  // Blocking call - runs event loop
    } catch (Throwable $e) {
        Log::error($e->getMessage());
    }
}

public function stop(): void {
    $this->loop->stop();
    $this->socket->close();
}
```

**Initialization Logic:**
- Disables garbage collection (`gc_disable()`)
- Sets up periodic GC collection every 30 seconds: `$this->loop->addPeriodicTimer(30, fn () => gc_collect_cycles());`
- Registers `__invoke` handler on socket for incoming connections

### 1.5 Signal Handling

**Graceful Shutdown (SIGINT, SIGTERM, SIGTSTP on Unix):**
```php
public function handleSignal(int $signal = 0, int|false $previousExitCode = 0): int|false {
    $this->components->info('Gracefully terminating connections.');
    $this->gracefullyDisconnect();
    return $previousExitCode;
}
```

Graceful disconnect disconnects all connections through ChannelManager:
```php
$this->laravel->make(ChannelManager::class)
    ->for($application)
    ->connections()
    ->each->disconnect();
```

---

## 2. HTTP Connection Handling and WebSocket Upgrade Flow

### 2.1 TCP Socket Connection Acceptance

**File:** `Http/Server.php::__invoke()`

```php
public function __invoke(ConnectionInterface $connection): void {
    $connection = new Connection($connection);  // Wrap React socket
    
    $connection->on('data', function ($data) use ($connection) {
        $this->handleRequest($data, $connection);
    });
}
```

### 2.2 HTTP Message Parsing and Buffering

**File:** `Http/Connection.php` (HTTP-level wrapper)

```php
class Connection {
    protected int $id;                    // Derived from stream
    protected bool $connected = false;    // Track if WebSocket upgraded
    protected string $buffer = '';        // HTTP message buffer
    
    public function appendToBuffer($message): void
    public function bufferLength(): int
    public function clearBuffer(): void
}
```

**File:** `Http/Request.php` (HTTP parsing)

```php
const EOM = "\r\n\r\n";  // End of message delimiter

public static function from(
    string $message,
    Connection $connection,
    int $maxRequestSize
): ?RequestInterface
```

**Request Parsing Logic:**
1. Append raw data to connection buffer
2. Check if buffer exceeds maxRequestSize (413 error if exceeded)
3. Check for EOM delimiter in buffer
4. Parse complete HTTP request using GuzzleHttp PSR7
5. Validate Content-Length header
6. Return null if still incomplete, proceed if complete
7. Clear buffer after parsing

### 2.3 Request Dispatching

**File:** `Http/Server.php::handleRequest()`

```php
protected function handleRequest(string $message, Connection $connection): void {
    if ($connection->isConnected()) {
        return;  // Already upgraded to WebSocket
    }
    
    if (($request = $this->createRequest($message, $connection)) === null) {
        return;  // Request incomplete
    }
    
    $connection->connect();  // Mark as connected
    
    try {
        $this->router->dispatch($request, $connection);
    } catch (HttpException $e) {
        $this->close($connection, $e->getStatusCode(), $e->getMessage());
    } catch (Throwable $e) {
        Log::error($e->getMessage());
        $this->close($connection, 500, 'Internal server error.');
    }
}
```

### 2.4 Router and Route Matching

**File:** `Http/Router.php`

```php
public function dispatch(RequestInterface $request, Connection $connection): mixed {
    // Extract URI and set context
    $uri = $request->getUri();
    $context = $this->matcher->getContext();
    $context->setMethod($request->getMethod());
    $context->setHost($uri->getHost());
    
    try {
        $route = $this->matcher->match($uri->getPath());
    } catch (MethodNotAllowedException $e) {
        $this->close($connection, 405, 'Method not allowed.', ['Allow' => $e->getAllowedMethods()]);
        return null;
    } catch (ResourceNotFoundException $e) {
        $this->close($connection, 404, 'Not found.');
        return null;
    }
    
    // Check if WebSocket upgrade requested
    if ($this->isWebSocketRequest($request)) {
        $wsConnection = $this->attemptUpgrade($request, $connection);
        return $controller($request, $wsConnection, ...Arr::except($route, ['_controller', '_route']));
    }
    
    // Regular HTTP response
    $response = $controller(...$this->arguments($controller, $routeParameters));
    return $response instanceof PromiseInterface ?
        $response->then(fn ($response) => $connection->send($response)->close()) :
        $connection->send($response)->close();
}
```

**Routes Generated by Factory:**

```php
protected static function pusherRoutes(string $path): RouteCollection {
    $routes->add('sockets', Route::get('/app/{appKey}', new PusherController(...)));
    $routes->add('events', Route::post('/apps/{appId}/events', new EventsController));
    $routes->add('events_batch', Route::post('/apps/{appId}/batch_events', new EventsBatchController));
    $routes->add('connections', Route::get('/apps/{appId}/connections', new ConnectionsController));
    $routes->add('channels', Route::get('/apps/{appId}/channels', new ChannelsController));
    $routes->add('channel', Route::get('/apps/{appId}/channels/{channel}', new ChannelController));
    $routes->add('channel_users', Route::get('/apps/{appId}/channels/{channel}/users', ...));
    $routes->add('users_terminate', Route::post('/apps/{appId}/users/{userId}/terminate_connections', ...));
    $routes->add('health_check', Route::get('/up', new HealthCheckController));
}
```

### 2.5 WebSocket Upgrade Flow

**File:** `Http/Router.php::attemptUpgrade()`

```php
protected function isWebSocketRequest(RequestInterface $request): bool {
    return $request->getHeader('Upgrade')[0] ?? null === 'websocket';
}

protected function attemptUpgrade(RequestInterface $request, Connection $connection): ReverbConnection {
    // Use Ratchet ServerNegotiator to perform WebSocket handshake
    $response = $this->negotiator->handshake($request)
        ->withHeader('X-Powered-By', 'Laravel Reverb');
    
    // Write handshake response
    $connection->write(Message::toString($response));
    
    // Wrap in ReverbConnection for WebSocket-specific handling
    return new ReverbConnection($connection);
}
```

### 2.6 WebSocket Connection Handling

**File:** `Connection.php` (WebSocket wrapper)

Wraps HTTP connection and implements `WebSocketConnection` contract:

```php
class Connection extends EventEmitter implements WebSocketConnection {
    protected HttpConnection $connection;
    protected MessageBuffer $buffer;
    protected ?callable $onMessage;
    protected ?callable $onControl;
    protected ?callable $onClose;
    protected int $maxMessageSize;
    
    public function openBuffer(): void {
        // Create MessageBuffer to parse incoming frames
        $this->buffer = new MessageBuffer(
            new CloseFrameChecker,
            maxMessagePayloadSize: $this->maxMessageSize,
            onMessage: $this->onMessage ?: fn () => null,
            onControl: fn (FrameInterface $message) => $this->control($message),
            sender: [$this->connection, 'send']
        );
        
        // Register handlers
        $this->connection->on('data', [$this->buffer, 'onData']);
        $this->connection->on('close', $this->onClose ?: fn () => null);
    }
    
    public function send(mixed $message): void
    public function control(FrameInterface $message): void
    public function onMessage(callable $callback): void
    public function onControl(callable $callback): void
    public function onClose(callable $callback): void
}
```

---

## 3. Request/Response/Router Implementation Details

### 3.1 HTTP Request Class (PSR-7)

**File:** `Http/Request.php`

- Uses GuzzleHttp PSR7 Message parser: `Message::parseRequest($buffer)`
- Handles incremental buffering of incomplete requests
- Validates Content-Length header
- Throws `OverflowException` if buffer exceeds limit
- Throws generic exceptions for malformed requests

**Key Methods:**
```php
public static function from(string $message, Connection $connection, int $maxRequestSize): ?RequestInterface
protected static function isEndOfMessage(string $message): bool
```

### 3.2 HTTP Response Class

**File:** `Http/Response.php`

```php
class Response extends JsonResponse {
    public function __construct(
        mixed $data = null,
        int $status = 200,
        array $headers = [],
        bool $json = false
    ) {
        parent::__construct($data, $status, $headers, $json);
        $this->headers->set('Content-Length', (string) strlen($this->content));
    }
}
```

**Extends Symfony JsonResponse:**
- Automatically sets Content-Length header
- Handles JSON serialization
- Standard HTTP status codes

### 3.3 HTTP Route Definition

**File:** `Http/Route.php`

Wrapper around Symfony Routing with HTTP method helpers:

```php
class Route {
    use RouteTrait;  // Symfony routing trait
    
    public static function get(string $path, callable $action): BaseRoute
    public static function post(string $path, callable $action): BaseRoute
    public static function put(string $path, callable $action): BaseRoute
    public static function patch(string $path, callable $action): BaseRoute
    public static function delete(string $path, callable $action): BaseRoute
    public static function head(string $path, callable $action): BaseRoute
    public static function connect(string $path, callable $action): BaseRoute
    public static function options(string $path, callable $action): BaseRoute
    public static function trace(string $path, callable $action): BaseRoute
}
```

### 3.4 Router Parameter Resolution

**File:** `Http/Router.php`

Router uses reflection to extract controller parameters and match to route params:

```php
protected function parameters(mixed $controller): array {
    $method = match (true) {
        $controller instanceof Closure => new ReflectionFunction($controller),
        is_string($controller) => // static or function call
        ! is_array($controller) => new ReflectionMethod($controller, '__invoke'),
        is_array($controller) => new ReflectionMethod($controller[0], $controller[1]),
    };
    
    return array_map(function ($parameter) {
        return [
            'name' => $parameter->getName(),
            'type' => $parameter->getType()->getName(),
            'position' => $parameter->getPosition(),
        ];
    }, $method->getParameters());
}
```

### 3.5 Connection Close Handling

**File:** `Concerns/ClosesConnections.php`

```php
trait ClosesConnections {
    protected function close(
        Connection $connection,
        int $statusCode = 400,
        string $message = '',
        array $headers = []
    ): void {
        $response = new Response($statusCode, $headers, $message);
        $connection->send(Message::toString($response));
        $connection->close();
    }
}
```

---

## 4. TCP Socket Management

### 4.1 Socket Server Creation

**File:** `Factory.php`

```php
$uri = static::usesTls($options['tls']) 
    ? "tls://{$host}:{$port}" 
    : "{$host}:{$port}";

return new HttpServer(
    new SocketServer($uri, $options, $loop),  // React\Socket\SocketServer
    $router,
    $maxRequestSize,
    $loop
);
```

**React SocketServer Configuration:**
- URI format: `{host}:{port}` or `tls://{host}:{port}`
- Supports TLS context options
- Binds to specified host/port
- Emits 'connection' event for each incoming TCP connection

### 4.2 TLS/SSL Configuration

**File:** `Factory.php::configureTls()`

```php
protected static function configureTls(array $context, ?string $hostname): array {
    $context = array_filter($context, fn ($value) => $value !== null);
    
    if (! static::usesTls($context) && $hostname && Certificate::exists($hostname)) {
        [$certificate, $key] = Certificate::resolve($hostname);
        $context['local_cert'] = $certificate;
        $context['local_pk'] = $key;
        $context['verify_peer'] = app()->environment() === 'production';
    }
    
    return $context;
}
```

**Supported TLS Context Options:**
- `local_cert`: Path to certificate file
- `local_pk`: Path to private key file
- `verify_peer`: Enable/disable peer verification (production setting)

### 4.3 Connection Object Wrapping

**File:** `Http/Connection.php`

React ConnectionInterface is wrapped to provide:
- Connection ID derivation from stream pointer
- Connection state tracking (connected flag)
- HTTP message buffering
- Method proxying to underlying React connection

```php
public function __construct(protected ConnectionInterface $connection) {
    $this->id = (int) $connection->stream;
}

public function __call($method, $parameters) {
    if (! method_exists($this->connection, $method)) {
        throw new BadMethodCallException(...);
    }
    return $this->connection->{$method}(...$parameters);
}
```

**React ConnectionInterface Methods Used:**
- `write($data)`: Send data to client
- `end()`: Close connection
- `stream`: Underlying stream resource (used for ID)
- `on($event, $callback)`: Register event handler
- `close()`: Force close connection

### 4.4 Connection Event Handling

**Server-level Event Binding:**

```php
$socket->on('connection', $this);  // In Server::__construct()

public function __invoke(ConnectionInterface $connection): void {
    $connection = new Connection($connection);
    $connection->on('data', function ($data) use ($connection) {
        $this->handleRequest($data, $connection);
    });
}
```

---

## 5. Critical Dependencies on React Libraries

### 5.1 React PHP Dependencies

**From `composer.json` require section:**

```json
"react/socket": "^1.14",
"react/promise-timer": "^1.10",
"clue/redis-react": "^2.6"
```

### 5.2 Event Loop

**File:** `Http/Server.php`

```php
use React\EventLoop\Loop;
use React\EventLoop\LoopInterface;

protected function __construct(..., protected ?LoopInterface $loop = null) {
    $this->loop = $loop ?: Loop::get();  // Static accessor or injected instance
}

public function start(): void {
    try {
        $this->loop->run();  // Blocking call
    } catch (Throwable $e) {
        Log::error($e->getMessage());
    }
}

public function stop(): void {
    $this->loop->stop();
}
```

**Event Loop Usage Patterns:**
- `Loop::get()`: Get global event loop
- `$loop->run()`: Start blocking event loop
- `$loop->stop()`: Stop the loop
- `$loop->addPeriodicTimer($interval, $callback)`: Schedule recurring tasks
- `$loop->addTimer($interval, $callback)`: Schedule one-time task

### 5.3 Socket Server

**File:** `Factory.php` and `Http/Server.php`

```php
use React\Socket\SocketServer;
use React\Socket\ServerInterface;
use React\Socket\ConnectionInterface;

new SocketServer($uri, $options, $loop)
```

**React Socket Usage:**
- `SocketServer` implements `ServerInterface`
- Creates TCP listener on specified URI
- Emits 'connection' event with `ConnectionInterface` parameter
- Supports TLS through URI scheme and context options
- `ConnectionInterface` provides:
  - `write($data)`: Send bytes
  - `end()`: Graceful close
  - `close()`: Force close
  - `on($event, $callback)`: Event binding
  - `stream`: Underlying stream resource

### 5.4 Promise/Async Handling

**File:** `Http/Router.php`

```php
use React\Promise\PromiseInterface;

$response = $controller(...$this->arguments($controller, $routeParameters));

return $response instanceof PromiseInterface ?
    $response->then(fn ($response) => $connection->send($response)->close()) :
    $connection->send($response)->close();
```

**Promise Patterns:**
- Controllers may return `PromiseInterface`
- Chain `.then()` for async response handling
- Used for database queries, API calls, etc.

### 5.5 Redis React Client

**File:** `Publishing/RedisClientFactory.php`

```php
use Clue\React\Redis\Factory;

public function make(LoopInterface $loop, string $redisUrl): PromiseInterface {
    return (new Factory($loop))->createClient($redisUrl);
}
```

**Redis Integration:**
- `Clue\React\Redis\Factory` creates async Redis clients
- Returns Promise that resolves to Redis Client
- Used for Pub/Sub in distributed scenarios

### 5.6 Promise Timer

**From composer.json:**
```json
"react/promise-timer": "^1.10"
```

**Not directly used in core server code but available for extensions.**

---

## 6. Ratchet RFC6455 WebSocket Protocol

### 6.1 WebSocket Handshake

**File:** `Http/Router.php`

```php
use Ratchet\RFC6455\Handshake\RequestVerifier;
use Ratchet\RFC6455\Handshake\ServerNegotiator;

protected ServerNegotiator $negotiator;

public function __construct(protected UrlMatcherInterface $matcher) {
    $this->negotiator = new ServerNegotiator(
        new RequestVerifier,
        new HttpFactory  // GuzzleHttp HttpFactory
    );
}

protected function attemptUpgrade(RequestInterface $request, Connection $connection): ReverbConnection {
    $response = $this->negotiator->handshake($request)
        ->withHeader('X-Powered-By', 'Laravel Reverb');
    
    $connection->write(Message::toString($response));
    return new ReverbConnection($connection);
}
```

### 6.2 Frame Parsing and Handling

**File:** `Connection.php`

```php
use Ratchet\RFC6455\Messaging\CloseFrameChecker;
use Ratchet\RFC6455\Messaging\DataInterface;
use Ratchet\RFC6455\Messaging\Frame;
use Ratchet\RFC6455\Messaging\FrameInterface;
use Ratchet\RFC6455\Messaging\MessageBuffer;

public function openBuffer(): void {
    $this->buffer = new MessageBuffer(
        new CloseFrameChecker,
        maxMessagePayloadSize: $this->maxMessageSize,
        onMessage: $this->onMessage ?: fn () => null,
        onControl: fn (FrameInterface $message) => $this->control($message),
        sender: [$this->connection, 'send']
    );
    
    $this->connection->on('data', [$this->buffer, 'onData']);
    $this->connection->on('close', $this->onClose ?: fn () => null);
}
```

**Frame Types:**
```php
Frame::OP_CONTINUATION = 0x0
Frame::OP_TEXT = 0x1
Frame::OP_BINARY = 0x2
Frame::OP_CLOSE = 0x8
Frame::OP_PING = 0x9
Frame::OP_PONG = 0xA
```

### 6.3 Control Frame Handling

**File:** `Connection.php`

```php
public function control(FrameInterface $message): void {
    if ($this->onControl) {
        ($this->onControl)($message);
    }
    
    match ($message->getOpcode()) {
        Frame::OP_PING => $this->send(
            new Frame($message->getPayload(), opcode: Frame::OP_PONG)
        ),
        Frame::OP_PONG => fn () => null,
        Frame::OP_CLOSE => $this->close($message),
    };
}

public function close(mixed $message = null): void {
    if ($message) {
        $frame = $message instanceof FrameInterface ?
            $message :
            new Frame($message, opcode: Frame::OP_CLOSE);
        $this->send($frame);
    }
    
    $this->connection->close();
}
```

---

## 7. PubSub and Horizontal Scaling

### 7.1 PubSub Provider Interface

**File:** `Contracts/PubSubProvider.php`

```php
interface PubSubProvider {
    public function connect(LoopInterface $loop): void;
    public function disconnect(): void;
    public function subscribe(): void;
    public function on(string $event, callable $callback): void;
    public function publish(array $payload): PromiseInterface;
}
```

### 7.2 Redis PubSub Implementation

**File:** `Publishing/RedisPubSubProvider.php`

```php
public function connect(LoopInterface $loop): void {
    $this->publisher = new RedisPublishClient($loop, $this->clientFactory, $this->channel, $this->server);
    $this->subscriber = new RedisSubscribeClient(
        $loop, 
        $this->clientFactory, 
        $this->channel, 
        $this->server,
        fn () => $this->subscribe()
    );
    
    $this->publisher->connect();
    $this->subscriber->connect();
}

public function subscribe(): void {
    $this->subscriber->subscribe();
    $this->subscriber->on('message', function (string $channel, string $payload) {
        $this->messageHandler->handle($payload);
    });
}

public function publish(array $payload): PromiseInterface {
    return $this->publisher->publish($payload);
}
```

### 7.3 Redis Connection Management

**File:** `Publishing/RedisClient.php`

```php
public function connect(): void {
    $this->clientFactory->make($this->loop, $this->redisUrl())->then(
        fn (Client $client) => $this->onConnection($client),
        fn (Exception $exception) => $this->onFailedConnection($exception),
    );
}

protected function onConnection(Client $client): void {
    $this->client = $client;
    $this->resetRetryTimer();
    $this->configureClientErrorHandler();
    
    if ($this->onConnect) {
        call_user_func($this->onConnect, $client);
    }
    
    Log::info('Redis connection established', "<fg=green>{$this->name}</>");
}

public function reconnect(): void {
    if (! $this->shouldRetry) return;
    $this->loop->addTimer(1, fn () => $this->attemptReconnection());
}
```

**Reconnection Strategy:**
- Automatic retry with 1-second delay
- Timeout configurable per server config (default 60 seconds)
- Throws `RedisConnectionException` if timeout exceeded

---

## 8. Periodic Maintenance Tasks

### 8.1 Garbage Collection

**File:** `Http/Server.php`

```php
public function __construct(...) {
    gc_disable();  // Disable automatic collection
    $this->loop = $loop ?: Loop::get();
    
    // Collect cycles every 30 seconds
    $this->loop->addPeriodicTimer(30, fn () => gc_collect_cycles());
}
```

### 8.2 Stale Connection Pruning

**File:** `Console/Commands/StartServer.php`

```php
protected function ensureStaleConnectionsAreCleaned(LoopInterface $loop): void {
    $loop->addPeriodicTimer(60, function () {
        PruneStaleConnections::dispatch();
        PingInactiveConnections::dispatch();
    });
}
```

**Runs every 60 seconds:**
- Prunes connections that haven't been touched
- Pings inactive connections to detect dead sockets

### 8.3 Restart Signal Monitoring

**File:** `Console/Commands/StartServer.php`

```php
protected function ensureRestartCommandIsRespected(Server $server, LoopInterface $loop, string $host, string $port): void {
    $lastRestart = Cache::get('laravel:reverb:restart');
    
    $loop->addPeriodicTimer(5, function () use ($server, ...) {
        if ($lastRestart === Cache::get('laravel:reverb:restart')) {
            return;  // No restart signal
        }
        
        $this->gracefullyDisconnect();
        $server->stop();
    });
}
```

**Checks every 5 seconds for restart cache flag.**

### 8.4 Pulse and Telescope Integration

```php
protected function ensurePulseEventsAreCollected(LoopInterface $loop, int $interval): void {
    if (! $this->laravel->bound(\Laravel\Pulse\Pulse::class)) {
        return;
    }
    
    $loop->addPeriodicTimer($interval, function () {
        $this->laravel->make(\Laravel\Pulse\Pulse::class)->ingest();
    });
}

protected function ensureTelescopeEntriesAreCollected(LoopInterface $loop, int $interval): void {
    if (! $this->laravel->bound(\Laravel\Telescope\Contracts\EntriesRepository::class)) {
        return;
    }
    
    $loop->addPeriodicTimer($interval, function () {
        \Laravel\Telescope\Telescope::store(...);
    });
}
```

---

## 9. Key Dependencies Summary

### React PHP Core
- **react/socket:** TCP/TLS server, connection management
- **react/event-loop:** Event-driven architecture
- **react/promise-timer:** Async timer utilities

### WebSocket Protocol
- **ratchet/rfc6455:** RFC 6455 WebSocket handshake and frame parsing

### HTTP/PSR-7
- **guzzlehttp/psr7:** PSR-7 request/response parsing and generation

### Distributed Systems
- **clue/redis-react:** Async Redis client for PubSub

### Laravel Integration
- **illuminate/support, illuminate/console, illuminate/contracts**
- **symfony/routing:** URL routing and matching
- **symfony/http-foundation:** HTTP kernel compatibility

---

## 10. Bun.serve Equivalent Requirements

### Functional Requirements
1. **TCP Server Binding:** Accept connections on host:port with TLS support
2. **HTTP Parsing:** Parse HTTP headers and body incrementally with buffer limits
3. **WebSocket Upgrade:** Perform RFC 6455 handshake negotiation
4. **Frame Parsing:** Parse WebSocket frames with opcode routing
5. **Event Loop:** Non-blocking I/O with periodic task scheduling
6. **Redis Integration:** Async Redis Pub/Sub for horizontal scaling
7. **Signal Handling:** Graceful shutdown on SIGINT/SIGTERM
8. **Periodic Tasks:** Garbage collection, connection pruning, signal monitoring

### Architecture Patterns to Replicate
1. **Middleware/Handler Chain:** Router → Controller → Response
2. **Event Emitter Pattern:** Connections emit 'data', 'close' events
3. **Promise-based Async:** Async controller responses with `.then()` chaining
4. **Incremental Buffering:** Stream data into buffer until complete message
5. **Connection State Machine:** HTTP → WebSocket upgrade transition
6. **Lazy Handler Registration:** Handlers can be registered post-upgrade

### Performance Considerations
1. Garbage collection disabled by default, manual cycles every 30 seconds
2. Periodic timers for background tasks (not blocking event loop)
3. Connection pooling for Redis with automatic reconnection
4. Maximum request size limit to prevent memory exhaustion
5. Message size limits per connection

### Configuration Parameters
- Host and port binding
- TLS certificate and key paths
- Max request size (default 10,000 bytes)
- Max message size per connection (configurable per app)
- Redis connection timeout (default 60 seconds)
- Background task intervals (GC 30s, pruning 60s, restart check 5s)

---

## File Structure Reference

```
src/Servers/Reverb/
├── Connection.php                    # WebSocket connection wrapper
├── Factory.php                       # Server factory with protocol selection
├── RedisClientFactory.php            # Redis client instantiation
├── ReverbServerProvider.php          # Laravel service provider
│
├── Console/
│   └── Commands/
│       ├── StartServer.php           # Main entry point
│       └── RestartServer.php         # Graceful restart command
│
├── Http/
│   ├── Server.php                    # HTTP server main class
│   ├── Connection.php                # HTTP connection wrapper
│   ├── Request.php                   # HTTP request parsing
│   ├── Response.php                  # HTTP response (extends Symfony)
│   ├── Router.php                    # WebSocket upgrade + routing
│   └── Route.php                     # Route DSL
│
├── Concerns/
│   └── ClosesConnections.php         # Connection termination trait
│
├── Publishing/
│   ├── RedisPubSubProvider.php       # Main Redis integration
│   ├── RedisClient.php               # Base Redis client
│   ├── RedisPublishClient.php        # Publisher with queuing
│   ├── RedisSubscribeClient.php      # Subscriber
│   ├── RedisClientFactory.php        # Redis factory
│   └── RedisPubSubProvider.php       # Pub/Sub orchestrator
│
└── Contracts/
    ├── PubSubProvider.php            # Interface for pub/sub
    └── PubSubIncomingMessageHandler.php  # Message handler interface
```

