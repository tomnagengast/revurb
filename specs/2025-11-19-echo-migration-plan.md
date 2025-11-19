# Echo Migration Plan (Laravel Echo → `@revurb/echo`)

Date: 2025-11-19  
Scope: `_source/echo` → `packages/echo` (core + React)

## 1. Background & Goals

- Revurb follows **"Architectural Parity, Syntactical Idiom"** (see `docs/contributing.md`).
- `_source/echo` contains the upstream `laravel-echo` + React packages.
- `packages/echo` is a Bun/TS port that:
  - Implements a slimmer `Echo` client focused on **reverb/pusher** via `PusherConnector`.
  - Ships React helpers in `packages/echo/src/react/**`.
  - Still depends on `laravel-echo` for its React types/config and some behaviours.
- **Goal:** Fully migrate the upstream Echo packages into `packages/echo`, so that:
  - `@revurb/echo` is the single source of truth for Echo client behaviour.
  - We preserve architectural parity with upstream while adopting Bun/TS idioms.
  - We can drop the runtime dependency on `laravel-echo` for web consumers.

Non-goals for this migration:

- Supporting PHP/Laravel-specific concepts (Artisan, service providers) inside the Echo client.
- Re-introducing any Laravel-specific coupling that does not make sense for a generic Bun/TS client.

## 2. Current State Summary

### 2.1 `_source/echo` (upstream)

- `packages/laravel-echo`:
  - `Echo` class:
    - Supports broadcasters: `"reverb"`, `"pusher"`, `"ably"`, `"socket.io"`, `"null"`, and custom constructor-based connectors.
    - Registers interceptors (Axios, Vue HTTP, jQuery, Turbo) to attach `X-Socket-Id`.
  - Connectors:
    - `PusherConnector` (Pusher/Reverb/Ably).
    - `SocketIoConnector` (socket.io-client).
    - `NullConnector` (no-op, fake socket id).
  - Channels:
    - Pusher channels (`Channel`, private, presence, encrypted).
    - Socket.io channels (public/private/presence).
    - Null channels (public/private/presence/encrypted).
  - Utilities:
    - `EventFormatter`, `isConstructor`, broadcast driver types (`Broadcaster`, `BroadcastDriver`, `EchoOptions`, etc.).

- `packages/react`:
  - `configureEcho` sets sensible defaults from `import.meta.env` for all broadcasters.
  - `useEcho`, `useEchoNotification`, `useEchoPresence`, `useEchoPublic`, `useEchoModel`.
  - Types reference the upstream `laravel-echo` types and `Broadcaster` mapping.

### 2.2 `packages/echo` (Bun-focused port)

- Core (`packages/echo/src`):
  - `Echo` implementation:
    - Only recognises `"reverb"` and `"pusher"` broadcasters.
    - Always uses `PusherConnector` (no socket.io, ably, or null connectors).
    - Does not register any HTTP interceptors for `X-Socket-Id`.
  - `Connector` + `PusherConnector`:
    - Largely aligned with upstream Pusher connector behaviour.
    - `Connector` has reduced generics and uses local `EchoOptions` / `EchoOptionsWithDefaults`.
  - Channels:
    - Pusher channels and presence/private/encrypted variants.
    - Null channel variants exist but there is no socket.io implementation.
  - Types:
    - Local `BroadcastDriver = "pusher" | "reverb"`.
    - `EchoOptions` is a simplified, broader type compared to upstream.

- React (`packages/echo/src/react`):
  - `configureEcho` / `echo`:
    - Still imports `Echo`, `BroadcastDriver`, `EchoOptions` from **upstream `laravel-echo`**.
    - Defaults for `reverb` and `pusher` are inlined and driven by the caller (demo app sets config explicitly).
  - Hooks & types:
    - `useEcho` and friends are effectively a port of upstream React hooks.
    - Types (`Connection`, `ChannelReturnType`, etc.) import `BroadcastDriver` and `Broadcaster` from **`laravel-echo`**, not local types.

- Demo app (`apps/demo`):
  - Uses `@revurb/echo/react`:
    - Calls `configureEcho({ broadcaster: "reverb", ... })` with runtime config injected via script tag.
    - Uses `useEcho` for a `private-${channel}` stream and raw `pusher.send_event` for client events.
  - Relies only on the `"reverb"` + Pusher path; does not exercise socket.io/ably/null.

## 3. Migration Principles

- **Parity-first:** Mirror upstream Echo + React behaviour and public API, especially:
  - Broadcaster names and options shape.
  - Channel methods (`listen`, `listenForWhisper`, `notification`, `here`, `joining`, `leaving`, `whisper`, etc.).
  - Connector responsibilities and option handling.
