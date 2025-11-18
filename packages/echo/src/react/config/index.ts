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
  const defaults: Record<string, Record<string, unknown>> = {
    reverb: {
      broadcaster: "reverb",
      enabledTransports: ["ws", "wss"],
    },
    pusher: {
      broadcaster: "pusher",
      forceTLS: true,
      enabledTransports: ["ws", "wss"],
    },
    "socket.io": {
      broadcaster: "socket.io",
    },
    null: {
      broadcaster: "null",
    },
    ably: {
      broadcaster: "pusher",
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
