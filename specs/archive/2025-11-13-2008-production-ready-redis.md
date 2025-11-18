# Plan: Production-ready Redis Pub/Sub

## Metadata

prompt: `read .claude/commands/plan.md and put a plan together to get this production-ready`
task_type: feature
complexity: complex

## Task Description

Deliver a clear implementation path to replace the current no-op Redis Pub/Sub mock with a fully functional, production-ready integration that mirrors Laravel Reverb’s Redis behavior while fitting Bun/TypeScript conventions. The plan must ensure node clustering works through Redis-based event fan-out, configuration is ergonomic, and documentation plus tests communicate the new reality.

## Objective

Enable Revurb to connect to a real Redis server for publish/subscribe so multiple server instances can stay in sync out of the box, matching Laravel Reverb’s behavior and providing clear configuration, tooling, and test coverage.

## Problem Statement

Revurb’s `RedisClientFactory` returns a mock Redis client, so any call to publish, subscribe, or listen is effectively a no-op. This blocks multi-server deployments and contradicts Laravel Reverb’s capabilities (`~/personal/_clones/laravel/reverb/src/Servers/Reverb/Publishing/RedisClientFactory.php`). Production users need a working Redis-backed Pub/Sub layer with reconnection logic, proper configuration parsing, and documentation.

## Solution Approach

Adopt a battle-tested Redis client (likely `ioredis`, which supports Bun’s runtime) and implement a real `RedisClientFactory` that returns connected clients with TLS/auth/db support derived from `RedisServerConfig`. Reuse/extend the existing `RedisClient`, `RedisPublishClient`, and `RedisSubscribeClient` scaffolding, ensuring event listeners, reconnection, and queue draining all operate with true Redis connections. Mirror Laravel’s configuration surface (driver, timeout, URL overrides) while staying idiomatic to Bun (prefer `Bun.env`). Add smoke tests that spin up `redis-server` or use `mock-redis-server` to confirm publish/subscribe works, and update README/docs to remove “mock” caveats and explain configuration. Provide migration guidance for anyone who extended the mock factory manually.

## Relevant Files

- `README.md` – Update feature matrix, configuration, and Port Status to reflect real Redis support.
- `docs.md` (scaling section) – Align instructions with new defaults and remove “no-op mock” warnings.
- `src/config/types.ts`, `src/config/load.ts` – Confirm Redis config surface matches Laravel’s, add URL parsing parity.
- `src/servers/reverb/publishing/redis-client-factory.ts` – Core implementation: instantiate `ioredis`, manage lifecycle, expose hooks for tests.
- `src/servers/reverb/publishing/redis-client.ts` – Ensure connection/retry flow works with actual client events and TLS/auth config identical to Laravel (`~/personal/_clones/laravel/reverb/src/Servers/Reverb/Publishing/RedisClient.php`).
- `src/servers/reverb/publishing/redis-publish-client.ts` & `redis-subscribe-client.ts` – Verify publish/subscribe semantics, enqueueing, and error propagation.
- `src/servers/reverb/publishing/redis-pubsub-provider.ts` – Confirm provider wires publisher/subscriber with real clients and surfaces listener APIs Pusher protocol expects.
- `tests/feature` & `tests/e2e` – Add coverage proving redis fan-out works (e.g., spawn two server instances or simulate message bus).
- `package.json` / Bun manifest – Add Redis client dependency (e.g., `ioredis`) and possible Bun polyfills if needed.
- Reference: `~/personal/_clones/laravel/reverb/src/Servers/Reverb/Publishing/*` – Guide parity with upstream PHP implementation.

## Implementation Phases

### Phase 1: Foundation

- Audit configuration parity with Laravel (driver, scheme, TLS, timeout, URL).
- Select Redis client library confirmed to work under Bun (`ioredis` preferred) and document dependency impact.
- Ensure typing/interfaces cover all commands used by `RedisClient`, publish, subscribe, etc.

### Phase 2: Core Implementation

- Replace mock factory with real connection logic, including TLS/auth handling, timeouts, and reconnection hooks.
- Wire publisher/subscriber clients to use actual Redis connections, ensuring message handlers follow Laravel semantics.
- Provide dependency injection seams so advanced users can swap clients if needed (similar to overriding PHP factory).

### Phase 3: Integration & Polish

- Update README/docs to reflect production readiness and describe Redis setup.
- Implement automated tests (unit + integration) verifying publish/subscribe across multiple instances or simulated clients.
- Document migration considerations and ensure logging/error messages mirror Laravel for debuggability.

