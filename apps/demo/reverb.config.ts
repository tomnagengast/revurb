import type { ReverbConfig } from "../../src/index";

export default {
  default: "reverb",
  servers: {
    reverb: {
      host: "0.0.0.0",
      port: Bun.env.REVERB_PORT ?? 8080,
    },
  },
  apps: {
    provider: "config",
    apps: [
      {
        app_id: Bun.env.BUN_PUBLIC_REVERB_APP_ID ?? "my-app-id",
        key: Bun.env.BUN_PUBLIC_REVERB_APP_KEY ?? "my-app-key",
        secret: Bun.env.BUN_PUBLIC_REVERB_APP_SECRET ?? "my-app-secret",
        allowed_origins: ["*"],
      },
    ],
  },
} as ReverbConfig;
