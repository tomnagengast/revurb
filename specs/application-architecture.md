# Application Architecture Documentation

## Overview

The Reverb application architecture implements a multi-tenant WebSocket server using a manager pattern to dynamically resolve applications. The system supports connection limits, origin validation, and flexible application provider implementations.

## Core Components

### 1. Application Class

**File**: `/src/Application.php`

Represents a single Reverb application instance with all its configuration and operational parameters.

```typescript
interface ApplicationConfig {
  id: string;
  key: string;
  secret: string;
  pingInterval: number;        // in seconds
  activityTimeout: number;      // in seconds, defaults to 30
  allowedOrigins: string[];
  maxMessageSize: number;       // max client message size in bytes
  maxConnections?: number;      // optional connection limit
  options?: Record<string, any>;
}

class Application {
  // Identity
  id(): string
  key(): string
  secret(): string

  // Health Management
  pingInterval(): number        // Heartbeat interval to detect stale connections
  activityTimeout(): number     // Timeout before connection deemed inactive

  // Resource Constraints
  maxConnections(): number | null
  hasMaxConnectionLimit(): boolean
  maxMessageSize(): number

  // Access Control
  allowedOrigins(): string[]

  // Configuration
  options(): Record<string, any> | null

  // Serialization
  toArray(): ApplicationConfig
}
```

**Key Features**:
- Immutable configuration (all properties are protected and read-only)
- Support for per-application connection quotas
- Support for per-application message size limits
- Flexible options dictionary for protocol-specific settings

### 2. ApplicationProvider Interface

**File**: `/src/Contracts/ApplicationProvider.php`

Defines the contract for application resolution strategies.

```typescript
interface ApplicationProvider {
  /**
   * Get all configured applications.
   * Used for admin/monitoring purposes.
   */
  all(): Collection<Application>

  /**
   * Find application by application ID.
   * @throws InvalidApplication
   */
  findById(id: string): Application

  /**
   * Find application by API key.
   * @throws InvalidApplication
   */
  findByKey(key: string): Application
}
```

**Purpose**: Enables pluggable application resolution, allowing different backend strategies (config files, database, API calls, etc.)

### 3. ConfigApplicationProvider

**File**: `/src/ConfigApplicationProvider.php`

Concrete implementation that resolves applications from Laravel configuration.

```typescript
class ConfigApplicationProvider implements ApplicationProvider {
  constructor(applications: Collection<ApplicationConfig>)

  all(): Collection<Application>
  findById(id: string): Application
  findByKey(key: string): Application
  find(key: string, value: any): Application
}
```

**Lookup Strategy**:
- Maintains in-memory collection of applications from config
- Lookups performed via collection filtering (linear search)
- Throws `InvalidApplication` exception if not found
- Creates Application instances on-demand

**Configuration Source**:
```php
config('reverb.apps.apps', [])  // Array of app configurations
```

### 4. ApplicationManager

**File**: `/src/ApplicationManager.php`

Service provider manager for dynamically resolving ApplicationProvider implementations.

```typescript
class ApplicationManager extends Manager {
  createConfigDriver(): ConfigApplicationProvider
  getDefaultDriver(): string
}
```

**Responsibility**:
- Extends Laravel's Manager pattern for driver management
- Creates and manages ApplicationProvider driver instances
- Resolves default driver from configuration: `config('reverb.apps.provider', 'config')`
- Supports multiple provider implementations through driver pattern

### 5. ApplicationManagerServiceProvider

**File**: `/src/ApplicationManagerServiceProvider.php`

Laravel service provider for dependency injection registration.

```typescript
class ApplicationManagerServiceProvider extends ServiceProvider, DeferrableProvider {
  register(): void {
    // Register singleton ApplicationManager
    app.singleton(ApplicationManager::class)

    // Bind interface to manager driver
    app.bind(
      ApplicationProvider::class,
      (app) => app.make(ApplicationManager::class).driver()
    )
  }

  provides(): string[] {
    return [ApplicationManager::class, ApplicationProvider::class]
  }
}
```

## Multi-Tenancy Support

### Application Isolation

Each connection is bound to exactly one Application instance at initialization:

```typescript
interface Connection {
  // Get the application this connection belongs to
  app(): Application

  // Timestamp of last activity
  lastSeenAt(): number | null
}
```

### Multi-Tenant Resolution Flow

```
HTTP Request (WebSocket upgrade)
  ↓
PusherController receives appKey from URL: /app/{appKey}
  ↓
ApplicationProvider.findByKey(appKey)
  ↓
Application instance created for connection
  ↓
Connection associated with Application
  ↓
All subsequent operations scoped to this Application
```

### Application Lifecycle

