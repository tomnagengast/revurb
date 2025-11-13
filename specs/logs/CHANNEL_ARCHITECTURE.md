# Pusher Channel Architecture Documentation

## Overview

The Pusher Channels system in Reverb implements a channel-based pub/sub architecture with support for different channel types, authentication, presence tracking, and caching capabilities. This document provides a comprehensive analysis of the channel architecture for TypeScript development reference.

---

## 1. Channel Type Hierarchy

### 1.1 Channel Type Classification

The channel system implements a **factory pattern** with a hierarchical inheritance structure:

```
Channel (Base)
├── PrivateChannel (extends Channel, uses InteractsWithPrivateChannels)
│   ├── PresenceChannel (extends PrivateChannel, uses InteractsWithPresenceChannels)
│   └── PrivateCacheChannel (extends CacheChannel, uses InteractsWithPrivateChannels)
├── CacheChannel (extends Channel)
│   └── PresenceCacheChannel (extends CacheChannel, uses InteractsWithPresenceChannels)
└── Public Channel (extends Channel)
```

### 1.2 Channel Type Identification

Channel types are determined by their **prefix matching** in the ChannelBroker:

| Channel Type | Prefix Pattern | Factory Rule | Priority |
|---|---|---|---|
| PrivateCacheChannel | `private-cache-` | `new PrivateCacheChannel($name)` | 1 (Highest) |
| PresenceCacheChannel | `presence-cache-` | `new PresenceCacheChannel($name)` | 2 |
| CacheChannel | `cache` | `new CacheChannel($name)` | 3 |
| PrivateChannel | `private` | `new PrivateChannel($name)` | 4 |
| PresenceChannel | `presence` | `new PresenceChannel($name)` | 5 |
| Public Channel | (no prefix) | `new Channel($name)` | 6 (Lowest) |

**Key Point**: Priority matters! `private-cache-` is checked before `private`, allowing specificity.

**File Location**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Channels/ChannelBroker.php`

### 1.3 Channel Type Characteristics

#### Public Channel
- **File**: `Channel.php`
- **Authentication**: None required
- **Visibility**: All connections see all events
- **Use Cases**: Public broadcasts, notifications
- **Special Features**: None

#### Private Channel
- **File**: `PrivateChannel.php`
- **Trait**: `InteractsWithPrivateChannels`
- **Authentication**: HMAC-SHA256 signature verification required
- **Signature Format**: `{connection_id}:{channel_name}:{optional_channel_data}`
- **Visibility**: Only authenticated subscribers receive events
- **Use Cases**: User-specific data, sensitive information
- **Validation**: Uses app secret for cryptographic verification

#### Presence Channel
- **File**: `PresenceChannel.php`
- **Extends**: `PrivateChannel`
- **Traits**: `InteractsWithPresenceChannels` + `InteractsWithPrivateChannels`
- **Authentication**: Private channel authentication applies
- **Special Behavior**: 
  - Tracks user membership
  - Emits `member_added` and `member_removed` events
  - Returns presence data on subscription
  - Deduplicates by `user_id`
- **Data Structure**: `{ user_id, user_info }`
- **Use Cases**: User lists, online status, collaborative features

#### Cache Channel
- **File**: `CacheChannel.php`
- **Extends**: `Channel`
- **Special Behavior**:
  - Stores last broadcast payload in memory
  - Returns cached payload to new subscribers
  - Does NOT cache internal broadcasts (`broadcastInternally`)
  - Serves as LRU cache in-memory
- **Use Cases**: Latest state recovery, subscriber catch-up
- **Distinction**: Caches external events only, not internal member events

#### Private Cache Channel
- **File**: `PrivateCacheChannel.php`
- **Combines**: `CacheChannel` + Private authentication
- **Extends**: `CacheChannel`
- **Traits**: `InteractsWithPrivateChannels`
- **Use Cases**: Authenticated state caching, private data recovery

#### Presence Cache Channel
- **File**: `PresenceCacheChannel.php`
- **Combines**: `CacheChannel` + Presence membership + Private authentication
- **Extends**: `CacheChannel`
- **Traits**: `InteractsWithPresenceChannels`
- **Use Cases**: Presence tracking with state caching

---

## 2. Channel Broker Factory Logic

### 2.1 Factory Pattern Implementation

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Channels/ChannelBroker.php`

