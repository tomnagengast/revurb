import { describe, expect, test } from "bun:test";
import Echo from "../src/echo";

describe("Echo", () => {
  test("it will not throw error for null broadcaster", () => {
    expect(
      () => new Echo({ broadcaster: "null", withoutInterceptors: true }),
    ).not.toThrow();
  });

  test("it will throw error for unsupported driver", () => {
    expect(
      // @ts-expect-error - testing unsupported broadcaster
      () => new Echo({ broadcaster: "foo", withoutInterceptors: true }),
    ).toThrow("Broadcaster foo is not supported.");
  });

  // Note: pusher and reverb tests require Pusher client mocking
  // These will be added in Phase 2 when we set up proper test mocks
});
