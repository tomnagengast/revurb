last commit: 959b211897caffe3d892ad93abb326e68a99eb1f
status: ok
review comments:
- `.github/workflows/example-tests.yml:52` – The smoke-test step now runs the inline client via `bun -e`, so the script truly opens a WebSocket connection and fails on errors or timeouts. Confirmed locally that Bun resolves the `ws` import without any additional dependencies, so the workflow now exercises the Pusher path as intended.
