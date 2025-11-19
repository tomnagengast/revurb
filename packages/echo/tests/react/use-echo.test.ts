import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { Window } from "happy-dom";
import { configureEcho } from "../../src/react/config";
import * as useEchoModule from "../../src/react/hooks/use-echo";

// Set up DOM environment
const window = new Window();
const document = window.document;
// @ts-expect-error - setting up global DOM for tests
global.window = window;
// @ts-expect-error - setting up global DOM for tests
global.document = document;

// Mock Echo for testing
const createMockEcho = () => {
  const mockPrivateChannel = {
    leaveChannel: () => {},
    listen: () => {},
    stopListening: () => {},
    notification: () => {},
    stopListeningForNotification: () => {},
  };

  const mockPublicChannel = {
    leaveChannel: () => {},
    listen: () => {},
    stopListening: () => {},
  };

  const mockPresenceChannel = {
    leaveChannel: () => {},
    listen: () => {},
    stopListening: () => {},
    here: () => {},
    joining: () => {},
    leaving: () => {},
    whisper: () => {},
  };

  return {
    private: () => mockPrivateChannel,
    channel: () => mockPublicChannel,
    encryptedPrivate: () => {},
    listen: () => {},
    leave: () => {},
    leaveChannel: () => {},
    leaveAllChannels: () => {},
    join: () => mockPresenceChannel,
    options: { broadcaster: "null" },
  } as unknown as Echo<"null">;
};

describe("useEcho hook", () => {
  beforeEach(() => {
    configureEcho({
      broadcaster: "null",
    });
  });

  afterEach(() => {
    // Clean up any configured echo
  });

  test("subscribes to a channel and listens for events", () => {
    const mockCallback = () => {};
    const channelName = "test-channel";
    const event = "test-event";

    const { result } = renderHook(() =>
      useEchoModule.useEcho(channelName, event, mockCallback),
    );

    expect(result.current).toHaveProperty("leaveChannel");
    expect(typeof result.current.leave).toBe("function");
    expect(result.current).toHaveProperty("leave");
    expect(typeof result.current.leaveChannel).toBe("function");
  });

  // Additional tests will be added as we expand the test coverage
  // See upstream tests in _source/echo/packages/react/tests/use-echo.test.ts
  // for full test suite reference
});
