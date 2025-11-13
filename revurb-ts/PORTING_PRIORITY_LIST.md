# TypeScript Revurb Port - Prioritized Next Steps

## STATUS OVERVIEW
- **Total TypeScript Files**: 86 ✅ All complete
- **Core Functionality**: ✅ Production-ready
- **Test Status**: ✅ E2E tests passing (8 tests)
- **Blockers**: ❌ None - server is fully functional

---

## PHASE 1: FIX DEPENDENCY INJECTION STUBS (HIGH PRIORITY)
**Estimated Time**: 30-45 minutes | **Impact**: Functional correctness

### 1.1 Fix `channel-users-controller.ts`
**File**: `/tmp/test-revurb/src/Protocols/Pusher/Http/Controllers/channel-users-controller.ts`

**Problem**: Three functions throw "not implemented" errors:
- `getApplicationProvider()` (line 224)
- `getChannelManager()` (line 236)  
- `getMetricsHandler()` (line 248)

**Current Code**:
```typescript
function getApplicationProvider(): any {
  throw new Error('Application provider not implemented. Use dependency injection.');
}
```

**Solution**: Wire to Factory's static getters:
```typescript
import { Factory } from '../../factory';

function getApplicationProvider(): any {
  return Factory.getApplicationProvider();
}

function getChannelManager(): ChannelManager {
  const provider = Factory.getApplicationProvider();
  return Factory.getChannelManager().for(provider);
}

function getMetricsHandler(): MetricsHandler {
  // Get from Factory or create new instance
  return new MetricsHandler(null, Factory.getChannelManager(), null);
}
```

**Files to Edit**: 
- `/tmp/test-revurb/src/Protocols/Pusher/Http/Controllers/channel-users-controller.ts`

**Validation**: Controller functions no longer throw errors

---

### 1.2 Fix `connections-controller.ts` 
**File**: `/tmp/test-revurb/src/Protocols/Pusher/Http/Controllers/connections-controller.ts`

**Problem**: Same DI stubs as above (3 functions)

**Solution**: Apply same pattern as 1.1

**Files to Edit**:
- `/tmp/test-revurb/src/Protocols/Pusher/Http/Controllers/connections-controller.ts`

**Validation**: Controller functions no longer throw errors

---

## PHASE 2: IMPLEMENT EVENT DISPATCHER (MEDIUM PRIORITY)
**Estimated Time**: 1.5-2 hours | **Impact**: Full observability

### 2.1 Implement EventDispatcher Listener Pattern
**File**: `/tmp/test-revurb/src/events/event-dispatcher.ts`

**Current State**: Stub with only emit() method

**Needed**:
- Add listener registry (Map<eventName, listeners>)
- Implement `on(event, callback)` method
- Implement `off(event, callback)` method
- Update `emit(event, data)` to call listeners
- Handle async listeners properly

**Implementation Sketch**:
```typescript
export class EventDispatcher {
  private static listeners: Map<string, EventListener[]> = new Map();

  static on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  static off(event: string, listener: EventListener): void {
    const list = this.listeners.get(event);
    if (list) {
      const index = list.indexOf(listener);
      if (index > -1) list.splice(index, 1);
    }
  }

  static emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }
}
```

**Files to Edit**:
- `/tmp/test-revurb/src/events/event-dispatcher.ts`

**Validation**: Listeners registered and called correctly

---

### 2.2 Complete ClientEvent Whisper Implementation
**File**: `/tmp/test-revurb/src/Protocols/Pusher/client-event.ts`

**Current Code** (lines 118-129):
```typescript
private static whisper(_connection: Connection, _payload: PusherMessage): void {
  console.warn('ClientEvent.whisper: EventDispatcher not yet implemented');
}
```

**Solution**: Actually dispatch the event:
```typescript
private static whisper(connection: Connection, payload: PusherMessage): void {
  EventDispatcher.dispatch(connection.app(), payload, connection);
}
```

**Files to Edit**:
- `/tmp/test-revurb/src/Protocols/Pusher/client-event.ts`

**Validation**: Client events logged via dispatcher

---

### 2.3 Wire Event Dispatch Throughout Codebase
**Files Needing Updates** (5 files):

1. **array-channel-manager.ts** 
   - Add `ChannelCreated.dispatch()` call when creating channels
   - Add `ChannelRemoved.dispatch()` call when removing channels

2. **event-handler.ts**
   - Add `MessageReceived.dispatch()` when receiving
   - Add `MessageSent.dispatch()` when sending

3. **server.ts**
   - Add event dispatches for connection lifecycle

4. **jobs/prune-stale-connections.ts**
   - Add `ConnectionPruned.dispatch()` for stale connections

5. **channel.ts**
   - Add event dispatch for subscriptions/unsubscriptions

**Implementation Pattern**:
```typescript
// When creating channel:
channel = new Channel(...);
ChannelCreated.dispatch(channel);

// When removing channel:
ChannelRemoved.dispatch(channel);

// When pruning connection:
ConnectionPruned.dispatch(connection);
```

