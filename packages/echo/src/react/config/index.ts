import Echo, { type BroadcastDriver, type EchoOptions } from "laravel-echo";
import Pusher from "pusher-js";

let echoInstance: Echo<BroadcastDriver> | null = null;
let echoConfig: EchoOptions<BroadcastDriver> | null = null;

const getEchoInstance = <T extends BroadcastDriver>(): Echo<T> => {
  if (echoInstance) {
    return echoInstance as Echo<T>;
  }

  if (!echoConfig) {
    throw new Error(
      "Echo has not been configured. Please call `configureEcho()`.",
    );
  }

  echoConfig.Pusher ??= Pusher;

  echoInstance = new Echo(echoConfig);

  return echoInstance as Echo<T>;
};

const getEnv = (key: string): string | undefined => {
  return process.env[key];
};

export const configureEcho = <T extends BroadcastDriver>(
  config: EchoOptions<T>,
): void => {
  const reverbPort =
    getEnv("BUN_PUBLIC_REVERB_PORT") ?? getEnv("VITE_REVERB_PORT");
  const pusherPort =
    getEnv("BUN_PUBLIC_PUSHER_PORT") ?? getEnv("VITE_PUSHER_PORT");

  const defaults: Record<string, Record<string, unknown>> = {
    reverb: {
      broadcaster: "reverb",
      key: getEnv("BUN_PUBLIC_REVERB_APP_KEY") ?? getEnv("VITE_REVERB_APP_KEY"),
      wsHost: getEnv("BUN_PUBLIC_REVERB_HOST") ?? getEnv("VITE_REVERB_HOST"),
      wsPort: reverbPort ? Number.parseInt(reverbPort, 10) : undefined,
      wssPort: reverbPort ? Number.parseInt(reverbPort, 10) : undefined,
      forceTLS:
        (getEnv("BUN_PUBLIC_REVERB_SCHEME") ??
          getEnv("VITE_REVERB_SCHEME") ??
          "https") === "https",
      enabledTransports: ["ws", "wss"],
    },
    pusher: {
      broadcaster: "pusher",
      key: getEnv("BUN_PUBLIC_PUSHER_APP_KEY") ?? getEnv("VITE_PUSHER_APP_KEY"),
      cluster:
        getEnv("BUN_PUBLIC_PUSHER_APP_CLUSTER") ??
        getEnv("VITE_PUSHER_APP_CLUSTER"),
      forceTLS: true,
      wsHost: getEnv("BUN_PUBLIC_PUSHER_HOST") ?? getEnv("VITE_PUSHER_HOST"),
      wsPort: pusherPort ? Number.parseInt(pusherPort, 10) : undefined,
      wssPort: pusherPort ? Number.parseInt(pusherPort, 10) : undefined,
      enabledTransports: ["ws", "wss"],
    },
    "socket.io": {
      broadcaster: "socket.io",
      host:
        getEnv("BUN_PUBLIC_SOCKET_IO_HOST") ?? getEnv("VITE_SOCKET_IO_HOST"),
    },
    null: {
      broadcaster: "null",
    },
    ably: {
      broadcaster: "pusher",
      key:
        getEnv("BUN_PUBLIC_ABLY_PUBLIC_KEY") ?? getEnv("VITE_ABLY_PUBLIC_KEY"),
      wsHost: "realtime-pusher.ably.io",
      wsPort: 443,
      disableStats: true,
      encrypted: true,
    },
  };

  echoConfig = {
    ...defaults[config.broadcaster],
    ...config,
  } as EchoOptions<BroadcastDriver>;

  if (echoInstance) {
    echoInstance = null;
  }
};

export const echo = <T extends BroadcastDriver>(): Echo<T> =>
  getEchoInstance<T>();

export const echoIsConfigured = () => echoConfig !== null;
