# Application Architecture Analysis - Summary

## Analysis Results

### 1. Application Structure and Configuration

**Core Class**: `Application` (immutable value object)
- Stores application identity (id, key, secret)
- Manages health parameters (ping interval, activity timeout)
- Defines resource constraints (max connections, max message size)
- Stores access control rules (allowed origins)
- Supports flexible options dictionary

**Key Insight**: The Application class is fully immutable - all properties are protected and read-only. This ensures configuration consistency across the connection lifecycle.

### 2. Multi-Tenancy Support

**Architecture**: Manager pattern with pluggable provider implementations

**Resolution Flow**:
```
Connection Request → Extract appKey from URL
                  → ApplicationProvider.findByKey(appKey)
                  → Create/retrieve Application instance
                  → Bind connection to Application
                  → All operations scoped to this Application
```

**Isolation Level**:
- Complete isolation at connection level
- Each connection associated with exactly one Application
- Separate channel management per application
- Independent connection tracking per application

**Key Files**:
- `/src/Application.php` - Value object
- `/src/ApplicationManager.php` - Manager/factory pattern
- `/src/ConfigApplicationProvider.php` - Config-based resolution
- `/src/Contracts/ApplicationProvider.php` - Extension interface
- `/src/ApplicationManagerServiceProvider.php` - DI registration

### 3. Connection Limits and Origin Validation

**Connection Limits**:

Enforcement happens in `PusherServer.open()`:
```
1. ensureWithinConnectionLimit(connection) is called first
2. If app has maxConnections configured:
   - Get current connection count for this app
   - Compare against quota
   - If at limit: throw ConnectionLimitExceeded (error code 4004)
3. If no limit configured: proceed
```

Per-application independent quotas - allows different rate limits per app.

**Origin Validation**:

Validation happens in `PusherServer.verifyOrigin()`:
```
1. Get allowedOrigins from Application config
2. If '*' in list: accept all origins
3. Parse origin header to extract hostname
4. For each allowed origin:
   - Apply glob pattern matching (supports wildcards)
   - If matches: accept and return
5. If no matches: throw InvalidOrigin (error code 4009)
```

Supports glob patterns (e.g., `*.example.com`, `localhost`).

**Exception Hierarchy**:
```
PusherException (base)
├── InvalidOrigin (code: 4009)
├── ConnectionLimitExceeded (code: 4004)
└── ConnectionUnauthorized (code: 4001)
```

### 4. Application Provider Interface

**Contract** (`ApplicationProvider` interface):
```typescript
interface ApplicationProvider {
  all(): Collection<Application>        // Admin/monitoring
  findById(id: string): Application     // By application ID
  findByKey(key: string): Application   // By API key (main usage)
}
```

**Implementations**:
1. **ConfigApplicationProvider** (default)
   - Loads from `config/reverb.php` → `apps.apps` array
   - Linear search on lookups
   - On-demand Application instance creation

2. **Custom implementations** (extensible)
   - DatabaseApplicationProvider (example in docs)
   - ApiApplicationProvider (hypothetical)
   - CacheApplicationProvider (hypothetical)

**Registration Pattern** (Laravel service container):
```
ApplicationManager (singleton)
  ↓
Resolves configured driver (default: 'config')
  ↓
ApplicationProvider interface bound to driver
  ↓
Injected into PusherServer and controllers
```

## Configuration Schema

**Location**: `config/reverb.php`

**Applications Config Section**:
```php
'apps' => [
    'provider' => 'config',  // Can be: 'config', custom provider name
    'apps' => [
        [
            'app_id' => env('REVERB_APP_ID'),
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'ping_interval' => env('REVERB_APP_PING_INTERVAL', 60),       // seconds
            'activity_timeout' => env('REVERB_APP_ACTIVITY_TIMEOUT', 30),  // seconds
            'allowed_origins' => ['*'],  // or specific domains/patterns
            'max_message_size' => env('REVERB_APP_MAX_MESSAGE_SIZE', 10_000),  // bytes
            'max_connections' => env('REVERB_APP_MAX_CONNECTIONS'),  // null = unlimited
            'options' => [  // Protocol-specific options
                'host' => env('REVERB_HOST'),
                'port' => env('REVERB_PORT', 443),
                'scheme' => env('REVERB_SCHEME', 'https'),
                'useTLS' => env('REVERB_SCHEME', 'https') === 'https',
            ],
        ],
    ],
],
```