1. **Configuration Loading**: Applications loaded from provider at server startup or on-demand
2. **Connection Association**: Each connection associated with one Application via appKey lookup
3. **Isolation**: Connections to different applications never interact
4. **Resource Tracking**: Each application has independent connection count, channel management

## Connection Limits

### Architecture

Connection limits are implemented at the protocol layer in the Pusher Server.

```typescript
interface Application {
  maxConnections(): number | null
  hasMaxConnectionLimit(): boolean
}

class PusherServer {
  open(connection: Connection): void {
    this.ensureWithinConnectionLimit(connection)
    this.verifyOrigin(connection)
    // ... establish connection
  }

  protected ensureWithinConnectionLimit(connection: Connection): void {
    if (!connection.app().hasMaxConnectionLimit()) {
      return  // No limit configured
    }

    const appConnections = this.channels
      .for(connection.app())
      .connections()

    if (appConnections.length >= connection.app().maxConnections()) {
      throw new ConnectionLimitExceeded()  // Error code 4004
    }
  }
}
```

### Enforcement Points

1. **Connection Open**: Checked when WebSocket connection established
2. **Per-Application**: Each application has independent quota
3. **Error Response**: Returns Pusher error code 4004 if exceeded
4. **Shared Pool**: Connection count includes all connections to single app across all servers (if scaling enabled)

### Configuration

```php
// config/reverb.php
'apps' => [
  [
    'app_id' => env('REVERB_APP_ID'),
    'key' => env('REVERB_APP_KEY'),
    'secret' => env('REVERB_APP_SECRET'),
    'max_connections' => env('REVERB_APP_MAX_CONNECTIONS'), // null = unlimited
    // ...
  ]
]
```

## Origin Validation

### Architecture

Origin validation prevents cross-origin WebSocket connections not in the allowlist.

```typescript
interface Application {
  allowedOrigins(): string[]  // e.g., ['*.example.com', 'localhost']
}

class PusherServer {
  open(connection: Connection): void {
    this.ensureWithinConnectionLimit(connection)
    this.verifyOrigin(connection)  // ← Validation check
    // ... establish connection
  }

  protected verifyOrigin(connection: Connection): void {
    const allowedOrigins = connection.app().allowedOrigins()

    // Wildcard allows all origins
    if (allowedOrigins.includes('*')) {
      return
    }

    // Extract host from origin header
    const origin = parse_url(connection.origin(), PHP_URL_HOST)

    // Check against allowed origins using glob patterns
    for (const allowedOrigin of allowedOrigins) {
      if (Str.is(allowedOrigin, origin)) {
        return  // Match found
      }
    }

    throw new InvalidOrigin()  // Error code 4009
  }
}
```

### Validation Flow

1. **Read Origin Header**: From WebSocket upgrade request headers
2. **Extract Host**: Parse domain from full URL
3. **Pattern Matching**: Support glob patterns (e.g., `*.example.com`)
4. **Wildcard Support**: `*` allows all origins
5. **Error Response**: Returns Pusher error code 4009 if validation fails

### Exception Hierarchy

```typescript
class PusherException extends Exception {
  code: number
  message: string
}

class InvalidOrigin extends PusherException {
  code = 4009
  message = 'Origin not allowed'
}

class ConnectionLimitExceeded extends PusherException {
  code = 4004
  message = 'Application is over connection quota'
}
```

### Configuration

```php
// config/reverb.php
'apps' => [
  [
    'allowed_origins' => [
      '*',                          // Allow all origins
      '*.example.com',             // Glob pattern
      'localhost',                 // Exact match
    ],
    // ...
  ]
]
```

## Application Provider Interface

### Contract Definition

```typescript
interface ApplicationProvider {
  all(): Collection<Application>
  findById(id: string): Application
  findByKey(key: string): Application
}
```

### Implementation Pattern

Any class can implement ApplicationProvider by:
1. Implementing required methods
2. Registering with service container
3. Configuring as driver in ApplicationManager

### Provider Registration

```typescript
// In ApplicationManagerServiceProvider
app.bind(
  ApplicationProvider::class,
  (app) => app.make(ApplicationManager::class).driver()
)

// ApplicationManager uses configured driver
public getDefaultDriver(): string {
  return config('reverb.apps.provider', 'config')
}
```

### Extension Points

To add custom provider (e.g., database-backed):

