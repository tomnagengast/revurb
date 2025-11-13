import type { IApplicationProvider } from "../contracts/application-provider";
import type { ILogger } from "../contracts/logger";
import type { ChannelManager } from "../protocols/pusher/Contracts/channel-manager";
import { EventHandler } from "../protocols/pusher/event-handler";

/**
 * PingInactiveConnections Job
 *
 * Pings all inactive connections across all applications to detect
 * dead/stale connections and maintain connection health.
 *
 * Execution Flow:
 * 1. Iterate through all applications
 * 2. For each application, scope the channel manager
 * 3. Get all connections for the application
 * 4. Filter for inactive connections (isActive() === false)
 * 5. Send pusher:ping to each inactive connection
 * 6. Log each ping operation
 *
 * @example
 * ```typescript
 * const job = new PingInactiveConnections(applicationProvider, logger, channelManager);
 * await job.handle();
 * ```
 */
export class PingInactiveConnections {
	/**
	 * Create a new PingInactiveConnections job instance.
	 *
	 * @param applicationProvider - Provider for accessing all applications
	 * @param logger - Logger instance for logging operations
	 * @param channels - Channel manager for accessing connections
	 */
	constructor(
		protected readonly applicationProvider: IApplicationProvider,
		protected readonly logger: ILogger,
		protected readonly channels: ChannelManager,
	) {}

	/**
	 * Execute the job.
	 *
	 * Iterates through all applications and their connections,
	 * sending ping messages to inactive connections.
	 */
	async handle(): Promise<void> {
		this.logger.info("Pinging Inactive Connections");

		const pusher = new EventHandler(this.channels);

		// Get all applications
		const applications = this.applicationProvider.all();

		// Process each application
		for (const application of applications) {
			// Scope channel manager to this application
			const scopedChannels = this.channels.for(application);

			// Get all connections for this application
			const allConnections = scopedChannels.connections();

			// Filter and ping inactive connections
			for (const [, channelConnection] of Object.entries(allConnections)) {
				// Unwrap the underlying connection from ChannelConnection
				const connection = channelConnection.connection();

				// Skip active connections
				if (connection.isActive()) {
					continue;
				}

				// Send ping to inactive connection
				pusher.ping(connection);

				// Log the ping
				this.logger.info("Connection Pinged", connection.id());
			}
		}
	}
}
