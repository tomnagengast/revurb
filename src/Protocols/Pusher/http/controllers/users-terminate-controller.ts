import type { Application } from "../../../../application";
import type { IApplicationProvider } from "../../../../contracts/application-provider";
import type { ServerProvider } from "../../../../contracts/server-provider";
import type { IPubSubProvider } from "../../../../servers/reverb/contracts/pubsub-provider";
import { Response } from "../../../../servers/reverb/http/response";
import type { ChannelManager } from "../../contracts/channel-manager";

/**
 * UsersTerminateController
 *
 * Handles POST /apps/:appId/users/:userId/terminate_connections endpoint
 * Forces disconnect of all connections for a specific user.
 *
 * This endpoint is typically used by backend services to forcibly disconnect
 * a user from all channels, for example when a user logs out, is banned, or
 * their session is invalidated.
 *
 * In a distributed setup (with pub/sub enabled), this publishes a 'terminate'
 * message to all servers. Otherwise, it directly disconnects matching connections
 * on this server.
 *
 * @example
 * ```typescript
 * // Example usage in a route handler
 * const controller = new UsersTerminateController(
 *   applicationProvider,
 *   channelManager,
 *   serverProvider,
 *   pubSubProvider
 * );
 *
 * const response = await controller.handle(request, appId, userId);
 * ```
 */
export class UsersTerminateController {
	/**
	 * Create a new users terminate controller instance.
	 *
	 * @param applicationProvider - Provider for finding applications
	 * @param channelManager - Manager for accessing channels and connections
	 * @param serverProvider - Provider for checking pub/sub configuration
	 * @param pubSubProvider - Optional pub/sub provider for distributed setups
	 */
	constructor(
		protected readonly applicationProvider: IApplicationProvider,
		protected readonly channelManager: ChannelManager,
		protected readonly serverProvider: ServerProvider,
		protected readonly pubSubProvider?: IPubSubProvider,
	) {}

	/**
	 * Handle the user connection termination request.
	 *
	 * Validates the request, finds the application, and either publishes a
	 * terminate message (in distributed setup) or directly disconnects the
	 * user's connections (in standalone setup).
	 *
	 * @param request - The incoming HTTP request
	 * @param appId - The application ID
	 * @param userId - The user ID whose connections should be terminated
	 * @returns Promise resolving to a Response with empty JSON object
	 * @throws {Error} If authentication fails or application is not found
	 */
	async handle(
		request: Request,
		appId: string,
		userId: string,
	): Promise<Response> {
		// Verify the request is authenticated and get the application
		const application = await this.verify(request, appId);

		// Check if we're in a distributed environment with pub/sub
		if (this.serverProvider.subscribesToEvents() && this.pubSubProvider) {
			// Publish terminate message to all servers
			await this.pubSubProvider.publish({
				type: "terminate",
				application: application.toArray(),
				payload: { user_id: userId },
			});

			return new Response({}, 200, { "Content-Type": "application/json" });
		}

		// Standalone mode: directly disconnect connections on this server
		const channels = this.channelManager.for(application);
		const connections = Object.values(channels.connections());

		// Disconnect all connections belonging to this user
		for (const connection of connections) {
			const userData = connection.data() as Map<string, unknown>;
			const connectionUserId = userData.get("user_id");

			// Compare as strings to handle both string and number user IDs
			if (String(connectionUserId) === userId) {
				connection.connection().disconnect();
			}
		}

		return new Response({}, 200, { "Content-Type": "application/json" });
	}

	/**
	 * Verify that the incoming request is valid and authenticated.
	 *
	 * Validates the request signature and finds the application.
	 * This should implement the same authentication logic as other
	 * Pusher HTTP API endpoints (HMAC signature verification).
	 *
	 * @param request - The incoming HTTP request
	 * @param appId - The application ID to verify against
	 * @returns Promise resolving to the Application instance
	 * @throws {Error} If authentication fails or application is not found
	 *
	 * @private
	 */
	protected async verify(
		request: Request,
		appId: string,
	): Promise<Application> {
		// Validate application ID is provided
		if (!appId) {
			throw new Error("Application ID not provided.");
		}

		// Find the application
		let application: Application;
		try {
			application = this.applicationProvider.findById(appId);
		} catch (error) {
			throw new Error(`No matching application for ID [${appId}].`);
		}

		// Parse query parameters
		const url = new URL(request.url);
		const queryParams = Object.fromEntries(url.searchParams.entries());

		// Get request body
		const body = await request.text();

		// Verify the signature
		await this.verifySignature(request, queryParams, body, application);

		return application;
	}

	/**
	 * Verify the Pusher authentication signature.
	 *
	 * Validates that the request came from an authorized source by checking
	 * the HMAC-SHA256 signature in the query parameters.
	 *
	 * The signature is calculated from:
	 * - HTTP method (POST)
	 * - Request path
	 * - Query parameters (sorted, excluding auth_signature)
	 * - Request body MD5 (if body is not empty)
	 *
	 * @param request - The incoming HTTP request
	 * @param queryParams - Parsed query parameters
	 * @param body - Request body as string
	 * @param application - The application to verify against
	 * @throws {Error} If signature is invalid
	 *
	 * @private
	 */
	protected async verifySignature(
		request: Request,
		queryParams: Record<string, string>,
		body: string,
		application: Application,
	): Promise<void> {
		// Extract signature from query params
		const authSignature = queryParams.auth_signature;
		if (!authSignature) {
			throw new Error("Authentication signature invalid.");
		}

		// Build params for signature, excluding certain fields
		const paramsForSignature = { ...queryParams };
		delete paramsForSignature.auth_signature;
		delete paramsForSignature.body_md5;
		delete paramsForSignature.appId;
		delete paramsForSignature.appKey;
		delete paramsForSignature.channelName;

		// Add body_md5 if body is not empty
		if (body && body.length > 0) {
			const hasher = new Bun.CryptoHasher("md5");
			hasher.update(body);
			paramsForSignature.body_md5 = hasher.digest("hex");
		}

		// Sort parameters by key
		const sortedKeys = Object.keys(paramsForSignature).sort();
		const sortedParams = sortedKeys
			.map((key) => {
				const value = paramsForSignature[key];
				// Handle array values by joining with comma
				const valueStr = Array.isArray(value) ? value.join(",") : value;
				return `${key}=${valueStr}`;
			})
			.join("&");

		// Build the signature string
		const url = new URL(request.url);
		const signatureString = [request.method, url.pathname, sortedParams].join(
			"\n",
		);

		// Calculate HMAC-SHA256 signature
		const hmac = new Bun.CryptoHasher("sha256", application.secret());
		hmac.update(signatureString);
		const calculatedSignature = hmac.digest("hex");

		// Compare signatures
		if (calculatedSignature !== authSignature) {
			throw new Error("Authentication signature invalid.");
		}
	}
}
