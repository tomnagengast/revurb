last commit: 921afed
status: not ok
review comments:
- README.md: The environment variable table now claims `REVERB_SERVER_HOST` defaults to `127.0.0.1`, but `loadReverbServerConfig()` still binds to `0.0.0.0` (src/config/load.ts:121) so the documentation promises a safer default than the code actually provides. Either change the default or fix the README so users understand the server listens on all interfaces by default.
