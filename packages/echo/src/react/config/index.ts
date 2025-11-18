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

export const configureEcho = <T extends BroadcastDriver>(
  config: EchoOptions<T>,
): void => {
  const reverbPort =
    import.meta.env.BUN_PUBLIC_REVERB_PORT ?? import.meta.env.VITE_REVERB_PORT;
  const pusherPort =
    import.meta.env.BUN_PUBLIC_PUSHER_PORT ?? import.meta.env.VITE_PUSHER_PORT;

  const defaults: Record<string, Record<string, unknown>> = {
    reverb: {
      broadcaster: "reverb",
      key:
        import.meta.env.BUN_PUBLIC_REVERB_APP_KEY ??
        import.meta.env.VITE_REVERB_APP_KEY,
      wsHost:
        import.meta.env.BUN_PUBLIC_REVERB_HOST ??
        import.meta.env.VITE_REVERB_HOST,
      wsPort: reverbPort ? Number.parseInt(reverbPort, 10) : undefined,
      wssPort: reverbPort ? Number.parseInt(reverbPort, 10) : undefined,
      forceTLS:
        (import.meta.env.BUN_PUBLIC_REVERB_SCHEME ??
          import.meta.env.VITE_REVERB_SCHEME ??
          "https") === "https",
      enabledTransports: ["ws", "wss"],
    },
    pusher: {
      broadcaster: "pusher",
      key:
        import.meta.env.BUN_PUBLIC_PUSHER_APP_KEY ??
        import.meta.env.VITE_PUSHER_APP_KEY,
      cluster:
        import.meta.env.BUN_PUBLIC_PUSHER_APP_CLUSTER ??
        import.meta.env.VITE_PUSHER_APP_CLUSTER,
      forceTLS: true,
      wsHost:
        import.meta.env.BUN_PUBLIC_PUSHER_HOST ??
        import.meta.env.VITE_PUSHER_HOST,
      wsPort: pusherPort ? Number.parseInt(pusherPort, 10) : undefined,
      wssPort: pusherPort ? Number.parseInt(pusherPort, 10) : undefined,
      enabledTransports: ["ws", "wss"],
    },
    "socket.io": {
      broadcaster: "socket.io",
      host:
        import.meta.env.BUN_PUBLIC_SOCKET_IO_HOST ??
        import.meta.env.VITE_SOCKET_IO_HOST,
    },
    null: {
      broadcaster: "null",
    },
    ably: {
      broadcaster: "pusher",
      key:
        import.meta.env.BUN_PUBLIC_ABLY_PUBLIC_KEY ??
        import.meta.env.VITE_ABLY_PUBLIC_KEY,
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