## Step by Step Tasks

### 1. Review Upstream Behavior

- Compare Revurb Redis publishing classes to Laravel originals to identify gaps (TLS, config parsing, retry semantics).
- Note any helpers (e.g., Laravel’s `ConfigurationUrlParser`) that need TypeScript equivalents.

### 2. Finalize Redis Client Choice

- Validate `ioredis` (or alternative) works in Bun via small spike (`bun x ts-node` or direct Bun script) to confirm compatibility.
- Add dependency to project manifest and note impact on bundle size / build steps.

### 3. Implement Real RedisClientFactory

- Parse URLs and configuration in `redis-client-factory.ts`, constructing options object accepted by chosen client.
- Instantiate client, connect, and ensure `publish`, `subscribe`, `unsubscribe`, `on`, etc., map to library methods while satisfying `RedisClient` interface.
- Surface hooks for injecting custom factory (maintain extension point).

### 4. Integrate Factory with RedisClient Hierarchy

- Update `RedisClient` to await actual connections, configure error/close handlers, and ensure `disconnect()` gracefully quits clients.
- Ensure TLS/auth/database selection matches Laravel logic, including query param builder.
- Maintain queueing/retry semantics in `RedisPublishClient` and event subscription filtering in `RedisPubSubProvider`.

### 5. Configuration & Environment Alignment

- Extend `src/config/load.ts` to read `Bun.env` variables covering host/port/password/driver analogs (match README + Laravel).
- Provide sensible defaults and validation errors when essential fields missing.
- Document CLI/config usage to enable real Redis scaling out of the box.

### 6. Testing & Tooling

- Add unit tests covering connection URL parsing, reconnection flow, and publish queue draining.
- Add integration test that spins up ephemeral Redis (e.g., via `redis-server --save "" --appendonly no`) and proves multi-client delivery.
- Consider e2e test that boots two Revurb instances (or mocks provider) to ensure events propagate.

### 7. Documentation & Migration Notes

- Update README/docs to remove “mock” disclaimers, add setup section, and mention extending factory only when swapping clients.
- Provide migration guidance (e.g., env flags to disable Redis, instructions for overriding factory).
- Note parity with Laravel’s configuration to reassure users aligning both ecosystems.

### 8. Validation & Cleanup

- Run lint/tests/format to ensure CI still passes.
- Manually test by running two Revurb instances connected to same Redis and verifying broadcast fan-out.

## Testing Strategy

- **Unit Tests**: URL parsing, TLS/auth flags, reconnection timeout, publisher queue flush, subscriber error handling.
- **Integration Tests**: Spin up Redis via docker to verify publish/subscribe flows between publisher/subscriber clients and the `RedisPubSubProvider`.
- **End-to-End Smoke**: Launch two Revurb servers connected through Redis, trigger an event via HTTP API, assert both receive broadcast (can be automated or documented manual procedure).
- **Regression**: Ensure single-server deployments still run without Redis by allowing configuration toggle or falling back gracefully.

## Acceptance Criteria

- `RedisClientFactory` returns real Redis connections by default; no-op mock removed or only used behind explicit opt-out flag.
- Redis configuration mirrors Laravel’s, including URL overrides, TLS, username/password, database, and timeout.
- Publish/subscription flows verified through automated tests and manual instructions.
- README/docs describe production-ready Redis support, including setup and troubleshooting.
- Multi-instance Revurb servers can share state/events through Redis without code changes.

## Validation Commands

- `bun install` – Ensure dependencies (e.g., `ioredis`) install cleanly.
- `bun test` – Run unit/integration suite covering new Redis functionality.
- `bun run lint` – Confirm linting passes after TypeScript changes.
- Optional manual: `bun run dev` on two terminals + `redis-server` running, trigger broadcasts via `bun run src/cli.ts events:trigger ...`.

## Notes

- Keep implementation aligned with Laravel source (`~/personal/_clones/laravel/reverb/src/Servers/Reverb/Publishing/*`) to simplify upstream diffing.
- Verify Bun’s runtime handles Node TCP sockets for selected Redis client; consider shims/polyfills if necessary.
- If supporting optional custom factories, document how to inject them via dependency injection or config overrides.
- Reuse the existing `docker-compose.yml` for integration testing (Redis service + multiple Revurb instances) to validate publish/subscribe behavior in an environment close to production.
