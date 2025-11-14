import { describe, expect, test } from "bun:test";
import { buildEchoOptions, normalizeServer } from "../src/Chat";

describe("normalizeServer", () => {
  test("returns ws urls unchanged", () => {
    const normalized = normalizeServer("ws://example.com/chat/");
    expect(normalized).toBe("ws://example.com/chat");
  });

  test("converts http to ws", () => {
    const normalized = normalizeServer("http://demo.test:6001");
    expect(normalized).toBe("ws://demo.test:6001");
  });

  test("converts https to wss", () => {
    const normalized = normalizeServer("https://secure.test/path");
    expect(normalized).toBe("wss://secure.test/path");
  });
});

describe("buildEchoOptions", () => {
  test("produces pusher config for custom ports", () => {
    const config = buildEchoOptions("ws://127.0.0.1:6001");
    expect(config.normalized).toBe("ws://127.0.0.1:6001");
    expect(config.options.wsHost).toBe("127.0.0.1");
    expect(config.options.wsPort).toBe(6001);
    expect(config.options.forceTLS).toBe(false);
    expect(config.options.enabledTransports).toEqual(["ws", "wss"]);
    expect(config.options.broadcaster).toBe("reverb");
  });

  test("defaults secure hosts to port 443", () => {
    const config = buildEchoOptions("https://revurb.test");
    expect(config.normalized).toBe("wss://revurb.test");
    expect(config.options.wsHost).toBe("revurb.test");
    expect(config.options.wsPort).toBe(443);
    expect(config.options.forceTLS).toBe(true);
    expect(config.options.wssPort).toBe(443);
  });
});
