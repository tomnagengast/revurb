/**
 * Generate a Pusher-compatible socket ID.
 *
 * Creates a unique identifier in the format "number.number" where each number
 * is a random integer between 1 and 1,000,000,000.
 *
 * @returns A Pusher-compatible socket ID string
 *
 * @example
 * ```typescript
 * const socketId = generateId();
 * // Returns something like: "123456789.987654321"
 * ```
 */
export function generateId(): string {
  const first = Math.floor(Math.random() * 1_000_000_000) + 1;
  const second = Math.floor(Math.random() * 1_000_000_000) + 1;
  return `${first}.${second}`;
}
