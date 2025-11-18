# Plan: Implement Main Server Factory

## Metadata

prompt: `in src/index.ts is show a comment:

// Re-export main server factory when implemented
// export { createServer } from './servers/reverb/factory';

I want you to read .claude/commands/plan.md and create a spec to implement that main server factory. we should do so respecting the balance between the port source in reverb/ and this typescript/bun implementation`
task_type: feature
complexity: medium

## Task Description

Create a programmatic server factory entrypoint (`createServer`) that library consumers can import from `revurb` instead of shelling out to the CLI. The helper should wrap the existing `Factory` class, accept resolved configuration or a path to load, mirror Laravel Reverb’s expectations for host/port/path/TLS handling, and return a handle that exposes the Bun server plus cleanup helpers. The CLI must be refactored to consume this helper so there is a single code path for server bootstrapping.

## Objective

Expose a reusable `createServer` API that initializes the Reverb factory, builds a Bun server using the same semantics as Laravel’s PHP factory, wires optional diagnostics (event logging + periodic jobs), and surfaces lifecycle hooks so both the CLI and embedded users can boot/shutdown Revurb safely.

## Problem Statement

Currently, the only way to start Revurb is through `src/cli.ts`, which manually loads config, initializes the factory, spins up periodic jobs, and attaches signal handlers. There is no exported function, so embedding Revurb in another Bun/TypeScript project (or testing it programmatically) is awkward. The duplication also increases risk of diverging from Laravel’s upstream `Laravel\Reverb\Servers\Reverb\Factory` behavior because any future changes would need to be mirrored in multiple places.

## Solution Approach

Introduce a first-class `createServer` helper inside `src/servers/reverb/factory.ts` that wraps the existing `Factory` class. It should:

- Accept either a resolved `ReverbConfig` object, a config path, or fall back to `loadConfig`, plus override flags (host, port, path, hostname, server name, TLS options, debug flag, automation toggles).
- Initialize the factory once per boot, wire the logger to the `Log` facade, and construct the Pusher router just like Laravel’s `Factory::make`.
- Return a structured result containing the Bun server instance, the resolved config/server settings, interval handles (if periodic jobs enabled), and a `shutdown()` helper that performs the same cleanup path used by the CLI.
- Export the helper through `src/index.ts`, then update `src/cli.ts` to delegate to it so CLI and library consumers share one bootstrap path.
- Document how to use the new API and add tests that assert correct behavior (config resolution, graceful teardown, idempotent initialization, error handling when server name/config missing).

## Relevant Files

- `src/index.ts` – Add the `createServer` export once implemented so packages can import it directly.
- `src/servers/reverb/factory.ts` – Home of the `Factory` class; house the new `createServer` helper, lifecycle utilities, and any shared types.
- `src/cli.ts` – Refactor `startServer`, `setupEventListeners`, `setupPeriodicTasks`, and `setupGracefulShutdown` to rely on the new helper instead of duplicating logic.
- `src/config/load.ts`, `src/config/types.ts` – Provide config-loading utilities and type definitions used by the helper when resolving settings.
- `src/jobs/ping-inactive-connections.ts`, `src/jobs/prune-stale-connections.ts`, `src/events/*` – Existing jobs/events the helper needs to wire when optional observability is enabled.
- `tests/unit` (add a suite) – Validate `createServer` resolves configs correctly and exposes cleanup hooks.
- `README.md` / `docs.md` – Document the new API so developers know how to start Revurb programmatically.
- `reverb/src/Servers/Reverb/Factory.php` – Reference implementation from upstream Laravel Reverb to ensure TLS, routing, and controller wiring stay in parity.

## Implementation Phases

### Phase 1: Foundation

Define the `CreateServerOptions` / `CreateServerResult` interfaces, outline default behavior (server name resolution, config-loading order, optional debug/jobs/signals flags), and move reusable helpers (event listeners, periodic jobs, graceful shutdown) into exported functions so the CLI and `createServer` can share them.

### Phase 2: Core Implementation

Implement `createServer` inside `src/servers/reverb/factory.ts`: resolve config, initialize the factory, build Bun server with `Factory.make`, optionally attach observability helpers, and return a result object with cleanup/shutdown handles. Ensure parity with Laravel’s PHP factory for route/TLS handling and guard against multiple initializations.

### Phase 3: Integration & Polish

Refactor `src/cli.ts` to call `createServer`, update documentation/examples, add tests validating the helper, and export the function from `src/index.ts`. Confirm typing, linting, and tests still pass.

## Step by Step Tasks

### 1. Document Upstream Expectations

