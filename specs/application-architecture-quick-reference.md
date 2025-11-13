# Application Architecture - Quick Reference

## Component Overview

| Component | File | Purpose | Key Methods |
|-----------|------|---------|-------------|
| **Application** | `src/Application.php` | Immutable config value object | `id()`, `key()`, `secret()`, `maxConnections()`, `allowedOrigins()` |
| **ApplicationProvider** | `src/Contracts/ApplicationProvider.php` | Interface for app resolution | `all()`, `findById()`, `findByKey()` |
| **ConfigApplicationProvider** | `src/ConfigApplicationProvider.php` | Config-based resolver (default) | Implements ApplicationProvider |
| **ApplicationManager** | `src/ApplicationManager.php` | Manager pattern driver | `createConfigDriver()`, `getDefaultDriver()` |
| **ApplicationManagerServiceProvider** | `src/ApplicationManagerServiceProvider.php` | DI registration | `register()`, `provides()` |
| **PusherServer** | `src/Protocols/Pusher/Server.php` | WebSocket protocol handler | `open()`, `verifyOrigin()`, `ensureWithinConnectionLimit()` |

## Multi-Tenancy Model

```
Single Reverb Server Instance
    ↓
Multiple Applications (via config)
    ↓
Each Connection → Bound to ONE Application
    ↓
Complete Isolation
    ├─ Separate channel management
    ├─ Separate connection tracking
    ├─ Separate message processing
    └─ Independent quotas
```

## Connection Limits

**Enforcement**: `PusherServer.ensureWithinConnectionLimit()`
- Per-application quota
- Checked during `open()` (connection establishment)
- Optional (null = no limit)
- Error code: 4004

**Configuration**:
```php
'max_connections' => env('REVERB_APP_MAX_CONNECTIONS')  // null = unlimited
```

## Origin Validation

**Enforcement**: `PusherServer.verifyOrigin()`
- Per-application allowlist
- Checked during `open()` (connection establishment)
- Supports glob patterns: `*.example.com`, exact matches: `localhost`, wildcard: `*`
- Error code: 4009

**Configuration**:
```php
'allowed_origins' => ['*']  // or ['*.example.com', 'localhost']
```

## Application Resolution Flow

```
1. Extract appKey from URL: /app/{appKey}
2. Call ApplicationProvider.findByKey(appKey)
3. Look up in configured applications
4. Create/return Application instance
5. Associate with connection
6. Validation: ensureWithinConnectionLimit()
7. Validation: verifyOrigin()
8. Establish connection
```

## Error Codes

| Code | Error | Thrown By |
|------|-------|-----------|
| 4004 | Connection Limit Exceeded | `ensureWithinConnectionLimit()` |
| 4009 | Origin Not Allowed | `verifyOrigin()` |
| 4001 | Connection Unauthorized | (auth validation) |
| 4200 | Invalid Message Format | (fallback error) |

## Configuration Structure

```php
// Location: config/reverb.php

'apps' => [
    'provider' => 'config',  // Driver: 'config' (default) or custom
    
    'apps' => [
        [
            'app_id' => env('REVERB_APP_ID'),
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'ping_interval' => 60,                    // seconds
            'activity_timeout' => 30,                 // seconds
            'allowed_origins' => ['*'],               // array of patterns
            'max_message_size' => 10_000,             // bytes
            'max_connections' => null,                // null = unlimited
            'options' => [ /* protocol-specific */ ],
        ],
    ],
]
```

## Key Design Patterns

| Pattern | Component | Usage |
|---------|-----------|-------|
| Value Object | Application | Immutable configuration |
| Manager | ApplicationManager | Driver/strategy management |
| Provider | ApplicationProvider | Pluggable implementations |
| Dependency Injection | ApplicationManagerServiceProvider | Container management |
| Chain of Responsibility | Connection validation | Chained checks with early exit |

## TypeScript Equivalents

