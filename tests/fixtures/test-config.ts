export default {
  default: "test",
  servers: {
    test: {
      host: "127.0.0.1",
      port: 0,
    },
  },
  apps: {
    provider: "config",
    apps: [
      {
        key: "fixture-key",
        secret: "fixture-secret",
        app_id: "fixture-app",
      },
    ],
  },
};