```typescript
class DatabaseApplicationProvider implements ApplicationProvider {
  all(): Collection<Application> {
    return db.table('applications')
      .get()
      .map(this.toApplicationInstance)
  }

  findById(id: string): Application {
    const config = db.table('applications').find('app_id', id)
    if (!config) throw new InvalidApplication()
    return this.toApplicationInstance(config)
  }

  findByKey(key: string): Application {
    const config = db.table('applications').find('key', key)
    if (!config) throw new InvalidApplication()
    return this.toApplicationInstance(config)
  }

  protected toApplicationInstance(config: any): Application {
    return new Application(
      config.app_id,
      config.key,
      config.secret,
      config.ping_interval,
      config.activity_timeout,
      config.allowed_origins.split(','),
      config.max_message_size,
      config.max_connections,
      config.options
    )
  }
}

// Register in service provider
app.make(ApplicationManager::class).extend(
  'database',
  () => new DatabaseApplicationProvider()
)

// Set as default in config
'apps' => [
  'provider' => 'database',
  // ...
]
```

## TypeScript Implementation Guide

### Type Definitions

```typescript
// Type: Application configuration from config files
type ApplicationConfig = {
  app_id: string;
  key: string;
  secret: string;
  ping_interval: number;
  activity_timeout?: number;
  allowed_origins: string[];
  max_message_size: number;
  max_connections?: number | null;
  options?: Record<string, any>;
};

// Class: Immutable application instance
class Application {
  private id: string;
  private key: string;
  private secret: string;
  private pingInterval: number;
  private activityTimeout: number;
  private allowedOrigins: string[];
  private maxMessageSize: number;
  private maxConnections: number | null;
  private options: Record<string, any>;

  constructor(config: ApplicationConfig) {
    this.id = config.app_id;
    this.key = config.key;
    this.secret = config.secret;
    this.pingInterval = config.ping_interval;
    this.activityTimeout = config.activity_timeout ?? 30;
    this.allowedOrigins = config.allowed_origins;
    this.maxMessageSize = config.max_message_size;
    this.maxConnections = config.max_connections ?? null;
    this.options = config.options ?? {};
  }

  getId(): string { return this.id; }
  getKey(): string { return this.key; }
  getSecret(): string { return this.secret; }
  getPingInterval(): number { return this.pingInterval; }
  getActivityTimeout(): number { return this.activityTimeout; }
  getAllowedOrigins(): string[] { return this.allowedOrigins; }
  getMaxMessageSize(): number { return this.maxMessageSize; }
  getMaxConnections(): number | null { return this.maxConnections; }
  hasMaxConnectionLimit(): boolean { return this.maxConnections !== null; }
  getOptions(): Record<string, any> { return this.options; }

  toJSON(): ApplicationConfig {
    return {
      app_id: this.id,
      key: this.key,
      secret: this.secret,
      ping_interval: this.pingInterval,
      activity_timeout: this.activityTimeout,
      allowed_origins: this.allowedOrigins,
      max_message_size: this.maxMessageSize,
      max_connections: this.maxConnections,
      options: this.options,
    };
  }
}

// Interface: Application provider contract
interface IApplicationProvider {
  all(): Promise<Application[]>;
  findById(id: string): Promise<Application>;
  findByKey(key: string): Promise<Application>;
}

// Class: Configuration-based provider
class ConfigApplicationProvider implements IApplicationProvider {
  constructor(private applications: Application[]) {}

  async all(): Promise<Application[]> {
    return this.applications;
  }

  async findById(id: string): Promise<Application> {
    return this.find('id', id);
  }

  async findByKey(key: string): Promise<Application> {
    return this.find('key', key);
  }

  private async find(prop: keyof Application, value: any): Promise<Application> {
    const app = this.applications.find(
      (app: any) => app[prop === 'id' ? 'getId' : 'getKey']?.() === value
    );
    if (!app) {
      throw new InvalidApplicationError(`Application not found: ${prop}=${value}`);
    }
    return app;
  }
}

// Exception types
class InvalidApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidApplicationError';
  }
}

class InvalidOriginError extends Error {
  code = 4009;
  constructor() {
    super('Origin not allowed');
    this.name = 'InvalidOriginError';
  }
}

class ConnectionLimitExceededError extends Error {
  code = 4004;
  constructor() {
    super('Application is over connection quota');
    this.name = 'ConnectionLimitExceededError';
  }
}

// Class: Application manager
class ApplicationManager {
  private providers: Map<string, IApplicationProvider> = new Map();
  private defaultProvider: string = 'config';

  register(name: string, provider: IApplicationProvider): void {
    this.providers.set(name, provider);
  }

  setDefault(name: string): void {
    this.defaultProvider = name;
  }

  driver(name?: string): IApplicationProvider {
    const providerName = name ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider "${providerName}" not registered`);
    }
    return provider;
  }
}
```

### Connection Limit Enforcement

```typescript
interface IConnection {
  getApp(): Application;
  getOrigin(): string | null;
  getId(): string;
}

class PusherServer {
  constructor(
    private channelManager: IChannelManager,
    private eventHandler: IEventHandler
  ) {}

