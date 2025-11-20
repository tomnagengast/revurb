import { describe, expect, test } from "bun:test";
import {
  NullChannel,
  NullEncryptedPrivateChannel,
  NullPresenceChannel,
  NullPrivateChannel,
} from "../../src/channel";
import { NullConnector } from "../../src/connector/null-connector";

describe("NullConnector", () => {
  test("it can be instantiated", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    expect(connector).toBeInstanceOf(NullConnector);
  });

  test("connect does nothing", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    expect(() => connector.connect()).not.toThrow();
  });

  test("channel returns NullChannel", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    const channel = connector.channel("test");
    expect(channel).toBeInstanceOf(NullChannel);
  });

  test("privateChannel returns NullPrivateChannel", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    const channel = connector.privateChannel("test");
    expect(channel).toBeInstanceOf(NullPrivateChannel);
  });

  test("encryptedPrivateChannel returns NullEncryptedPrivateChannel", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    const channel = connector.encryptedPrivateChannel("test");
    expect(channel).toBeInstanceOf(NullEncryptedPrivateChannel);
  });

  test("presenceChannel returns NullPresenceChannel", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    const channel = connector.presenceChannel("test");
    expect(channel).toBeInstanceOf(NullPresenceChannel);
  });

  test("listen returns NullChannel", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    const channel = connector.listen("test", "event", () => {});
    expect(channel).toBeInstanceOf(NullChannel);
  });

  test("leave does nothing", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    expect(() => connector.leave("test")).not.toThrow();
  });

  test("leaveChannel does nothing", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    expect(() => connector.leaveChannel("test")).not.toThrow();
  });

  test("socketId returns fake-socket-id", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    expect(connector.socketId()).toBe("fake-socket-id");
  });

  test("disconnect does nothing", () => {
    const connector = new NullConnector({ broadcaster: "null" });
    expect(() => connector.disconnect()).not.toThrow();
  });
});
