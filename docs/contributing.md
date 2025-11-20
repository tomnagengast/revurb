<!-- Imported from: docs/contributing.md -->
# Contributing to Revurb

This document outlines the development philosophy, architecture decisions, and coding standards for the Revurb project.

## Philosophy

**"Architectural Parity, Syntactical Idiom"**

Revurb is a TypeScript port of [Laravel Reverb](https://laravel.com/docs/reverb). Our primary goal is to create a robust, scalable WebSocket server for the Bun runtime that maintains close architectural alignment with the upstream PHP codebase.

### Why Parity?
*   **Maintainability:** Makes it easier to port bug fixes and new features from Laravel Reverb.
*   **Familiarity:** Developers familiar with Laravel's internals should feel at home in this codebase.
*   **Reliability:** Reverb's architecture is battle-tested; we want to preserve that stability.

### Why Idiom?
*   **Performance:** We leverage Bun's native features (like its HTTP server and WebSocket implementation) rather than blindly copying PHP logic that doesn't fit the runtime.
*   **Ecosystem:** We use standard TypeScript/JavaScript patterns where strictly adhering to PHP syntax would be awkward or inefficient.

## Echo Client

For information on the Echo client port, usage, and migration status, please see:
*   [Echo Client Documentation](./echo.md)
*   [Echo Migration Plan](../specs/2025-11-19-echo-migration-plan.md)

## Coding Standards

### 1. Method Naming & "Magic" Methods

*   **Request Handlers:** Use `handle()` for Single Action Controllers or main entry points.
    *   *PHP:* `__invoke()`
    *   *TS:* `handle()`
    *   *Reason:* `__invoke` is a PHP-ism. `handle` is the standard JS convention.
*   **Underscore Methods:** We generally avoid `_` prefixes for private methods unless it is required to resolve a naming collision with a getter.

### 2. Properties & Accessors

In PHP, it is common to have a protected property `$name` and a public method `name()` to access it. In TypeScript, you cannot have a property and method with the exact same name on the class.

**Pattern:** Use a private backing field with an underscore prefix and a public getter method.

```typescript
export class Application {
  // Private backing field
  constructor(private readonly _id: string) {}

  // Public getter matching upstream PHP method name
  id(): string {
    return this._id;
  }
}
```

This allows the public API `app.id()` to exactly match the PHP `app->id()`.

### 3. Terminology

We adhere to the following terminology to clarify intent:

*   **Whisper:** Client-to-client events (typically prefixed with `client-`). This is the *client-side* action.
*   **Dispatch / Broadcast:** The *server-side* action of sending an event to subscribers.
    *   *Note:* If you see `dispatch` used in places where Echo uses `whisper`, it is because we are in the server context handling the message dispatching.

### 4. Path Aliases

Avoid relative path hell (`../../../../`). Use the configured path aliases:

*   `@/*` maps to `./src/*`

**Example:**
```typescript
// Bad
import { Application } from "../../../application";

// Good
import { Application } from "@/application";
```

### 5. Strict Typing

*   No `any`. Use `unknown` if the type is truly not known, and narrow it.
*   Enable `strict: true` in `tsconfig.json`.
*   Interfaces (`IInterface`) are used to define contracts, similar to PHP Interfaces.

## Architecture

### Service Providers & Managers
We maintain the concept of "Managers" (e.g., `ApplicationManager`) to handle driver-based logic, mirroring Laravel's Manager pattern. Since Bun doesn't have a global service container by default, we use explicit dependency injection or Factory patterns.

### Factory Pattern
The `Factory` class in `src/servers/reverb/factory.ts` serves as the composition root, wiring up:
*   Loop / Server (Bun.serve)
*   Router
*   Controllers
*   Managers (ChannelManager, ApplicationManager)
*   Providers (RedisPubSubProvider)

### Directory Structure
We strive to mirror the upstream directory structure where possible:

```
packages/revurb/src/
├── config/             # Configuration types and loaders
├── contracts/          # Interfaces (Contracts)
├── events/             # Internal events (MessageReceived, etc.)
├── protocols/          # Protocol implementations (Pusher)
│   └── pusher/
│       ├── channels/   # Channel logic
│       ├── http/       # HTTP Controllers
│       └── ...
├── servers/
│   └── reverb/         # Main server logic
└── ...
```

## Workflow for Porting

1.  **Analyze Upstream:** Read the PHP code in `_source/reverb`. Understand *what* it does and *why*.
2.  **Map to TS:** Plan the TypeScript class structure.
    *   Does it need an Interface?
    *   Are there PHP-isms (`__invoke`, traits) that need adaptation?
3.  **Implement:** Write the code using Bun/TS idioms.
4.  **Verify:** Write tests that mirror the upstream behavior.