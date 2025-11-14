last commit: 3b7672a48bd76bed135e7bdcd394589ccd5f89a1
status: not ok
review comments:
- `.github/workflows/example-tests.yml:52` – The WebSocket smoke-test step invokes `bun run -e`, but `bun run` expects a script name and ignores `-e/--eval`, so this command simply prints the usage text and exits successfully without ever running the connection check. As written, the workflow never exercises the WebSocket client and cannot catch regressions. Use `bun -e '...'` (or another runner such as `node -e`) so the inline script actually executes.
