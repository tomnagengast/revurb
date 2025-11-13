last commit: 2724186dc1f2d7c40ec11c72db4d80bf8b8575e1
status: not ok
review comments:
- `revurb-ts/src/cli.ts:221-254` – `setupEventListeners()` now calls `logger.debug(...)`, but `Factory.getLogger()` returns either `CliLogger` or `NullLogger`, and neither class nor the `ILogger` contract defines a `debug` method. As soon as debug mode is enabled and any event fires, the process will throw “logger.debug is not a function” and crash. Use an existing logger method (e.g., `info`) or extend the logger contract/implementations to support `debug`.
