/**
 * PubSubProvider contract - Pub/Sub message provider interface
 *
 * Defines the contract for pub/sub implementations that handle event publishing
 * and subscription within the Reverb server. Implementations manage connections
 * to external message brokers or internal pub/sub systems.
 */

/**
 * IPubSubProvider interface.
 *
 * Defines the contract for pub/sub providers.
 * Implementations must provide methods to connect, subscribe, listen for events,
 * and publish messages to a pub/sub system.
 */
export interface IPubSubProvider {
	/**
	 * Connect to the publisher.
	 *
	 * Establishes the connection to the pub/sub system.
	 * Must be called before any other operations.
	 *
	 * @returns Promise that resolves when connection is established
	 */
	connect(): Promise<void>;

	/**
	 * Disconnect from the publisher.
	 *
	 * Cleanly closes the connection to the pub/sub system.
	 * Should release all resources and clean up listeners.
	 *
	 * @returns Promise that resolves when disconnection is complete
	 */
	disconnect(): Promise<void>;

	/**
	 * Subscribe to the publisher.
	 *
	 * Subscribes to the pub/sub system to begin receiving messages.
	 * Must be called after connect() and before listening for events.
	 *
	 * @returns Promise that resolves when subscription is active
	 */
	subscribe(): Promise<void>;

	/**
	 * Listen for a given event.
	 *
	 * Registers a callback function to be called when the specified event occurs.
	 * The callback receives the event data as its argument.
	 *
	 * @param event - The event name to listen for
	 * @param callback - Function to invoke when the event is received
	 */
	on(event: string, callback: (data: any) => void): void;

	/**
	 * Publish a payload to the publisher.
	 *
	 * Sends a message/payload to the pub/sub system for distribution.
	 *
	 * @param payload - The data object to publish
	 * @returns Promise that resolves when the message is published
	 */
	publish(payload: Record<string, any>): Promise<void>;
}