```typescript
// TypeScript equivalent
class ChannelBroker {
  static create(name: string): Channel {
    return match(true) {
      case name.startsWith('private-cache-'): new PrivateCacheChannel(name),
      case name.startsWith('presence-cache-'): new PresenceCacheChannel(name),
      case name.startsWith('cache'): new CacheChannel(name),
      case name.startsWith('private'): new PrivateChannel(name),
      case name.startsWith('presence'): new PresenceChannel(name),
      default: new Channel(name),
    }
  }
}
```

### 2.2 Factory Logic Details

1. **Pattern Matching**: Uses `Illuminate\Support\Str::startsWith()` for prefix checking
2. **Order Matters**: Checked in descending specificity (most specific first)
3. **Prefix Evaluation**: 
   - `private-cache-` checked before `private` (prevents false matches)
   - `presence-cache-` checked before `presence` (prevents false matches)
   - `cache` checked before `private` and `presence` (generic prefix)
4. **Default**: Public `Channel` when no prefix matches
5. **Integration**: Called by `ArrayChannelManager::findOrCreate()`

### 2.3 Channel Instantiation

All channel types are instantiated with the **channel name**:
- Constructor: `__construct(protected string $name)`
- Each channel initializes its own `ChannelConnectionManager` via service container
- Uses: `app(ChannelConnectionManager::class)->for($this->name)`

---

## 3. Subscription & Unsubscription Flows

### 3.1 Subscription Flow

**Sequence**:

```
EventHandler::subscribe()
  ↓
Validator (channel, auth, channel_data JSON)
  ↓
ChannelManager->findOrCreate(channel_name)
  ↓
ChannelBroker::create() [if not exists]
  ↓
Channel::subscribe(connection, auth, channel_data)
  ↓
[For Private/Presence Channels]
  InteractsWithPrivateChannels::verify()
    ↓ Verify HMAC-SHA256 signature
    ↓
  [For Presence Channels Only]
    InteractsWithPresenceChannels::subscribe()
      ↓ Check if user already subscribed
      ↓ Broadcast member_added (if new user)
  ↓
ChannelConnectionManager->add(connection, data)
  ↓
afterSubscribe()
  ↓ Send subscription_succeeded to client
  ↓ [For CacheChannels] Send cached payload or cache_miss
```

### 3.2 Subscription Validation

**Private/Presence Channel Authentication**:

```typescript
// Signature verification pseudo-code
signature = `${connection.id()}:${channel.name()}:${channel_data}`
expected = HMAC-SHA256(signature, app.secret())

if (actual_auth_token !== expected) {
  throw new ConnectionUnauthorized()
}
```

**File**: `InteractsWithPrivateChannels.php`, `verify()` method

Parameters:
- `connection`: The WebSocket connection object
- `auth`: Client-provided authentication token (format: `key:hash`)
- `data`: Optional channel-specific data (JSON string)

### 3.3 Unsubscription Flow

**Sequence**:

```
EventHandler::unsubscribe()
  ↓
ChannelManager->find(channel_name)
  ↓
Channel::unsubscribe(connection)
  ↓
ChannelConnectionManager->remove(connection)
  ↓
[For Presence Channels]
  InteractsWithPresenceChannels::unsubscribe()
    ↓ Get subscription data (user_id)
    ↓ Check if user has other subscriptions
    ↓ Broadcast member_removed (if last subscription for user)
  ↓
[If no connections remain]
  ChannelManager->remove(channel)
  ↓ Dispatch ChannelRemoved event
```

### 3.4 Connection Data Storage

**ChannelConnection Class**:
- Wraps the underlying `Connection` object
- Stores subscription metadata as `$data` array
- Provides access via `data(?string $key = null): mixed`
- Proxies connection methods via `__call()`

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Channels/ChannelConnection.php`

---

## 4. Channel Connection Manager Implementations

### 4.1 ChannelConnectionManager Interface

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Contracts/ChannelConnectionManager.php`

```typescript
interface ChannelConnectionManager {
  // Get manager scoped to specific channel
  for(name: string): ChannelConnectionManager;

  // Add connection with subscription data
  add(connection: Connection, data: Record<string, any>): void;

  // Remove connection
  remove(connection: Connection): void;

  // Find connection by Connection object
  find(connection: Connection): ChannelConnection | null;

  // Find connection by ID string
  findById(id: string): ChannelConnection | null;

  // Get all connections (keyed by connection ID)
  all(): Record<string, ChannelConnection>;

  // Check if empty
  isEmpty(): boolean;

  // Clear all connections
  flush(): void;
}
```

