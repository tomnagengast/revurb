import type { Application } from "../../../../application";
import type { IApplicationProvider } from "../../../../contracts/application-provider";
import { InvalidApplication } from "../../../../exceptions/invalid-application";
import type { Connection } from "../../../../servers/reverb/http/connection";
import type { IHttpRequest } from "../../../../servers/reverb/http/request";
import { Response } from "../../../../servers/reverb/http/response";
import type { ChannelManager } from "../../contracts/channel-manager";
import type { MetricsHandler } from "../../metrics-handler";

/**
 * ChannelsController
 *
 * Handles GET /apps/:appId/channels endpoint.
 * Returns list of channels with optional prefix filtering.
 *
 * This controller:
 * - Verifies the request signature
 * - Retrieves channel information using MetricsHandler
 * - Supports optional filter_by_prefix query parameter
 * - Supports optional info query parameter for channel metadata
 * - Returns channels in Pusher-compatible format
 */
export class ChannelsController {
	/**
	 * Current application instance.
	 */
	protected application: Application | null = null;

	/**
	 * Active channels for the application.
	 */
	protected channels: ChannelManager | null = null;

	/**
	 * The incoming request's body.
	 */
	protected body: string | null = null;

	/**
	 * The incoming request's query parameters.
	 */
	protected query: Record<string, string> = {};

	/**
	 * Create a new ChannelsController instance.
	 *
	 * @param metricsHandler - The metrics handler for gathering channel information
	 * @param applicationProvider - The application provider for finding applications
	 * @param channelManager - The channel manager for accessing channels
	 */
	constructor(
		protected metricsHandler: MetricsHandler,
		protected applicationProvider: IApplicationProvider,
		protected channelManager: ChannelManager,
	) {}

	/**
	 * Handle the request.
	 *
	 * @param request - The HTTP request
	 * @param connection - The HTTP connection
	 * @param appId - The application ID from the route
	 * @returns Promise resolving to the HTTP response
	 */
	async __invoke(
		request: IHttpRequest,
		_connection: Connection,
		appId: string,
	): Promise<Response> {
		this.verify(request, _connection, appId);

		const options: Record<string, string> = {};
		if (this.query["filter_by_prefix"]) {
			options.filter = this.query["filter_by_prefix"];
		}
		if (this.query["info"]) {
			options.info = this.query["info"];
		}

		const channels = await this.metricsHandler.gather(
			this.application!,
			"channels",
			options,
		);

		// Convert channels object to array format expected by Pusher API
		return new Response({ channels: this.formatChannels(channels) });
	}

	/**
	 * Format channels object into Pusher-compatible response format.
	 *
	 * @param channels - Record of channel names to channel info
	 * @returns Object with channels property containing the formatted data
	 */
	protected formatChannels(channels: Record<string, any>): Record<string, any> {
		// Convert each channel info object to a plain object
		const formatted: Record<string, any> = {};

		for (const [name, info] of Object.entries(channels)) {
			formatted[name] = { ...info };
		}

		return formatted;
	}

	/**
	 * Verify that the incoming request is valid.
	 *
	 * @param request - The HTTP request
	 * @param connection - The HTTP connection
	 * @param appId - The application ID
	 * @throws {Error} Throws if verification fails
	 */
	verify(request: IHttpRequest, _connection: Connection, appId: string): void {
		this.body = request.body;
		this.query = this.parseQuery(request.path);

		this.setApplication(appId);
		this.setChannels();
		this.verifySignature(request);
	}

	/**
	 * Parse query parameters from the request path.
	 *
	 * @param path - The request path including query string
	 * @returns Parsed query parameters
	 */
	protected parseQuery(path: string): Record<string, string> {
		const queryIndex = path.indexOf("?");
		if (queryIndex === -1) {
			return {};
		}

		const queryString = path.substring(queryIndex + 1);
		const params: Record<string, string> = {};

		if (!queryString) {
			return params;
		}

		const pairs = queryString.split("&");
		for (const pair of pairs) {
			const [key, value] = pair.split("=");
			if (key) {
				params[decodeURIComponent(key)] = value
					? decodeURIComponent(value)
					: "";
			}
		}

		return params;
	}

