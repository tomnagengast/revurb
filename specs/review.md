last commit: d31bd9b
status: not ok
review comments:
- example/src/Chat.tsx:11 – `getDefaultServer()` now points to whatever host serves the React UI, so the chat demo defaults to `ws://localhost:3000` (or 5173) even though the Revurb daemon still listens on 8080 (see example/reverb.config.ts:5). The first connection attempt now always fails until the user manually edits the field.
- .github/workflows/spec-tests.yml:37 – The workflow still `cd`s into `reverb/tests/Specification`, but commit 6b5754c removed that directory and .gitignore:12 now excludes it, so CI can no longer run the Autobahn spec suite.
- LICENSE.md – The only license file was deleted even though package.json:13 still declares MIT and its `files` list expects LICENSE.md, leaving the project effectively unlicensed.