### 4.2 ArrayChannelConnectionManager Implementation

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Managers/ArrayChannelConnectionManager.php`

**Storage Strategy**: In-memory hash map by connection ID

```typescript
class ArrayChannelConnectionManager implements ChannelConnectionManager {
  protected name: string;
  protected connections: Map<string, ChannelConnection> = new Map();

  for(name: string): this {
    this.name = name;
    return this;
  }

  add(connection: Connection, data: Record<string, any>): void {
    this.connections.set(
      connection.id(),
      new ChannelConnection(connection, data)
    );
  }

  remove(connection: Connection): void {
    this.connections.delete(connection.id());
  }

  find(connection: Connection): ChannelConnection | null {
    return this.findById(connection.id());
  }

  findById(id: string): ChannelConnection | null {
    return this.connections.get(id) ?? null;
  }

  all(): Record<string, ChannelConnection> {
    return Object.fromEntries(this.connections);
  }

  isEmpty(): boolean {
    return this.connections.size === 0;
  }

  flush(): void {
    this.connections.clear();
  }
}
```

**Key Characteristics**:
- Single connection object per connection ID
- O(1) lookup by connection ID
- Scoped to specific channel via `for()` method (fluent interface)
- No persistence; in-memory only
- Used for single-server deployments

---

## 5. Presence and Cache Channel Special Behaviors

### 5.1 Presence Channel Behavior

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Channels/Concerns/InteractsWithPresenceChannels.php`

#### Member Tracking

**Data Structure per Connection**:
```typescript
interface PresenceSubscriptionData {
  user_id: string;        // Unique user identifier
  user_info: Record<string, any>; // Custom user metadata
  // ... other fields
}
```

#### Subscription Logic

1. **New Member Detection**:
   - Extract `user_id` from channel data JSON
   - Check if user already has subscription: `userIsSubscribed(user_id)`
   - If NEW user:
     - Subscribe connection
     - Broadcast `pusher_internal:member_added` to all (including new member)
     - Others notified of presence change
   - If EXISTING user:
     - Just add connection (user already tracked)
     - No member_added event (same user, different connection)

2. **Member Removal Detection**:
   - On unsubscribe, retrieve stored user_id from subscription data
   - Check if user has OTHER active subscriptions
   - If NO other subscriptions:
     - Broadcast `pusher_internal:member_removed`
     - Include user_id in removal event
   - If user still subscribed elsewhere:
     - No removal event

**Key Insight**: Users can have multiple connections (tabs/windows). Presence tracks unique users, not connections.

#### Presence Data Retrieval

**Method**: `data(): array`

```typescript
// Returns presence information for channel
{
  presence: {
    count: number,      // Unique user count
    ids: string[],      // Array of user_ids
    hash: Record<string, any> // Keyed by user_id, values are user_info
  }
}
```

**Edge Case Handling**:
```typescript
// If any connection missing user_id, return empty presence
if (connections.some(c => !c.data('user_id'))) {
  return {
    presence: {
      count: 0,
      ids: [],
      hash: {}
    }
  };
}
```

#### User Subscription Check

```typescript
protected function userIsSubscribed(?userId: string): boolean {
  if (!userId) return false;
  
  return this.connections
    .all()
    .map(c => String(c.data('user_id')))
    .includes(userId);
}
```

### 5.2 Cache Channel Behavior

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Channels/CacheChannel.php`

#### Caching Strategy

**Storage**:
- `protected ?array $payload = null` - Stores last broadcast payload
- Keyed in memory per channel
- Persists until next broadcast

**Caching Logic**:

```typescript
broadcast(payload: Record<string, any>, except?: Connection): void {
  // ONLY external broadcasts are cached
  this.payload = payload;
  
  // Continue with normal broadcast
  super.broadcast(payload, except);
}