## Connection Lifecycle

```
1. WebSocket Upgrade Request
   - Client initiates WebSocket connection
   - Request includes appKey in URL path

2. Application Resolution
   - ApplicationProvider.findByKey(appKey)
   - Application instance retrieved or created
   - Connection bound to Application

3. Validation Phase
   - ensureWithinConnectionLimit()
   - verifyOrigin()
   - Both can throw exceptions with specific error codes

4. Establishment
   - touch() called to set lastSeenAt timestamp
   - EventHandler.handle(..., 'pusher:connection_established')

5. Active Phase
   - Message handling with per-application isolation
   - Ping/pong tracking for stale connection detection
   - Activity timeout tracking

6. Termination
   - Unsubscribe from all channels
   - Close connection
   - Cleanup connection tracking
```

## Key Design Patterns

1. **Value Object Pattern** (Application)
   - Immutable configuration encapsulation
   - No business logic, only data + accessors

2. **Manager Pattern** (ApplicationManager)
   - Extends Laravel's Manager base class
   - Implements driver pattern for provider resolution

3. **Provider Pattern** (ApplicationProvider interface)
   - Interface segregation for implementation flexibility
   - Strategy pattern for application resolution

4. **Dependency Injection** (Service Provider)
   - Container-managed singletons
   - Interface binding to concrete implementations
   - Deferred service provider (only loaded when used)

5. **Chain of Responsibility** (Connection Validation)
   - ensureWithinConnectionLimit → verifyOrigin → EventHandler
   - Each step can throw exception
   - Proper error handling at each level

## Extension Points

### Adding Custom Application Provider

1. Implement `ApplicationProvider` interface
2. Create instances of Application with proper config
3. Register with ApplicationManager
4. Set as default in config

### Per-Application Configuration

Each application can have:
- Independent connection limits (or unlimited)
- Independent origin allowlists
- Different ping intervals
- Different activity timeouts
- Different message size limits
- Custom options dictionary

### Error Handling

Protocol errors use Pusher standard error codes:
- 4004: Connection Limit Exceeded
- 4009: Origin Not Allowed
- 4200: Invalid message format (fallback)

## Files Analyzed

1. `/src/Application.php` - 125 lines
2. `/src/ApplicationManager.php` - 27 lines
3. `/src/ConfigApplicationProvider.php` - 77 lines
4. `/src/Contracts/ApplicationProvider.php` - 31 lines
5. `/src/ApplicationManagerServiceProvider.php` - 34 lines
6. `/src/Protocols/Pusher/Server.php` - 179 lines (origin validation + connection limits)
7. `/src/Contracts/Connection.php` - 169 lines (connection contract)
8. `/src/Connection.php` - 70 lines (concrete implementation)
9. `/src/Exceptions/InvalidOrigin.php` - 16 lines
10. `/src/Protocols/Pusher/Exceptions/InvalidOrigin.php` - 21 lines
11. `/src/Protocols/Pusher/Exceptions/ConnectionLimitExceeded.php` - 21 lines
12. `/config/reverb.php` - 95 lines (configuration schema)
13. `/tests/FakeApplicationProvider.php` - 63 lines (test implementation)

## TypeScript Implementation Considerations

When porting to TypeScript:

1. **Application** → Immutable class with private fields
2. **ApplicationProvider** → Interface with Promise-based async methods
3. **ConfigApplicationProvider** → Implement interface with generic arrays
4. **ApplicationManager** → Map-based driver registry
5. **Error Classes** → Extend Error with code property
6. **Connection Limits** → Check in server.open() before accepting
7. **Origin Validation** → Use URL API and glob pattern matching
8. **Configuration** → Type-safe configuration objects

