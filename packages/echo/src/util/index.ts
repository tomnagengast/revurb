export * from "./event-formatter";

// biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility - matches upstream
function isConstructor(obj: unknown): obj is new (...args: any[]) => any {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: Laravel Echo compatibility
    new (obj as new (...args: any[]) => any)();
  } catch (err) {
    if (err instanceof Error && err.message.includes("is not a constructor")) {
      return false;
    }
  }

  return true;
}

export { isConstructor };
