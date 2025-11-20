import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Socket } from "socket.io-client";
import { SocketIoChannel } from "../../src/channel";
import { Connector } from "../../src/connector";

describe("SocketIoChannel", () => {
  let channel: SocketIoChannel;
  let socket: Socket;

  beforeEach(() => {
    const channelName = "some.channel";
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation
    let listeners: [string, (...args: any[]) => void][] = [];
    socket = {
      // biome-ignore lint/suspicious/noExplicitAny: Mock implementation
      emit: (event: string, data: any) => {
        listeners
          .filter(([e]) => e === event)
          .forEach(([, fn]) => {
            fn(channelName, data);
          });
      },
      // biome-ignore lint/suspicious/noExplicitAny: Mock implementation
      on: (event: string, fn: (...args: any[]) => void) => {
        listeners.push([event, fn]);
        return socket;
      },
      // biome-ignore lint/suspicious/noExplicitAny: Mock implementation
      removeListener: (event: string, fn: (...args: any[]) => void) => {
        listeners = listeners.filter(([e, f]) =>
          !fn ? e !== event : e !== event || f !== fn,
        );
        return socket;
      },
    } as unknown as Socket;

    channel = new SocketIoChannel(socket, channelName, {
      broadcaster: "socket.io",
      ...Connector._defaultOptions,
      namespace: false,
    });
  });

  test("triggers all listeners for an event", () => {
    const l1 = mock();
    const l2 = mock();
    const l3 = mock();
    channel.listen("MyEvent", l1);
    channel.listen("MyEvent", l2);
    channel.listen("MyOtherEvent", l3);

    socket.emit("MyEvent", {});

    expect(l1).toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
    expect(l3).not.toHaveBeenCalled();

    socket.emit("MyOtherEvent", {});

    expect(l3).toHaveBeenCalled();
  });

  test("can remove a listener for an event", () => {
    const l1 = mock();
    const l2 = mock();
    const l3 = mock();
    channel.listen("MyEvent", l1);
    channel.listen("MyEvent", l2);
    channel.listen("MyOtherEvent", l3);

    channel.stopListening("MyEvent", l1);

    socket.emit("MyEvent", {});

    expect(l1).not.toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
    expect(l3).not.toHaveBeenCalled();

    socket.emit("MyOtherEvent", {});

    expect(l3).toHaveBeenCalled();
  });

  test("can remove all listeners for an event", () => {
    const l1 = mock();
    const l2 = mock();
    const l3 = mock();
    channel.listen("MyEvent", l1);
    channel.listen("MyEvent", l2);
    channel.listen("MyOtherEvent", l3);

    channel.stopListening("MyEvent");

    socket.emit("MyEvent", {});

    expect(l1).not.toHaveBeenCalled();
    expect(l2).not.toHaveBeenCalled();
    expect(l3).not.toHaveBeenCalled();

    socket.emit("MyOtherEvent", {});

    expect(l3).toHaveBeenCalled();
  });
});