- **Idiom-aware:**
  - Keep code idiomatic TypeScript and compatible with Bun bundling.
  - Avoid leaking browser-only globals into server contexts; guard those behaviours.
- **Incremental & non-breaking:**
  - Maintain the current behaviour for `"reverb"` and `"pusher"` during migration.
  - Keep `apps/demo` working throughout.
  - Only remove the `laravel-echo` dependency after local types and behaviour are validated.

## 4. Detailed Migration Plan

### Phase 0 – Baseline & Test Harness

1. Mirror upstream tests:
   - Copy/port relevant tests from `_source/echo/packages/laravel-echo/tests` and `_source/echo/packages/react/tests` into `packages/echo/tests`.
   - Focus first on:
     - `Echo` constructor behaviour and connector selection.
     - Channel subscription / unsubscription behaviour.
     - `EventFormatter` formatting rules.
     - React hooks subscription lifecycle (`useEcho`, `useEchoNotification`, presence/public/model variants).
2. Configure Bun test runner:
   - Ensure `packages/echo` `bun test` can run a subset of ported tests with minimal polyfills (e.g. fake Pusher/socket.io clients, simple DOM shims where needed).
3. Establish a parity matrix:
   - Document which upstream features are considered **must-have** for Revurb:
     - `reverb`/`pusher`/`null` broadcasters: required.
     - `socket.io`: optional but nice to have for broader compatibility.
     - `ably`: optional; can be implemented later on top of Pusher-style semantics.

### Phase 1 – Core Echo Class & Types

1. Introduce local `Broadcaster`/`BroadcastDriver`/`EchoOptions` types:
   - Port the upstream type definitions into `packages/echo/src/types.ts`:
     - `BroadcastDriver` union covering all supported drivers.
     - `Broadcaster` mapped type describing connector, channel types, and options per driver.
     - Driver-specific option types (e.g. `PusherOptions`, socket.io options) where needed.
   - Update the local `Echo` class to use these types instead of the current simplified `BroadcastDriver`/`EchoOptions`.
2. Align `Echo` class logic:
   - Update `packages/echo/src/echo.ts` to mirror `_source/echo/packages/laravel-echo/src/echo.ts`:
     - Support `"reverb"`, `"pusher"`, `"ably"`, `"socket.io"`, `"null"`, and constructor-based broadcasters.
     - For `"reverb"` and `"ably"`, construct `PusherConnector` with appropriate option mapping (cluster, broadcaster override).
     - For `"null"`, use a new `NullConnector` implementation (Phase 2).
   - Preserve the ability to disable interceptors via `withoutInterceptors`, but:
     - Default to `withoutInterceptors: true` for Revurb (browser consumers can opt-in later).
3. Socket id & interceptors wiring:
   - Implement `registerInterceptors` in the local `Echo` class, but:
     - Guard usages of `axios`, `Vue`, `jQuery`, and `Turbo` behind type-safe runtime checks.
     - Keep the code tree-shakable by colocating interceptors in a separate module if necessary.

### Phase 2 – Channels & Connectors

1. Channels:
   - Review the existing Pusher channel implementations in `packages/echo/src/channel/**` and reconcile with upstream:
     - Ensure method names and behaviours match (`listen`, `listenToAll`, `subscribed`, `error`, whisper helpers, notification helpers).
     - Confirm presence channel interface parity (here/joining/leaving/whisper).
   - Implement missing channel classes:
     - `SocketIoChannel`, `SocketIoPrivateChannel`, `SocketIoPresenceChannel`.
     - `NullEncryptedPrivateChannel` if not already present to fully match upstream null behaviour.
   - Align exports with upstream:
     - Ensure `packages/echo/src/channel/index.ts` exports the same set of channel types as upstream.
2. Connectors:
   - Port `NullConnector` into `packages/echo/src/connector/null-connector.ts`:
     - No-op connect/leave/disconnect, but returns proper Null channel instances and a stable fake socket id.
   - Port `SocketIoConnector` into `packages/echo/src/connector/socketio-connector.ts`:
     - Accept socket.io client via `options.client` or global `window.io`.
     - Mirror reconnection semantics and channel resubscription logic.
   - Update `packages/echo/src/connector/index.ts` to export new connectors.
   - Ensure the base `Connector` remains environment-safe:
     - CSRF token extraction logic aligns with upstream but checks for `window`/`document` existence.

### Phase 3 – React Package: Remove `laravel-echo` Runtime Dependency

1. Types:
   - Update `packages/echo/src/react/types.ts` to import `BroadcastDriver`, `Broadcaster` and related types from **local** `packages/echo/src/types` instead of `laravel-echo`.
   - Keep the API surface identical so React consumers see no type-level breaking changes.