broadcastInternally(payload: Record<string, any>, except?: Connection): void {
  // INTERNAL broadcasts DON'T cache
  // (member_added, member_removed, etc.)
  super.broadcast(payload, except);
}
```

**Critical Distinction**: 
- `broadcast()` → Caches payload
- `broadcastInternally()` → Does NOT cache
- Presence member events (internal) don't clutter the cache

#### Cache Retrieval on Subscribe

**Flow** (in EventHandler):

```typescript
afterSubscribe(channel: Channel, connection: Connection): void {
  // 1. Send subscription_succeeded
  this.sendInternally(connection, 'subscription_succeeded', 
    channel.data(), channel.name());

  // 2. For CacheChannels, check and send cached payload
  if (channel instanceof CacheChannel) {
    if (channel.hasCachedPayload()) {
      // Send raw cached payload (JSON as-is)
      connection.send(JSON.stringify(channel.cachedPayload()));
    } else {
      // No cache yet, notify client
      this.send(connection, 'cache_miss', channel: channel.name());
    }
  }
}
```

**Response Types**:
1. **Cache Hit**: Raw cached payload sent immediately
2. **Cache Miss**: `pusher:cache_miss` event sent
3. **No CacheChannel**: No cache actions taken

#### Use Cases

**CacheChannel**:
- Latest data recovery (e.g., current stock price)
- New subscriber catch-up
- Reduce need for client-side re-fetching
- Improve perceived performance

---

## 6. Channel Manager Implementation

### 6.1 ChannelManager Interface

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Contracts/ChannelManager.php`

```typescript
interface ChannelManager {
  // Scoped operations
  app(): Application | null;
  for(application: Application): ChannelManager;

  // Channel retrieval
  all(): Record<string, Channel>;
  exists(channel: string): boolean;
  find(channel: string): Channel | null;
  findOrCreate(channel: string): Channel;

  // Connection queries
  connections(channel?: string): Record<string, ChannelConnection>;

  // Connection management
  unsubscribeFromAll(connection: Connection): void;

  // Channel lifecycle
  remove(channel: Channel): void;

  // Storage
  flush(): void;
}
```

### 6.2 ArrayChannelManager Implementation

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Managers/ArrayChannelManager.php`

**Storage Structure**:
```typescript
applications: {
  [appId: string]: {
    [channelName: string]: Channel
  }
}
```

**Key Operations**:

1. **findOrCreate**:
   - Check if channel exists
   - If not, use `ChannelBroker::create()` to instantiate correct type
   - Dispatch `ChannelCreated` event
   - Return channel

2. **connections**:
   - Aggregates connections from one or all channels
   - Reduces channel arrays into flat connection map
   - Used for querying subscriptions

3. **unsubscribeFromAll**:
   - Iterates all channels for app
   - Calls `channel.unsubscribe(connection)` on each
   - Channels auto-remove when empty

4. **remove**:
   - Deletes channel from app's channel list
   - Dispatches `ChannelRemoved` event

5. **Scoping**:
   - Operations always scoped to specific app via `for(app)`
   - Prevents cross-app data leakage

---

## 7. Serialization and Deserialization

### 7.1 SerializesChannels Trait

**File**: `/Users/tom/personal/revurb/src/Protocols/Pusher/Concerns/SerializesChannels.php`

**Purpose**: Enable channel state serialization (e.g., for distributed systems)

```typescript
trait SerializesChannels {
  __serialize(): Record<string, any> {
    // Only serialize name
    return {
      name: this.name
    };
  }

  __unserialize(values: Record<string, any>): void {
    // Restore name
    this.name = values.name;
    
    // Re-inject connection manager on deserialization
    this.connections = app(ChannelConnectionManager).for(this.name);
  }
}
```

**Key Design**:
- Minimal serialization (only channel name)
- Connections NOT serialized (local to instance)
- On deserialization, fresh connection manager injected
- Enables safe passing across process boundaries

---

## 8. Event Flow Summary

### 8.1 Subscribe Event Flow

```
Client sends: { event: "pusher:subscribe", channel: "presence-users", auth: "...", channel_data: "{...}" }
        ↓
EventHandler::handle() routes to subscribe()
        ↓
Validator checks: channel string, auth string, channel_data JSON
        ↓
ChannelManager.for(app).findOrCreate("presence-users")
        ↓
ChannelBroker.create() → new PresenceChannel("presence-users")
        ↓
Channel::subscribe(connection, auth, channel_data)
        ↓
InteractsWithPrivateChannels::subscribe()
  └─ verify() → HMAC-SHA256 check
        ↓ [if valid]
InteractsWithPresenceChannels::subscribe()
  ├─ Check userIsSubscribed(user_id)
  ├─ Add connection with user data
  └─ broadcastInternally("member_added") if new user
        ↓
afterSubscribe()
  ├─ sendInternally("subscription_succeeded", presence data)
  └─ [No cache for presence channel]
        ↓
