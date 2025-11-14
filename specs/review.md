last commit: f675ce14c6113d0df8003a26cf47b7494e9460b4
status: ok
review comments:
- Example integration looks good—`example/src/index.ts:1` now bootstraps Revurb via `createServer` before launching the frontend server, wiring graceful shutdown to `SIGINT/SIGTERM` as required by specs. README instructions (`README.md:181`) were updated to match the new single-process workflow. No regressions observed. Residual risk: we could not run the dev server to completion because port 3000 is already occupied on this host, so the end-to-end example wasn’t smoke-tested here.