2. Config:
   - Update `packages/echo/src/react/config/index.ts`:
     - Import the local `Echo` class and types from `@revurb/echo` instead of `laravel-echo`.
     - Keep the current demo-friendly `configureEcho` signature, but:
       - Support optional `ConfigDefaults` mapping similar to upstream (using explicit config rather than `import.meta.env`).
       - Factor out the defaults so other apps can opt into environment-based defaults later.
     - Continue to inject `Pusher` constructor into the config (`echoConfig.Pusher ??= Pusher`), but use local types.
3. Hooks:
   - Compare `packages/echo/src/react/hooks/use-echo.ts` with `_source/echo/packages/react/src/hooks/use-echo.ts` and:
     - Ensure the subscription reference counting, `leaveChannel` semantics, and re-subscription behaviour are the same.
     - Replace any residual `any[]` or loose typing with strict, local types, aligned with repo standards.
4. Demo app verification:
   - Point `apps/demo` at the updated `@revurb/echo/react` without `laravel-echo` in the dependency graph.
   - Verify:
     - Connection lifecycle status updates.
     - Private channel subscription.
     - Client events via `pusher.send_event`.

### Phase 4 – Interceptors & X-Socket-Id (Optional but Parity-Oriented)

1. Strategy:
   - Decide on a default stance:
     - Option A: Keep interceptors disabled by default, but fully implement them behind `withoutInterceptors: false`.
     - Option B: Extract interceptors into a separate small helper (`@revurb/echo/interceptors`) that can be opt-in imported.
2. Implementation:
   - Port the upstream interceptor logic into a dedicated module:
     - `registerAxiosInterceptor`, `registerVueInterceptor`, `registerJQueryInterceptor`, `registerTurboInterceptor`.
     - Each helper takes an `Echo` instance (or function to get `socketId`) instead of importing it directly.
   - Have `Echo.registerInterceptors()` call these helpers conditionally, matching upstream semantics but keeping the code tree-shakable.
3. Documentation:
   - Clearly document how to enable interceptors in browser apps, and how they interact with Laravel backends expecting `X-Socket-Id`.

### Phase 5 – Packaging & Dependency Cleanup

1. Package dependencies:
   - Remove `laravel-echo` from `packages/echo/package.json` dependencies once:
     - Local `Echo` and types are complete.
     - React hooks/types are using local definitions.
   - Keep `pusher-js` as a dependency for now; consider making it a peer dependency later if needed.
   - Add optional peer dependency for `socket.io-client` if/when `SocketIoConnector` is enabled.
2. Build pipeline:
   - Ensure `bun build` still produces:
     - ESM bundles for core (`dist/index.js`) and React (`dist/react/index.js`).
     - Type declarations via `tsc`.
   - Verify tree-shaking friendliness:
     - Interceptors and optional connectors should not bloat bundles if unused.
3. Versioning & release:
   - Bump `@revurb/echo` minor version (e.g. `0.2.x`) for the fully local Echo implementation.
   - Note in the changelog that `laravel-echo` is no longer required at runtime.

### Phase 6 – Tests, Docs & Examples

1. Tests:
   - Expand test coverage to include:
     - All drivers we support (`reverb`, `pusher`, `null`, and optionally `socket.io`).
     - React hooks lifecycle under mount/unmount, dependency changes, and multiple subscribers.
   - Add lightweight tests for interceptors (can be smoke-style with simple mocks).
2. Documentation:
   - Add or update docs for Echo usage:
     - Basic setup with `configureEcho` and `useEcho`.
     - Multi-driver configuration with `reverb`, `pusher`, `null`, and optional `socket.io`.
     - Interceptors and `X-Socket-Id` behaviour (if implemented).
   - Cross-link from `docs/contributing.md` to this migration plan as the reference for Echo parity work.
3. Examples:
   - Extend `apps/demo` or add a new example to showcase:
     - Presence channels.
     - Notifications and `useEchoNotification`.
     - Public channels and `useEchoPublic`.

## 5. Open Questions

- Do we want first-class support for `socket.io` and `ably` in Revurb v1, or is `"reverb" + "pusher" + "null"` sufficient for the initial release?
- Should interceptors live:
  - Inside the main `Echo` bundle (parity, simpler), or
  - In a separate opt-in module (`@revurb/echo/interceptors`) to keep the default bundle minimal?
- What minimum browser/Node/Bun environments do we target for Echo, and how aggressively should we guard global usages (`window`, `document`, `Vue`, `axios`, `jQuery`, `Turbo`)?

