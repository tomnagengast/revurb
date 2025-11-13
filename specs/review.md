last commit: 5cc2089502762ffa018cb3ab7b0343b9e9976e0c
status: not ok
review comments:
- `revurb-ts/docker-compose.yml:18-37` defines the Bun app service but never sets `REVERB_APP_KEY`, `REVERB_APP_SECRET`, or `REVERB_APP_ID`, and `loadReverbAppConfig` throws when those env vars are undefined (`revurb-ts/src/config/load.ts:186-195`), so `docker compose up` will still exit immediately. Provide placeholder credentials or point the container at a config file so the server can boot.
