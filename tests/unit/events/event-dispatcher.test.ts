import { beforeEach, describe, expect, it } from "bun:test";
import { EventDispatcher } from "../../../src/events/event-dispatcher";

describe("EventDispatcher", () => {
  beforeEach(() => {
    // Clear all listeners before each test
    EventDispatcher.removeAllListeners();
  });

  describe("on()", () => {
    it("should register event listener", () => {
      let called = false;
      EventDispatcher.on("test:event", () => {
        called = true;
      });

      EventDispatcher.emit("test:event", {});
      expect(called).toBe(true);
    });

    it("should pass event data to listener", () => {
      let receivedData: any = null;
      EventDispatcher.on("test:data", (data) => {
        receivedData = data;
      });

      const testData = { foo: "bar", num: 42 };
      EventDispatcher.emit("test:data", testData);
      expect(receivedData).toEqual(testData);
    });

    it("should call multiple listeners for same event", () => {
      let count = 0;
      EventDispatcher.on("test:multi", () => count++);
      EventDispatcher.on("test:multi", () => count++);
      EventDispatcher.on("test:multi", () => count++);

      EventDispatcher.emit("test:multi", {});
      expect(count).toBe(3);
    });

    it("should return unsubscribe function", () => {
      let called = false;
      const unsubscribe = EventDispatcher.on("test:unsub", () => {
        called = true;
      });

      // Call once - should work
      EventDispatcher.emit("test:unsub", {});
      expect(called).toBe(true);

      // Unsubscribe
      called = false;
      unsubscribe();

      // Call again - should not work
      EventDispatcher.emit("test:unsub", {});
      expect(called).toBe(false);
    });
  });

  describe("once()", () => {
    it("should call listener only once", () => {
      let count = 0;
      EventDispatcher.once("test:once", () => count++);

      EventDispatcher.emit("test:once", {});
      EventDispatcher.emit("test:once", {});
      EventDispatcher.emit("test:once", {});

      expect(count).toBe(1);
    });

    it("should pass event data to listener", () => {
      let receivedData: any = null;
      EventDispatcher.once("test:once:data", (data) => {
        receivedData = data;
      });

      const testData = { value: 123 };
      EventDispatcher.emit("test:once:data", testData);
      expect(receivedData).toEqual(testData);
    });

    it("should return unsubscribe function", () => {
      let called = false;
      const unsubscribe = EventDispatcher.once("test:once:unsub", () => {
        called = true;
      });

      // Unsubscribe before calling
      unsubscribe();

      // Try to call - should not work
      EventDispatcher.emit("test:once:unsub", {});
      expect(called).toBe(false);
    });
  });

  describe("off()", () => {
    it("should remove specific listener", () => {
      let count1 = 0;
      let count2 = 0;

      const listener1 = () => count1++;
      const listener2 = () => count2++;

      EventDispatcher.on("test:off", listener1);
      EventDispatcher.on("test:off", listener2);

      // Both should be called
      EventDispatcher.emit("test:off", {});
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      // Remove first listener
      EventDispatcher.off("test:off", listener1);

      // Only second should be called
      EventDispatcher.emit("test:off", {});
      expect(count1).toBe(1);
      expect(count2).toBe(2);
    });

    it("should not error when removing non-existent listener", () => {
      const listener = () => {};
      expect(() => {
        EventDispatcher.off("test:nonexistent", listener);
      }).not.toThrow();
    });
  });

  describe("emit()", () => {
    it("should not error when emitting to event with no listeners", () => {
      expect(() => {
        EventDispatcher.emit("test:noop", {});
      }).not.toThrow();
    });

    it("should handle listener errors gracefully", () => {
      let listener2Called = false;

      EventDispatcher.on("test:error", () => {
        throw new Error("Test error");
      });

      EventDispatcher.on("test:error", () => {
        listener2Called = true;
      });

      // Should not throw, second listener should still be called
      expect(() => {
        EventDispatcher.emit("test:error", {});
      }).not.toThrow();

      expect(listener2Called).toBe(true);
    });
  });

  describe("emitAsync()", () => {
    it("should handle async listeners", async () => {
      let called = false;

      EventDispatcher.on("test:async", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        called = true;
      });

      await EventDispatcher.emitAsync("test:async", {});
      expect(called).toBe(true);
    });

    it("should wait for all async listeners", async () => {
      const results: number[] = [];

      EventDispatcher.on("test:async:multi", async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        results.push(1);
      });

      EventDispatcher.on("test:async:multi", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(2);
      });

      await EventDispatcher.emitAsync("test:async:multi", {});

      // Both should have been called
      expect(results).toHaveLength(2);
      expect(results).toContain(1);
      expect(results).toContain(2);
    });

    it("should handle async errors gracefully", async () => {
      let listener2Called = false;

      EventDispatcher.on("test:async:error", async () => {
        throw new Error("Async test error");
      });

      EventDispatcher.on("test:async:error", async () => {
        listener2Called = true;
      });

      // Should not throw, second listener should still be called
      await expect(
        EventDispatcher.emitAsync("test:async:error", {}),
      ).resolves.toBeUndefined();
      expect(listener2Called).toBe(true);
    });
  });

  describe("removeAllListeners()", () => {
    it("should remove all listeners for specific event", () => {
      let count1 = 0;
      let count2 = 0;

      EventDispatcher.on("test:remove1", () => count1++);
      EventDispatcher.on("test:remove1", () => count1++);
      EventDispatcher.on("test:remove2", () => count2++);

      EventDispatcher.removeAllListeners("test:remove1");

      EventDispatcher.emit("test:remove1", {});
      EventDispatcher.emit("test:remove2", {});

      expect(count1).toBe(0);
      expect(count2).toBe(1);
    });

    it("should remove all listeners for all events when no event name provided", () => {
      let count1 = 0;
      let count2 = 0;

      EventDispatcher.on("test:removeall1", () => count1++);
      EventDispatcher.on("test:removeall2", () => count2++);

      EventDispatcher.removeAllListeners();

      EventDispatcher.emit("test:removeall1", {});
      EventDispatcher.emit("test:removeall2", {});

      expect(count1).toBe(0);
      expect(count2).toBe(0);
    });
  });

  describe("listenerCount()", () => {
    it("should return 0 for event with no listeners", () => {
      expect(EventDispatcher.listenerCount("test:nolisteners")).toBe(0);
    });

    it("should return correct count of listeners", () => {
      EventDispatcher.on("test:count", () => {});
      EventDispatcher.on("test:count", () => {});
      EventDispatcher.on("test:count", () => {});

      expect(EventDispatcher.listenerCount("test:count")).toBe(3);
    });

    it("should update count when listeners are removed", () => {
      const listener1 = () => {};
      const listener2 = () => {};

      EventDispatcher.on("test:count:remove", listener1);
      EventDispatcher.on("test:count:remove", listener2);

      expect(EventDispatcher.listenerCount("test:count:remove")).toBe(2);

      EventDispatcher.off("test:count:remove", listener1);

      expect(EventDispatcher.listenerCount("test:count:remove")).toBe(1);
    });
  });

  describe("eventNames()", () => {
    it("should return empty array when no events registered", () => {
      expect(EventDispatcher.eventNames()).toEqual([]);
    });

    it("should return all event names with listeners", () => {
      EventDispatcher.on("test:names1", () => {});
      EventDispatcher.on("test:names2", () => {});
      EventDispatcher.on("test:names3", () => {});

      const names = EventDispatcher.eventNames();
      expect(names).toHaveLength(3);
      expect(names).toContain("test:names1");
      expect(names).toContain("test:names2");
      expect(names).toContain("test:names3");
    });

    it("should not include events with no listeners", () => {
      EventDispatcher.on("test:with:listener", () => {});
      EventDispatcher.emit("test:without:listener", {});

      const names = EventDispatcher.eventNames();
      expect(names).toEqual(["test:with:listener"]);
    });
  });

  describe("Integration", () => {
    it("should support complex event flow", () => {
      const log: string[] = [];

      // Register multiple listeners
      EventDispatcher.on("user:login", (data: any) => {
        log.push(`login: ${data.user}`);
      });

      EventDispatcher.once("user:login", (data: any) => {
        log.push(`once: ${data.user}`);
      });

      const unsubscribe = EventDispatcher.on("user:login", (data: any) => {
        log.push(`temp: ${data.user}`);
      });

      // First login
      EventDispatcher.emit("user:login", { user: "alice" });
      expect(log).toEqual(["login: alice", "once: alice", "temp: alice"]);

      // Remove temporary listener
      unsubscribe();

      // Second login - once listener should not fire, temp listener removed
      EventDispatcher.emit("user:login", { user: "bob" });
      expect(log).toEqual([
        "login: alice",
        "once: alice",
        "temp: alice",
        "login: bob",
      ]);
    });
  });
});