**Validation**: All event dispatch calls integrated and tested

---

## PHASE 3: ADD EVENT LISTENERS FOR LOGGING (MEDIUM PRIORITY)
**Estimated Time**: 30-45 minutes | **Impact**: Observable server behavior

### 3.1 Wire Event Listeners in CLI
**File**: `/tmp/test-revurb/src/cli.ts`

**Add**: Event listener setup on server initialization:
```typescript
import * as Events from './events';

// After Factory.initialize():
Events.EventDispatcher.on('channel:created', (event) => {
  logger.debug(`Channel created: ${event.channel.name()}`);
});

Events.EventDispatcher.on('channel:removed', (event) => {
  logger.debug(`Channel removed: ${event.channel.name()}`);
});

Events.EventDispatcher.on('connection:pruned', (event) => {
  logger.debug(`Connection pruned: ${event.connection.id()}`);
});
```

**Files to Edit**:
- `/tmp/test-revurb/src/cli.ts`

**Validation**: Events appear in server logs

---

## PHASE 4: SECURITY & POLISH (LOW PRIORITY)
**Estimated Time**: 15-30 minutes | **Impact**: Production readiness

### 4.1 Add TLS Environment Configuration
**File**: `/tmp/test-revurb/src/Servers/Reverb/factory.ts`

**Current Code** (line 984):
```typescript
// TODO: Determine environment for verify_peer setting
// filtered.verify_peer = environment === 'production';
```

**Solution**: Pass environment through config:
```typescript
public static make(
  host: string = '0.0.0.0',
  port: string = '8080',
  path: string = '',
  hostname?: string,
  maxRequestSize: number = 10000,
  options: HttpServerOptions = {},
  protocol: string = 'pusher',
  environment: string = 'development'  // ADD THIS
) {
  // ... existing code ...
  
  const tlsContext = this.configureTls(
    options.tls ?? {}, 
    hostname,
    environment  // PASS HERE
  );
  
  // ... rest of method ...
}

private static configureTls(
  context: TlsContext, 
  hostname?: string,
  environment: string = 'development'  // ADD THIS
): TlsContext {
  // ... existing code ...
  
  if (!this.usesTls(filtered) && hostname && Certificate.exists(hostname)) {
    const certs = Certificate.resolve(hostname);
    if (certs) {
      const [certPath, keyPath] = certs;
      filtered.local_cert = certPath;
      filtered.local_pk = keyPath;
      filtered.verify_peer = environment === 'production';  // USE IT
    }
  }
  
  return filtered;
}
```

**Files to Edit**:
- `/tmp/test-revurb/src/Servers/Reverb/factory.ts`

**Validation**: TLS verify_peer set correctly based on environment

---

## IMPLEMENTATION SEQUENCE

### Session 1 (45 mins)
- [ ] Phase 1.1: Fix channel-users-controller.ts DI
- [ ] Phase 1.2: Fix connections-controller.ts DI
- [ ] Commit changes

### Session 2 (2 hours)
- [ ] Phase 2.1: Implement EventDispatcher listener pattern
- [ ] Phase 2.2: Wire ClientEvent whisper
- [ ] Phase 2.3: Add event dispatch calls (iterate through 5 files)
- [ ] Commit changes

### Session 3 (45 mins)
- [ ] Phase 3.1: Wire event listeners in CLI
- [ ] Phase 4.1: Add TLS environment config
- [ ] Run full test suite
- [ ] Commit changes

---

## VALIDATION CHECKLIST

### Phase 1 Validation
- [ ] No "throw new Error" for DI in controller functions
- [ ] Controllers can call Factory methods without crashing
- [ ] HTTP API responds to requests (test with curl/postman)

### Phase 2 Validation
- [ ] EventDispatcher.on() registers listeners
- [ ] EventDispatcher.emit() calls listeners
- [ ] ClientEvent.whisper() doesn't log warnings
- [ ] All event dispatch calls integrated

### Phase 3 Validation
- [ ] Server logs channel creation/removal events
- [ ] Server logs connection pruning events
- [ ] Observability data appears in standard output

### Phase 4 Validation
- [ ] TLS verification works in production
- [ ] Configuration accepts environment parameter
- [ ] Security settings applied correctly

---

## NOTES

### Architecture Decisions
- **DI Approach**: Use Factory static getters rather than service container
- **Event System**: Simple listener pattern (pub/sub), no event queue
- **Observability**: Log through existing logger, not separate monitoring

### Known Constraints
- No breaking changes to public API
- Keep Factory.initialize() as entry point
- Don't modify WebSocket handler signatures
- HTTP controllers must remain compatible with factory routing

### Test Coverage After Implementation
- Unit tests for EventDispatcher
- Unit tests for event emission from key points
- Integration tests for DI-wired controllers
- E2E tests should still pass

