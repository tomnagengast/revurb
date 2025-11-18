# Plan: Update Example createServer Integration

## Metadata

prompt: `update the example app to import createServer for it's revurb integration`
task_type: enhancement
complexity: simple

## Task Description

The example React/Bun app should no longer depend solely on the CLI-based Revurb server. Instead, it needs to demonstrate how to embed Revurb directly by importing the exported `createServer` helper, initializing it with the bundled `reverb.config.ts`, and ensuring the example continues to serve its frontend via Bun while the WebSocket backend runs in the same process. Documentation should reflect the new workflow so developers can run the example and observe the programmatic integration point.

## Objective

Ensure the example application boots its Revurb backend by calling `createServer` with the local config before starting its existing Bun HTTP server, and document how to run and verify that setup.

## Relevant Files

- `README.md` – Update the "Example Application" section so developers know the example now imports `createServer`, how to run it, and what output to expect.
- `example/reverb.config.ts` – Confirm it exposes the shape expected by `createServer` and adjust defaults (host/path/origins) if tighter integration is needed.
- `example/src/index.ts` – Main entry where `createServer` should be imported and awaited alongside the Bun `serve` call, including lifecycle/logging tweaks so both servers coexist and share shutdown signals.
- `src/index.ts` – Verify `createServer` is exported from the package so the example can import it directly; adjust exports if necessary.

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

### 1. Review createServer Contract

- Read `src/index.ts` and `src/servers/reverb/factory.ts` to confirm the `createServer` signature, defaults, and expectations for config loading/shutdown helpers.
- Note any required env vars or Bun-specific helpers (e.g., `Bun.env`, `Bun.file`) we should use inside the example to keep parity with the main server setup.

### 2. Bootstrap Revurb Inside the Example Entry Point

- Update `example/src/index.ts` to import `createServer` from the package plus the local `reverb.config.ts`, then await `createServer({ config })` before calling `serve` for the frontend. Keep the logic inside a single async bootstrap function with minimal branching per AGENTS guidelines.
- Capture the returned `shutdown` (and any other handles) so process signals or Bun's hot-reload hooks can cleanly stop the WebSocket server; prefer Bun APIs (`Bun.env`, `Bun.gc`, etc.) where relevant.
- Ensure logging clearly reports both the Revurb WebSocket endpoint and the frontend dev server URL so devs understand what started.

### 3. Document the New Workflow

- Update the "Example" section in `README.md` (or add a short `example/README` if needed) to explain that the example now imports `createServer`, highlight the config file it uses, and outline how to run it (including expected ports, credentials, and shutdown behavior).
- Mention any prerequisites (e.g., Bun version, environment variables) so someone running `bun run dev` inside `example/` immediately benefits from the embedded Revurb server.

### 4. Validate the Integration

- From the repo root and from `example/`, run the dev script to ensure both the WebSocket backend and the frontend start without runtime errors, hot-reload still works, and logs confirm the WebSocket server is bound to the configured host/port.
- Manually open the example UI to confirm it can connect via WebSocket to the embedded Revurb instance (smoke test sending a message or checking the console for successful connection).

## Acceptance Criteria

- Example code imports `createServer` directly from `revurb` and initializes it with the local config before serving the frontend.
- The `shutdown` handle is wired to Bun's process lifecycle so exiting the dev server tears down Revurb cleanly.
- Documentation clearly states the new behavior and instructions for running/connecting to the example.
- Running `bun run dev` inside `example/` starts both the frontend and Revurb backend without throwing errors.

## Validation Commands

- `bun run dev` – from the repo root if a combined script exists, to ensure the package still starts normally.
- `cd example && bun run dev` – confirm the example now launches both the Revurb backend and the frontend.

## Notes

- Follow AGENTS.md constraints while editing (avoid unnecessary `else`/`try`/`catch`, minimize `let`, keep variables terse, and lean on Bun APIs like `Bun.file`/`Bun.env`).
