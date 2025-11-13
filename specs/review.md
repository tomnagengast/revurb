last commit: aff0f08
status: not ok
review comments:
- `tests/feature/health-check-controller.test.ts:2`, `tests/e2e/private-channel.test.ts:4`, and the other spec/e2e suites still import `../../src/Servers/Reverb/factory`, but the directory on disk is `src/servers/reverb`. On CI’s case-sensitive filesystem Bun can’t resolve the module (see the current `bun test` failure: “Cannot find module '../../loggers/cli-logger' from '/home/runner/work/revurb/revurb/src/Servers/Reverb/factory.ts'”), so every workflow run is red. Please reconcile the import paths (and any remaining uppercase references) so GH Actions pass again.