  open(connection: IConnection): void {
    try {
      this.ensureWithinConnectionLimit(connection);
      this.verifyOrigin(connection);
      // Establish connection
      this.eventHandler.handle(connection, 'pusher:connection_established');
    } catch (error) {
      this.error(connection, error);
    }
  }

  private ensureWithinConnectionLimit(connection: IConnection): void {
    const app = connection.getApp();

    if (!app.hasMaxConnectionLimit()) {
      return; // No limit configured
    }

    const connections = this.channelManager
      .for(app)
      .getConnections();

    if (connections.length >= app.getMaxConnections()!) {
      throw new ConnectionLimitExceededError();
    }
  }

  private verifyOrigin(connection: IConnection): void {
    const allowedOrigins = connection.getApp().getAllowedOrigins();

    // Wildcard allows all origins
    if (allowedOrigins.includes('*')) {
      return;
    }

    // Extract host from origin
    const origin = connection.getOrigin();
    if (!origin) {
      throw new InvalidOriginError();
    }

    const host = new URL(origin).hostname;

    // Check against allowed origins using glob patterns
    for (const allowedOrigin of allowedOrigins) {
      if (this.isMatch(host, allowedOrigin)) {
        return; // Match found
      }
    }

    throw new InvalidOriginError();
  }

  private isMatch(host: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
    );
    return regex.test(host);
  }

  private error(connection: IConnection, error: Error): void {
    if (error instanceof InvalidOriginError || error instanceof ConnectionLimitExceededError) {
      connection.send(JSON.stringify({
        event: 'pusher:error',
        data: JSON.stringify({
          code: (error as any).code,
          message: error.message,
        }),
      }));
    } else {
      connection.send(JSON.stringify({
        event: 'pusher:error',
        data: JSON.stringify({
          code: 4200,
          message: 'Invalid message format',
        }),
      }));
    }
  }
}
```

## Data Flow Diagrams

### Application Resolution on Connection

```
WebSocket Upgrade Request
    ↓
Extract appKey from URL path: /app/{appKey}
    ↓
ApplicationProvider.findByKey(appKey)
    ↓
Look up in configuration
    ↓
Found? → Create Application instance
Not found? → Throw InvalidApplication exception
    ↓
Return Application instance to connection handler
    ↓
Proceed with origin validation and connection limit checks
```

### Connection Establishment Sequence

```
Client initiates WebSocket connection
    ↓
Server.open(connection) called
    ↓
ensureWithinConnectionLimit(connection)
├─ If no limit: continue
├─ If limit set:
│  ├─ Get current connection count for app
│  ├─ If count >= limit: throw ConnectionLimitExceeded (4004)
│  └─ If count < limit: continue
    ↓
verifyOrigin(connection)
├─ If '*' in allowedOrigins: accept
├─ Extract host from origin header
├─ For each allowed origin:
│  ├─ If glob pattern matches: accept
│  └─ Continue to next pattern
├─ If no matches: throw InvalidOrigin (4009)
    ↓
touch() - update activity timestamp
    ↓
EventHandler.handle(connection, 'pusher:connection_established')
    ↓
Connection ready for messages
```

## Configuration Schema

```typescript
type ReverbConfig = {
  default: string;
  servers: {
    reverb: {
      host: string;
      port: number;
      path: string;
      hostname?: string;
      options: {
        tls: Record<string, any>;
      };
      max_request_size: number;
      scaling: {
        enabled: boolean;
        channel: string;
        server: {
          url?: string;
          host: string;
          port: string;
          username?: string;
          password?: string;
          database: string;
          timeout: number;
        };
      };
      pulse_ingest_interval: number;
      telescope_ingest_interval: number;
    };
  };
  apps: {
    provider: string; // 'config' | custom provider name
    apps: ApplicationConfig[];
  };
};
```

## Error Handling

### Exception Hierarchy

```
Exception
├── PusherException
│   ├── InvalidOrigin (code: 4009)
│   ├── ConnectionLimitExceeded (code: 4004)
│   └── ConnectionUnauthorized (code: 4001)
└── InvalidApplication (generic application not found)
```

### Error Response Format

```json
{
  "event": "pusher:error",
  "data": "{\"code\": 4009, \"message\": \"Origin not allowed\"}"
}
```

## Summary

The application architecture provides:

1. **Multi-Tenancy**: Multiple independent applications per server via ApplicationProvider pattern
2. **Flexible Resolution**: Pluggable provider implementations (config, database, API, etc.)
3. **Resource Management**: Per-application connection quotas and message size limits
4. **Security**: Origin validation with glob pattern matching
5. **Extensibility**: Service provider pattern for registering custom providers
6. **Isolation**: Complete isolation between applications at connection level
