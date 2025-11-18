import type { BroadcastDriver } from "laravel-echo";
import { useCallback, useEffect, useRef } from "react";
import { echo } from "../config";
import type {
  BroadcastNotification,
  Channel,
  ChannelData,
  ChannelReturnType,
  Connection,
  ModelEvents,
  ModelPayload,
} from "../types";
import { toArray } from "../util";

const channels: Record<string, ChannelData<BroadcastDriver>> = {};

const subscribeToChannel = <T extends BroadcastDriver>(
  channel: Channel,
): Connection<T> => {
  const instance = echo<T>();

  if (channel.visibility === "presence") {
    return instance.join(channel.name);
  }

  if (channel.visibility === "private") {
    return instance.private(channel.name);
  }

  return instance.channel(channel.name);
};

const leaveChannel = (channel: Channel, leaveAll: boolean): void => {
  const channelData = channels[channel.id];
  if (!channelData) {
    return;
  }

  channelData.count -= 1;

  if (channelData.count > 0) {
    return;
  }

  if (leaveAll) {
    echo().leave(channel.name);
  } else {
    echo().leaveChannel(channel.id);
  }

  delete channels[channel.id];
};

const resolveChannelSubscription = <T extends BroadcastDriver>(
  channel: Channel,
): Connection<T> => {
  const channelData = channels[channel.id];
  if (channelData) {
    channelData.count += 1;

    return channelData.connection;
  }

  const channelSubscription = subscribeToChannel<T>(channel);

  channels[channel.id] = {
    count: 1,
    connection: channelSubscription,
  };

  return channelSubscription;
};

export const useEcho = <
  TPayload,
  TDriver extends BroadcastDriver = BroadcastDriver,
  TVisibility extends Channel["visibility"] = "private",
>(
  channelName: string,
  event: string | string[] = [],
  callback: (payload: TPayload) => void = () => {},
  dependencies: unknown[] = [],
  visibility: TVisibility = "private" as TVisibility,
) => {
  const channel: Channel = {
    name: channelName,
    id: ["private", "presence"].includes(visibility)
      ? `${visibility}-${channelName}`
      : channelName,
    visibility,
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
  const callbackFunc = useCallback(callback, dependencies);
  const listening = useRef(false);
  const initialized = useRef(false);
  const subscription = useRef<Connection<TDriver>>(
    resolveChannelSubscription<TDriver>(channel),
  );

  const events = toArray(event);

  const stopListening = useCallback(() => {
    if (!listening.current) {
      return;
    }

    events.forEach((e) => {
      subscription.current.stopListening(e, callbackFunc);
    });

    listening.current = false;
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
  }, dependencies);

  const listen = useCallback(() => {
    if (listening.current) {
      return;
    }

    events.forEach((e) => {
      subscription.current.listen(e, callbackFunc);
    });

    listening.current = true;
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
  }, dependencies);

  const tearDown = useCallback((leaveAll: boolean = false) => {
    stopListening();

    leaveChannel(channel, leaveAll);
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
  }, dependencies);

  const leave = useCallback(() => {
    tearDown(true);
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
  }, dependencies);

  useEffect(() => {
    if (initialized.current) {
      subscription.current = resolveChannelSubscription<TDriver>(channel);
    }

    initialized.current = true;

    listen();

    return tearDown;
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
  }, dependencies);

  return {
    leaveChannel: tearDown,
    leave,
    stopListening,
    listen,
    channel: () =>
      subscription.current as ChannelReturnType<TDriver, TVisibility>,
  };
};

export const useEchoNotification = <
  TPayload,
  TDriver extends BroadcastDriver = BroadcastDriver,
>(
  channelName: string,
  callback: (payload: BroadcastNotification<TPayload>) => void = () => {},
  event: string | string[] = [],
  dependencies: unknown[] = [],
) => {
  const result = useEcho<BroadcastNotification<TPayload>, TDriver, "private">(
    channelName,
    [],
    callback,
    dependencies,
    "private",
  );

  const events = useRef(
    toArray(event).flatMap((e) => {
      if (e.includes(".")) {
        return [e, e.replace(/\./g, "\\")];
      }

      return [e, e.replace(/\\/g, ".")];
    }),
  );
  const listening = useRef(false);
  const initialized = useRef(false);

  const cb = useCallback(
    (notification: BroadcastNotification<TPayload>) => {
      if (!listening.current) {
        return;
      }

      if (
        events.current.length === 0 ||
        events.current.includes(notification.type)
      ) {
        callback(notification);
      }
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
    dependencies
      .concat(events.current)
      .concat([callback]),
  );

  const listen = useCallback(() => {
    if (listening.current) {
      return;
    }

    if (!initialized.current) {
      result.channel().notification(cb);
    }

    listening.current = true;
    initialized.current = true;
  }, [cb, result.channel]);

  const stopListening = useCallback(() => {
    if (!listening.current) {
      return;
    }

    result.channel().stopListeningForNotification(cb);

    listening.current = false;
  }, [cb, result.channel]);

  useEffect(() => {
    listen();

    return () => stopListening();
    // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies passed as parameter
  }, dependencies.concat(events.current));

  return {
    ...result,
    stopListening,
    listen,
  };
};

export const useEchoPresence = <
  TPayload,
  TDriver extends BroadcastDriver = BroadcastDriver,
>(
  channelName: string,
  event: string | string[] = [],
  callback: (payload: TPayload) => void = () => {},
  dependencies: unknown[] = [],
) => {
  return useEcho<TPayload, TDriver, "presence">(
    channelName,
    event,
    callback,
    dependencies,
    "presence",
  );
};

export const useEchoPublic = <
  TPayload,
  TDriver extends BroadcastDriver = BroadcastDriver,
>(
  channelName: string,
  event: string | string[] = [],
  callback: (payload: TPayload) => void = () => {},
  dependencies: unknown[] = [],
) => {
  return useEcho<TPayload, TDriver, "public">(
    channelName,
    event,
    callback,
    dependencies,
    "public",
  );
};

export const useEchoModel = <
  TPayload,
  TModel extends string,
  TDriver extends BroadcastDriver = BroadcastDriver,
>(
  model: TModel,
  identifier: string | number,
  event: ModelEvents<TModel> | ModelEvents<TModel>[] = [],
  callback: (payload: ModelPayload<TPayload>) => void = () => {},
  dependencies: unknown[] = [],
) => {
  return useEcho<ModelPayload<TPayload>, TDriver, "private">(
    `${model}.${identifier}`,
    toArray(event).map((e) => (e.startsWith(".") ? e : `.${e}`)),
    callback,
    dependencies,
    "private",
  );
};