- Compare `src/servers/reverb/factory.ts` with `reverb/src/Servers/Reverb/Factory.php` to ensure the new helper does not miss any TLS/router responsibilities.
- Note which CLI behaviors (config overrides, logging, periodic jobs, graceful shutdown) need to be optional knobs on the helper.

### 2. Define API Contracts

- Create TypeScript interfaces describing `CreateServerOptions` (config, server name, overrides, debug flag, enableJobs, enableSignals, hooks) and `CreateServerResult` (server, config, shutdown(), diagnostics handles).
- Decide on default behavior (e.g., jobs/signals disabled by default for libraries, enabled explicitly by CLI) and document it in code comments for clarity.

### 3. Share Bootstrap Utilities

- Move `setupEventListeners`, `setupPeriodicTasks`, and `setupGracefulShutdown` into reusable functions (likely exported from `src/servers/reverb/factory.ts` or a new helper module) so they can be called both from the CLI and from `createServer` when requested.
- Ensure these helpers accept dependencies (logger, channel manager, Bun server, signal list) instead of capturing CLI-local state.

### 4. Implement createServer Helper

- In `src/servers/reverb/factory.ts`, implement `createServer` that:
  - Resolves `ReverbConfig` via direct argument, config path, or `loadConfig()` fallback.
  - Picks the desired server configuration (default or named) and applies overrides for host/port/path/hostname/maxRequestSize/options/protocol.
  - Calls `Factory.initialize(config)` once, sets up optional observers/jobs/signals based on options, and spins up the Bun server via `Factory.make`.
  - Returns `{ server, config, serverConfig, stop, teardown }` where `stop()` cancels intervals, removes signal listeners, disconnects channels, and calls `server.stop()`.
  - Surfaces meaningful errors when configuration is missing or invalid.

### 5. Refactor CLI to Use createServer

- Update `startServer` to call `createServer({ configPath, overrides..., debug: options.debug === true, enableJobs: true, enableSignals: true })` and log based on the returned metadata.
- Remove duplicated initialization logic from the CLI, ensuring CLI-provided logging/statements still print the same output.
- Keep CLI-only concerns (argument parsing, console output) in `src/cli.ts`, but ensure any shared logic lives in the helper.

### 6. Export & Document the API

- Add `export { createServer } from "./servers/reverb/factory";` to `src/index.ts`.
- Update README/docs with a small example of embedding Revurb via `createServer` (include TypeScript snippet showing config overrides and manual shutdown).

### 7. Testing & Validation

- Add targeted unit tests (or integration tests) verifying `createServer` resolves configs, applies overrides, registers optional observers only when requested, and shuts down cleanly.
- Ensure tests stub Bun.serve or run it on a random available port to avoid conflicts.
- Run `bun test`, `bun run lint`, and `bun run typecheck` to confirm no regressions.

## Testing Strategy

- **Unit tests**: Mock/stub `Factory.make` (or run on ephemeral ports) to confirm options, overrides, and error scenarios (missing server config, duplicate initialize) behave as expected.
- **Integration smoke**: Spin up a server with `createServer` in tests/e2e, hit `/up`, then call the returned `shutdown()` to ensure cleanup closes Bun server and cancels jobs.
- **CLI regression**: Run the CLI start command in a test or manual step to confirm it delegates to the new helper without altering output (ensuring comment parity with Laravel).

## Acceptance Criteria

- `createServer` exists in `src/servers/reverb/factory.ts`, is exported from `src/index.ts`, and returns a structured result with cleanup helpers.
- The helper can load config (object/path/default), apply overrides, and start a Bun server identical to the CLI path.
- CLI boot now uses `createServer`, eliminating duplicated initialization logic.
- Optional observability (event logging, periodic jobs, signal handlers) can be toggled via options and defaults safe for embedding.
- README/docs describe programmatic usage, and tests cover the new helper (including shutdown behavior).

## Validation Commands

- `bun test tests/unit/create-server.test.ts` – Exercised unit suite for the helper.
- `bun test` – Run the entire suite to ensure no regressions.
- `bun run lint` – Confirm lint/style pass after refactor.
- `bun run typecheck` – Verify TypeScript types remain consistent.
- `bun run dev` (optional) – Manual smoke: start via CLI (now backed by the helper) and ensure `/up` responds.

## Notes

- Follow AGENTS.md guidance (avoid unnecessary `else`, prefer `const`, avoid `any`, keep logic inside single functions when practical, favor Bun APIs such as `Bun.env` and `Bun.file`).
- Ensure TLS logic references the upstream PHP factory for parity; any deviation should be documented and justified.
- Consider how repeated calls to `createServer` should behave—document whether reinitialization is allowed or if callers must instantiate once per process.