Client receives subscription confirmation
```

### 8.2 Broadcast Event Flow

```
Client sends: { event: "client-event", channel: "presence-users", data: "{...}" }
        ↓
EventDispatcher validates and broadcasts
        ↓
Channel::broadcast(payload)
        ↓
[If CacheChannel] → Store payload in memory
        ↓
For each subscribed connection:
  └─ connection.send(JSON.stringify(payload))
```

### 8.3 Presence Change Event Flow

```
New user subscribes to presence channel
        ↓
InteractsWithPresenceChannels::subscribe()
        ↓
userIsSubscribed(user_id) → false (new user)
        ↓
broadcastInternally({
  event: "pusher_internal:member_added",
  data: JSON(user_data),
  channel: "presence-users"
})
        ↓
Broadcast to ALL connections (including sender)
```

---

## 9. Implementation Notes for TypeScript

### 9.1 Type Safety Considerations

1. **Channel Type Narrowing**:
   ```typescript
   if (channel instanceof CacheChannel) {
     // Safe to call hasCachedPayload()
   }
   if (channel instanceof PresenceChannel) {
     // Safe to call presence-specific methods
   }
   ```

2. **Connection Data Shape**:
   - Private channels: `{ }`
   - Presence channels: `{ user_id: string, user_info: any }`
   - Access with optional chaining: `connection.data('user_id')`

3. **Authentication Token Format**:
   ```typescript
   // Client provides: "key:hash"
   // We extract hash with: Str.after(auth, ':')
   const hash = auth.split(':').pop();
   ```

### 9.2 Performance Considerations

1. **Cache Strategy**: 
   - Single payload stored (not LRU)
   - Re-sent to every new subscriber
   - Consider bandwidth for large payloads

2. **Presence Uniqueness**:
   - O(n) lookup to check user subscription
   - Should not scale to millions of unique users per channel
   - Consider indexing in distributed implementations

3. **Connection Manager**:
   - O(1) connection lookups
   - Consider distributed cache (Redis) for scaling

### 9.3 Extension Points

1. **Custom Channel Types**: Extend `Channel` and update factory
2. **Custom Connection Manager**: Implement `ChannelConnectionManager`, register in container
3. **Custom Channel Manager**: Implement `ChannelManager`, register in container
4. **Event Listeners**: Subscribe to `ChannelCreated` and `ChannelRemoved` events

---

## 10. File Structure Reference

```
src/Protocols/Pusher/Channels/
├── Channel.php                           # Base channel class
├── ChannelBroker.php                     # Factory
├── ChannelConnection.php                 # Connection wrapper
├── CacheChannel.php                      # Caching behavior
├── PrivateChannel.php                    # Private channel (thin wrapper)
├── PresenceChannel.php                   # Presence channel (extends PrivateChannel)
├── PrivateCacheChannel.php               # Private + Caching
├── PresenceCacheChannel.php              # Presence + Caching
└── Concerns/
    ├── InteractsWithPrivateChannels.php  # Auth verification trait
    └── InteractsWithPresenceChannels.php # Presence logic trait

src/Protocols/Pusher/Managers/
├── ArrayChannelConnectionManager.php      # Per-channel connection storage
└── ArrayChannelManager.php                # Per-app channel storage

src/Protocols/Pusher/Contracts/
├── ChannelConnectionManager.php           # Connection manager interface
└── ChannelManager.php                     # Channel manager interface

src/Protocols/Pusher/Concerns/
└── SerializesChannels.php                # Serialization support
```

---

## 11. Summary Table

| Aspect | Details |
|---|---|
| **Total Channel Types** | 6 (Public, Private, Presence, Cache, PrivateCache, PresenceCache) |
| **Factory Pattern** | ChannelBroker::create() uses prefix matching |
| **Authentication** | HMAC-SHA256 for Private/Presence channels |
| **Connection Storage** | ArrayChannelConnectionManager (in-memory hash) |
| **Presence Tracking** | Per-user deduplication, member_added/removed events |
| **Caching Strategy** | Last-event cache per channel, only external events cached |
| **Subscription Validation** | JSON channel_data, authentication token verification |
| **Broadcast Types** | External (cached) vs. Internal (not cached) |
| **Scope** | Per-application channel isolation |
| **Event Framework** | ChannelCreated, ChannelRemoved lifecycle events |