| PHP | TypeScript |
|-----|----------|
| `class Application` | `class Application` (immutable private fields) |
| `interface ApplicationProvider` | `interface IApplicationProvider` |
| `ConfigApplicationProvider` | `class ConfigApplicationProvider implements IApplicationProvider` |
| `ApplicationManager extends Manager` | `class ApplicationManager { private providers: Map<string, IApplicationProvider> }` |
| `throw new InvalidOrigin` | `throw new InvalidOriginError()` |
| `throw new ConnectionLimitExceeded` | `throw new ConnectionLimitExceededError()` |

## Extending with Custom Provider

**Example**: Database-backed provider

```php
<?php

namespace App\Reverb;

use Illuminate\Support\Collection;
use Laravel\Reverb\Application;
use Laravel\Reverb\Contracts\ApplicationProvider;

class DatabaseApplicationProvider implements ApplicationProvider
{
    public function all(): Collection
    {
        return DB::table('applications')
            ->get()
            ->map(fn ($config) => $this->toApplication($config));
    }

    public function findById(string $id): Application
    {
        $config = DB::table('applications')->find($id);
        return $this->toApplication($config);
    }

    public function findByKey(string $key): Application
    {
        $config = DB::table('applications')
            ->where('key', $key)
            ->first();
        return $this->toApplication($config);
    }

    private function toApplication(object $config): Application
    {
        return new Application(
            id: $config->app_id,
            key: $config->key,
            secret: $config->secret,
            pingInterval: $config->ping_interval,
            activityTimeout: $config->activity_timeout ?? 30,
            allowedOrigins: json_decode($config->allowed_origins, true),
            maxMessageSize: $config->max_message_size,
            maxConnections: $config->max_connections,
            options: json_decode($config->options, true),
        );
    }
}

// Register in config/reverb.php:
// 'provider' => 'database'
```

## Common Operations

### Check Connection Limit
```php
if ($app->hasMaxConnectionLimit()) {
    $remaining = $app->maxConnections() - $currentCount;
}
```

### Validate Origin
```php
$allowedOrigins = $app->allowedOrigins();
if (in_array('*', $allowedOrigins)) {
    // Allow all
} else {
    // Check against patterns
}
```

### Get Application by Key
```php
$app = app(ApplicationProvider::class)->findByKey('app-key');
```

### Iterate All Applications
```php
app(ApplicationProvider::class)->all()
    ->each(fn ($app) => /* process */);
```

## Files to Modify for TypeScript Port

Priority order for porting:

1. **High Priority** (Core logic)
   - `/src/Application.php` → Immutable class
   - `/src/Contracts/ApplicationProvider.php` → Interface
   - `/src/ConfigApplicationProvider.php` → Implementation

2. **Medium Priority** (Integration)
   - `/src/ApplicationManager.php` → Driver registry
   - `/src/Protocols/Pusher/Server.php` → Connection validation
   - Exception classes → Error classes

3. **Low Priority** (Infrastructure)
   - `/src/ApplicationManagerServiceProvider.php` → Dependency registration

## Testing Patterns

**Test Implementation**: `/tests/FakeApplicationProvider.php`

```php
class FakeApplicationProvider implements ApplicationProvider
{
    public function all(): Collection { /* ... */ }
    public function findById(string $id): Application { /* ... */ }
    public function findByKey(string $key): Application { /* ... */ }
}

// Usage
$provider = new FakeApplicationProvider();
$app = $provider->findByKey('test-key');
```

## Performance Considerations

1. **Application Lookup**: O(n) linear search in ConfigApplicationProvider
   - Can be optimized with caching
   - Custom providers can implement indexed lookups

2. **Origin Validation**: O(m) where m = number of allowed origins
   - Each pattern uses glob matching
   - Typically small number of origins per app

3. **Connection Count**: O(1) lookup in ChannelManager
   - Maintains in-memory connection registry

## Security Considerations

1. **Origin Validation**: Prevents unauthorized cross-origin connections
2. **Connection Limits**: Prevents resource exhaustion DoS
3. **Immutable Application**: Prevents runtime configuration modification
4. **Per-app Isolation**: Prevents connection interference between apps
