import type { Application } from "../../../../application";
import type { Connection } from "../../../../servers/reverb/http/connection";
import { Response } from "../../../../servers/reverb/http/response";
import type { IHttpRequest } from "../../../../servers/reverb/http/router";
import type { ChannelConnection } from "../../channels/channel-connection";
import type { ChannelManager } from "../../contracts/channel-manager";
import { EventDispatcher } from "../../event-dispatcher";
import type { MetricsHandler } from "../../metrics-handler";
import { Controller } from "./controller";

/**
 * Validation error type
 */
interface ValidationErrors {
	[field: string]: string[];
}

/**
 * Events payload structure
 */
interface EventsPayload {
	name?: string;
	data?: string;
	channels?: string[];
	channel?: string;
	socket_id?: string;
	info?: string;
}

/**
 * Events Controller
 *
 * Handles POST /apps/:appId/events endpoint.
 * Triggers server-to-client events on one or more channels.
 *
 * This controller allows backend applications to trigger events on channels
 * without requiring a WebSocket connection. Events are validated and then
 * broadcast to all subscribed connections.
 *
 * @example
 * ```typescript
 * // POST /apps/123/events
 * // Body: {
 * //   "name": "my-event",
 * //   "data": "{\"message\":\"hello\"}",
 * //   "channels": ["my-channel"]
 * // }
 *
 * const controller = new EventsController(channelManager, metricsHandler);
 * const response = await controller.__invoke(request, connection, application, channelManager);
 * ```
 */
export class EventsController extends Controller {
	/**
	 * Create a new events controller instance.
	 *
	 * @param channelManager - The channel manager for accessing channels
	 * @param metricsHandler - The metrics handler for gathering channel info
	 */
	constructor(
		protected override readonly channelManager: ChannelManager,
		protected readonly metricsHandler: MetricsHandler,
	) {
		// EventsController uses a simplified constructor since it doesn't need applicationProvider
		// The channelManager is already scoped to the app by the router
		super(null as any, channelManager);
	}

	/**
	 * Handle the request to trigger events.
	 *
	 * Processes the incoming event trigger request:
	 * 1. Parses and validates the request body
	 * 2. Validates required fields (name, data, channels/channel)
	 * 3. Dispatches the event to specified channels
	 * 4. Optionally gathers and returns channel metrics
	 *
	 * @param request - The HTTP request object
	 * @param connection - The connection object
	 * @param application - The application context
	 * @param channelManager - The channel manager scoped to the application
	 * @returns Response with empty object or channel metrics
	 */
	async __invoke(
		request: IHttpRequest,
		_connection: Connection,
		application: Application,
		channelManager: ChannelManager,
	): Promise<Response> {
		// Parse the request body
		const body = this.getBody(request);
		let payload: EventsPayload;

		try {
			payload = JSON.parse(body);
		} catch (_error) {
			return new Response({ message: "Invalid JSON payload" }, 422);
		}

		// Validate the payload
		const validator = this.validator(payload);

		if (Object.keys(validator).length > 0) {
			return new Response(validator, 422);
		}

		// Normalize channels to array
		const channels = this.normalizeChannels(payload);

		// Get the connection to exclude from broadcast (if socket_id provided)
		let except: ChannelConnection | null = null;
		if (payload.socket_id) {
			const connections = channelManager.connections();
			except = connections[payload.socket_id] ?? null;
		}

		// Dispatch the event to all specified channels
		EventDispatcher.dispatch(
			application,
			{
				event: payload.name!,
				channels,
				data: payload.data!,
			},
			channelManager,
			except?.connection() ?? null,
		);

		// If info parameter is provided, gather and return channel metrics
		if (payload.info) {
			const channelMetrics = await this.metricsHandler.gather(
				application,
				"channels",
				{
					channels,
					info: payload.info,
				},
			);

			// Convert channel metrics to array format expected by Pusher API
			const channelsArray = Object.entries(channelMetrics).map(
				([_name, info]) => {
					// Ensure info is an object before spreading
					if (typeof info === "object" && info !== null) {
						return { ...info };
					}
					return info;
				},
			);

			return new Response({ channels: channelsArray });
		}

		// Return empty object on success
		return new Response({});
	}

	/**
	 * Get the request body.
	 *
	 * Extracts the body from the request object. In the router's IHttpRequest,
	 * the body is accessed via the underlying request object.
	 *
	 * @param request - The HTTP request object
	 * @returns The request body as a string
	 */
	protected getBody(request: IHttpRequest): string {
		// The IHttpRequest from router wraps the parsed request
		// Access the body property directly
		const httpRequest = request as any;
		return httpRequest.body || "";
	}

	/**
	 * Normalize channels to array format.
	 *
	 * Handles both 'channels' (array) and 'channel' (single string) properties.
	 * Returns an array of channel names.
	 *
	 * @param payload - The events payload
	 * @returns Array of channel names
	 */
	protected normalizeChannels(payload: EventsPayload): string[] {
		if (payload.channels) {
			return payload.channels;
		}

		if (payload.channel) {
			return [payload.channel];
		}

		return [];
	}

	/**
	 * Create a validator for the incoming request payload.
	 *
	 * Validates the event trigger payload according to Pusher API requirements:
	 * - name: required, must be a string
	 * - data: required, must be a string
	 * - channels: required if channel not provided, must be an array
	 * - channel: required if channels not provided, must be a string
	 * - socket_id: optional, must be a string
	 * - info: optional, must be a string
	 *
	 * @param payload - The payload to validate
	 * @returns Validation errors object (empty if valid)
	 */
	protected validator(payload: EventsPayload): ValidationErrors {
		const errors: ValidationErrors = {};

		// Validate 'name' field
		if (!payload.name) {
			errors.name = ["The name field is required"];
		} else if (typeof payload.name !== "string") {
			errors.name = ["The name field must be a string"];
		}

		// Validate 'data' field
		if (!payload.data) {
			errors.data = ["The data field is required"];
		} else if (typeof payload.data !== "string") {
			errors.data = ["The data field must be a string"];
		}

		// Validate 'channels' or 'channel' field (at least one required)
		if (!payload.channels && !payload.channel) {
			errors.channels = ["Either channels or channel field is required"];
		}

		if (payload.channels !== undefined && !Array.isArray(payload.channels)) {
			errors.channels = ["The channels field must be an array"];
		}

		if (payload.channel !== undefined && typeof payload.channel !== "string") {
			errors.channel = ["The channel field must be a string"];
		}

		// Validate optional 'socket_id' field
		if (
			payload.socket_id !== undefined &&
			typeof payload.socket_id !== "string"
		) {
			errors.socket_id = ["The socket_id field must be a string"];
		}

		// Validate optional 'info' field
		if (payload.info !== undefined && typeof payload.info !== "string") {
			errors.info = ["The info field must be a string"];
		}

		return errors;
	}
}