	/**
	 * Set the Reverb application instance for the incoming request's application ID.
	 *
	 * @param appId - The application ID
	 * @returns The application instance
	 * @throws {Error} Throws 400 if no appId provided, 404 if application not found
	 */
	protected setApplication(appId: string | null): Application {
		if (!appId) {
			throw new Error("Application ID not provided.");
		}

		try {
			this.application = this.applicationProvider.findById(appId);
			return this.application;
		} catch (e) {
			if (e instanceof InvalidApplication) {
				throw new Error(`No matching application for ID [${appId}].`);
			}
			throw e;
		}
	}

	/**
	 * Set the Reverb channel manager instance for the application.
	 */
	protected setChannels(): void {
		this.channels = this.channelManager.for(this.application!);
	}

	/**
	 * Verify the Pusher authentication signature.
	 *
	 * @param request - The HTTP request
	 * @throws {Error} Throws 401 if signature is invalid
	 */
	protected verifySignature(request: IHttpRequest): void {
		const paramsToExclude = [
			"auth_signature",
			"body_md5",
			"appId",
			"appKey",
			"channelName",
		];
		const params: Record<string, string> = {};

		// Copy query params except excluded ones
		for (const [key, value] of Object.entries(this.query)) {
			if (!paramsToExclude.includes(key)) {
				params[key] = value;
			}
		}

		// Add body_md5 if body is not empty
		if (this.body && this.body !== "") {
			params["body_md5"] = this.md5(this.body);
		}

		// Sort params by key
		const sortedKeys = Object.keys(params).sort();
		const sortedParams: Record<string, string> = {};
		for (const key of sortedKeys) {
			sortedParams[key] = params[key] ?? "";
		}

		// Build signature string
		const signatureString = [
			request.method,
			this.getPathWithoutQuery(request.path),
			this.formatQueryParametersForVerification(sortedParams),
		].join("\n");

		// Calculate signature
		const signature = this.hmacSha256(
			signatureString,
			this.application!.secret(),
		);
		const authSignature = this.query["auth_signature"] ?? "";

		if (signature !== authSignature) {
			throw new Error("Authentication signature invalid.");
		}
	}

	/**
	 * Get the path without query string.
	 *
	 * @param path - The full path with query string
	 * @returns The path without query string
	 */
	protected getPathWithoutQuery(path: string): string {
		const queryIndex = path.indexOf("?");
		return queryIndex === -1 ? path : path.substring(0, queryIndex);
	}

	/**
	 * Format the given parameters into the correct format for signature verification.
	 *
	 * @param params - The parameters to format
	 * @returns Formatted query string
	 */
	protected formatQueryParametersForVerification(
		params: Record<string, any>,
	): string {
		const parts: string[] = [];

		for (const [key, value] of Object.entries(params)) {
			const formattedValue = Array.isArray(value)
				? value.join(",")
				: String(value);
			parts.push(`${key}=${formattedValue}`);
		}

		return parts.join("&");
	}

	/**
	 * Calculate MD5 hash of a string.
	 *
	 * @param data - The data to hash
	 * @returns The MD5 hash as a hex string
	 */
	protected md5(data: string): string {
		const crypto = require("crypto");
		return crypto.createHash("md5").update(data).digest("hex");
	}

	/**
	 * Calculate HMAC-SHA256 signature.
	 *
	 * @param data - The data to sign
	 * @param secret - The secret key
	 * @returns The signature as a hex string
	 */
	protected hmacSha256(data: string, secret: string): string {
		const crypto = require("crypto");
		return crypto.createHmac("sha256", secret).update(data).digest("hex");
	}
}
