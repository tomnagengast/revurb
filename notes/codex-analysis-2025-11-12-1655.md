**Working Today**

- CLI + config loading: `src/cli.ts:114-205` proves the CLI can load `ReverbConfig`, override host/port/path flags, boot the Bun server, and wire up scheduled jobs plus graceful shutdown comparable to Laravel’s `reverb:start` command.  
- Bun server factory: `src/Servers/Reverb/factory.ts:332-458` shows `Factory.make` building a `Bun.serve` instance with HTTP routing, TLS negotiation, and WebSocket lifecycle hooks that feed the Pusher server implementation.  
- App/auth stack: `src/application-manager.ts:1-145` converts config apps into immutable `Application` objects, and `src/connection.ts:1-140` wraps Bun sockets with Reverb’s state machine (active/inactive/stale, ping/pong tracking).  
- Pusher protocol handling: `src/Protocols/Pusher/server.ts:43-220` plus `src/Protocols/Pusher/event-handler.ts:1-150` cover connection limits, origin filtering, subscribe/unsubscribe flows, ping/pong, cached channel payloads, and error responses.  
- Channel layer: `src/Protocols/Pusher/Managers/array-channel-manager.ts:1-220` and `src/Protocols/Pusher/Channels` provide in-memory channel registries (public/private/presence/cache) with channel brokers, ensuring parity with Laravel’s array driver.  
- Health jobs: `src/jobs/ping-inactive-connections.ts:1-70` and `src/jobs/prune-stale-connections.ts:1-96` keep connections alive or prune stale ones, scheduled via `setupPeriodicTasks()` (`src/cli.ts:208-235`).  
- HTTP API coverage: controllers such as `events-controller.ts:1-150`, `events-batch-controller.ts`, `channels-controller.ts`, `channel-controller.ts`, and `users-terminate-controller.ts:1-160` are already ported and plugged into `Factory` routes (`src/Servers/Reverb/factory.ts:740-920`).  
- Tests: E2E suites exercise websocket handshake, ping/pong, subscription/unsubscription, and private/presence auth (`tests/e2e/channel-subscription.test.ts:13-176`, `tests/e2e/presence-channel.test.ts:31-180`), giving confidence the main data path works under Bun.

**Still Missing vs Laravel Reverb**

- Laravel service-provider/pulse surface: the PHP service providers, Pulse Livewire recorders, console install/restart commands, and Blade components remain intentionally unported (`agent/CURRENT_STATUS_2025-11-12.md:60-78`). If parity is required, those layers (or TS equivalents) still need to be rebuilt.  
- Client events + dispatcher plumbing: server-side handling falls back to `console.warn` because `ClientEvent.whisper` never hands off to `EventDispatcher` (`src/Protocols/Pusher/client-event.ts:118-129`), so `client-*` events currently don’t broadcast as they do in Laravel.  
- Pub/Sub and scaling: `Factory.initialize` installs a stub server provider (`pubSub: () => null`) and passes `null` into `MetricsHandler` (`src/Servers/Reverb/factory.ts:237-247`), while `UsersTerminateController` gets no pub/sub driver (`src/Servers/Reverb/factory.ts:262-266`). Redis pub/sub classes exist but aren’t wired, and project notes flag multi-server scaling tests as pending (`agent/SESSION_2025-11-12-part2.md:100-114`).  
- Authenticated metrics endpoints: `channel-users-controller.ts` and `connections-controller.ts` still call placeholder `getApplicationProvider()/getChannelManager()/getMetricsHandler()` that throw (“use dependency injection”) (`src/Protocols/Pusher/Http/Controllers/channel-users-controller.ts:224-252`, `connections-controller.ts:205-232`). That means `/channels/{channel}/users` and `/connections` endpoints cannot function yet.  
- Event observers: while the `events/` package ships a dispatcher, several parts of the system (channel lifecycle, server message handlers) comment out dispatch lines or never subscribe, so monitoring hooks present in Laravel aren’t emitting signals yet.  
- TLS parity: automatic certificate discovery happens, but the PHP version toggles `verify_peer` per environment; the TS port leaves this as a TODO (`src/Servers/Reverb/factory.ts:968-989`).  
- Remaining Laravel-specific surface area (Pulse dashboards, telescope ingest, artisan glue) is still absent per the status doc, so any workflows depending on them need TypeScript counterparts (`agent/CURRENT_STATUS_2025-11-12.md:67-75`).

**Highest-Priority Next Steps**

1. **Unblock HTTP admin endpoints** – Inject the actual `applicationProvider`, `channelManager`, and `metricsHandler` instances into `connections-controller` and `channel-users-controller` instead of the throwing placeholders, then re-run the relevant signature-verification logic (`src/Protocols/Pusher/Http/Controllers/channel-users-controller.ts:224-252`, `connections-controller.ts:205-232`).  
2. **Wire client events + event bus** – Replace the placeholder in `ClientEvent.whisper` with a call to `EventDispatcher.dispatch` and ensure `EventDispatcher` is initialized with channel access so `client-*` events mirror Laravel’s behavior (`src/Protocols/Pusher/client-event.ts:118-129`).  
3. **Hook up Redis scaling** – Replace the stub `serverProvider` with a concrete provider that returns a configured `RedisPubSubProvider`, then feed it into `MetricsHandler` and `UsersTerminateController` so publish/subscribe, metrics fan-out, and forced user disconnects work across nodes (`src/Servers/Reverb/factory.ts:237-266`, `src/Servers/Reverb/Publishing/*.ts`).  
(Once those are done, revisit TLS `verify_peer` and optional Pulse/Telescope integrations to close parity gaps.)

**TODO / FIXME Inventory**

- `src/Servers/Reverb/factory.ts:984` – Decide how to set `verify_peer` when auto-loading certificates so TLS hardening matches environment expectations.  
- `src/Protocols/Pusher/Channels/channel.ts:11-34` – Temporary ChannelManager interface shim should be replaced with the real contract import once the remaining manager abstractions are ported.  
- `src/Protocols/Pusher/client-event.ts:118-129` – Implement `EventDispatcher.dispatch` call so `client-*` events actually propagate.  
- `src/Protocols/Pusher/Http/Controllers/channel-users-controller.ts:224-252` – TODOs to swap placeholder getters with dependency injection for application provider, channel manager, and metrics handler.  
- `src/Protocols/Pusher/Http/Controllers/connections-controller.ts:205-232` – Same DI TODOs; until resolved, `/connections` throws.  
(There are no other `TODO`/`FIXME` hits under `src/` per the current search; the above are the actionable ones.)

Natural follow-ups after addressing those items: run the E2E test suite (`bun test`) to confirm regressions, then begin integrating a real pub/sub driver and any Laravel-only observability layers you still need.