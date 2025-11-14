last commit: 730dd6236748a050014e9d4a652dcb88fbaa6fbe
status: not ok
review comments:
- .github/workflows/spec-tests.yml:1 – Removing the workflow entirely means CI no longer runs the Autobahn spec suite, so we have zero protocol coverage or regression detection. The ask was to repoint the job at revurb-ts, not delete it, so we still need a workflow that exercises the TypeScript spec harness.
- example/src/Chat.tsx:10 – Hard-coding `getDefaultServer()` to `ws://localhost:8080` regresses the location-aware default, so HTTPS deployments now try to open an insecure localhost socket and fail before the user can interact. Keep the host/scheme detection when `window.location` exists and only fall back to localhost when rendering outside the browser.
