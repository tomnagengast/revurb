import type { IApplicationProvider } from "../contracts/application-provider";
import type { ILogger } from "../contracts/logger";
import type { ChannelManager } from "../protocols/pusher/contracts/channel-manager";
import type { ChannelConnection } from "../protocols/pusher/channels/channel-connection";
import { ConnectionPruned } from "../events/connection-pruned";

/**
 * PruneStaleConnections Job
 *
 * Removes stale connections (inactive and pinged) across all applications.
 *
 * Execution Flow:
 * 1. Iterate through all applications
 * 2. For each application, scope the channel manager
 * 3. Get all connections for the application
 * 4. Filter for stale connections (isStale() === true)
 * 5. Send pusher:error event with pong timeout code 4201
 * 6. Unsubscribe connection from all channels
 * 7. Disconnect the connection
 * 8. Dispatch ConnectionPruned event
 * 9. Log each prune operation
 *
 * @example
 * ```typescript
 * const job = new PruneStaleConnections(applicationProvider, logger, channelManager);
 * await job.handle();
 * ```
 */
export class PruneStaleConnections {
	/**
	 * Create a new PruneStaleConnections job instance.
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
	 * pruning stale connections that have not responded to pings.
	 */
	async handle(): Promise<void> {
		this.logger.info("Pruning Stale Connections");

		// Get all applications
		const applications = this.applicationProvider.all();

		// Process each application
		for (const application of applications) {
			// Scope channel manager to this application
			const scopedChannels = this.channels.for(application);

			// Get all connections for this application
			const allConnections = scopedChannels.connections();

			// Filter and prune stale connections
			for (const [, channelConnection] of Object.entries(allConnections)) {
				// Type assertion for ChannelConnection
				const channelConn = channelConnection as ChannelConnection;
				// Skip active connections
				if (!channelConn.isStale()) {
					continue;
				}

				// Get the underlying connection for unsubscribeFromAll
				const connection = channelConn.connection();

				// Send pusher:error event with pong timeout
				channelConn.send(
					JSON.stringify({
						event: "pusher:error",
						data: JSON.stringify({
							code: 4201,
							message: "Pong reply not received in time",
						}),
					}),
				);

				// Unsubscribe from all channels (requires underlying Connection)
				scopedChannels.unsubscribeFromAll(connection);

				// Disconnect the connection
				channelConn.disconnect();

				// Dispatch ConnectionPruned event
				ConnectionPruned.dispatch(channelConn);

				// Log the prune operation
				this.logger.info("Connection Pruned", channelConn.id());
			}
		}
	}
}
