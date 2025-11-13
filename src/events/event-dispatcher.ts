/**
 * Event Dispatcher
 *
 * Simple event dispatcher system for handling application events.
 * Provides a centralized way to emit and listen to events throughout the application.
 *
 * Usage:
 * ```typescript
 * // Listen to events
 * EventDispatcher.on('message:sent', (event) => {
 *   console.log('Message sent:', event);
 * });
 *
 * // Emit events
 * EventDispatcher.emit('message:sent', new MessageSent(connection, message));
 * ```
 */

type EventListener<T = unknown> = (event: T) => void | Promise<void>;

class EventDispatcherImpl {
	private listeners: Map<string, Set<EventListener>> = new Map();

	/**
	 * Register an event listener
	 *
	 * @param eventName - The name of the event to listen for
	 * @param listener - The callback function to execute when the event is emitted
	 * @returns A function to unregister the listener
	 */
	on<T = unknown>(eventName: string, listener: EventListener<T>): () => void {
		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, new Set());
		}

		this.listeners.get(eventName)?.add(listener as EventListener);

		// Return unsubscribe function
		return () => this.off(eventName, listener);
	}

	/**
	 * Register a one-time event listener
	 *
	 * @param eventName - The name of the event to listen for
	 * @param listener - The callback function to execute once when the event is emitted
	 * @returns A function to unregister the listener
	 */
	once<T = unknown>(eventName: string, listener: EventListener<T>): () => void {
		const wrappedListener = (event: T) => {
			listener(event);
			this.off(eventName, wrappedListener);
		};

		return this.on(eventName, wrappedListener);
	}

	/**
	 * Unregister an event listener
	 *
	 * @param eventName - The name of the event
	 * @param listener - The listener function to remove
	 */
	off<T = unknown>(eventName: string, listener: EventListener<T>): void {
		const eventListeners = this.listeners.get(eventName);
		if (eventListeners) {
			eventListeners.delete(listener as EventListener);
			if (eventListeners.size === 0) {
				this.listeners.delete(eventName);
			}
		}
	}

	/**
	 * Emit an event to all registered listeners
	 *
	 * @param eventName - The name of the event to emit
	 * @param event - The event data to pass to listeners
	 */
	emit<T = unknown>(eventName: string, event: T): void {
		const eventListeners = this.listeners.get(eventName);
		if (eventListeners) {
			for (const listener of eventListeners) {
				try {
					listener(event);
				} catch (error) {
					// Log error but don't stop other listeners
					console.error(`Error in event listener for ${eventName}:`, error);
				}
			}
		}
	}

	/**
	 * Emit an event asynchronously to all registered listeners
	 *
	 * @param eventName - The name of the event to emit
	 * @param event - The event data to pass to listeners
	 */
	async emitAsync<T = unknown>(eventName: string, event: T): Promise<void> {
		const eventListeners = this.listeners.get(eventName);
		if (eventListeners) {
			const promises: Promise<void>[] = [];
			for (const listener of eventListeners) {
				try {
					const result = listener(event);
					if (result instanceof Promise) {
						// Wrap promise to catch async errors
						promises.push(
							result.catch((error) => {
								console.error(
									`Error in event listener for ${eventName}:`,
									error,
								);
							}),
						);
					}
				} catch (error) {
					console.error(`Error in event listener for ${eventName}:`, error);
				}
			}
			await Promise.all(promises);
		}
	}

	/**
	 * Remove all listeners for a specific event or all events
	 *
	 * @param eventName - Optional event name to clear. If not provided, clears all listeners.
	 */
	removeAllListeners(eventName?: string): void {
		if (eventName) {
			this.listeners.delete(eventName);
		} else {
			this.listeners.clear();
		}
	}

	/**
	 * Get the number of listeners for an event
	 *
	 * @param eventName - The event name
	 * @returns The number of registered listeners
	 */
	listenerCount(eventName: string): number {
		return this.listeners.get(eventName)?.size ?? 0;
	}

	/**
	 * Get all event names that have listeners
	 *
	 * @returns Array of event names
	 */
	eventNames(): string[] {
		return Array.from(this.listeners.keys());
	}
}

// Export singleton instance
export const EventDispatcher = new EventDispatcherImpl();

// Export type for testing/mocking
export type { EventListener };
