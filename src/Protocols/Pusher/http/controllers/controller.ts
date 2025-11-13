import type { Application } from "../../../../application";
import type { IApplicationProvider } from "../../../../contracts/application-provider";
import type { Connection } from "../../../../servers/reverb/http/connection";
import type { IHttpRequest } from "../../../../servers/reverb/http/request";
import { HttpException } from "../../../../servers/reverb/http/server";
import type { ChannelManager } from "../../contracts/channel-manager";

/**
 * Base Controller for Pusher HTTP API
 *
 * Provides authentication and request validation for Pusher HTTP API controllers.
 * This abstract class handles:
 * - Application resolution and validation
 * - HMAC-SHA256 signature verification
 * - Request body and query parameter parsing
 * - Channel manager setup
 *
 * All HTTP API controllers should extend this class to inherit authentication
 * and validation functionality.
 *
 * @example
 * ```typescript
 * class EventsController extends Controller {
 *   async handle(request: IHttpRequest, connection: Connection, appId: string): Promise<Response> {
 *     await this.verify(request, connection, appId);
 *     // Handle the request...
 *   }
 * }
 * ```
 */
export abstract class Controller {
	/**
	 * Current application instance for the request.
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
	 * Create a new controller instance.
	 *
	 * @param applicationProvider - The application provider for resolving applications
	 * @param channelManager - The channel manager for accessing channels
	 */
	constructor(
		protected readonly applicationProvider: IApplicationProvider,
		protected readonly channelManager: ChannelManager,
	) {}

	/**
	 * Verify that the incoming request is valid.
	 *
	 * Performs the following validations:
	 * 1. Parses query parameters from the request path
	 * 2. Extracts the request body
	 * 3. Resolves and sets the application instance
	 * 4. Sets up the channel manager for the application
	 * 5. Verifies the HMAC signature
	 *
	 * @param request - The incoming HTTP request
	 * @param connection - The HTTP connection
	 * @param appId - The application ID from the route
	 * @throws {HttpException} If validation fails
	 */
	async verify(
		request: IHttpRequest,
		_connection: Connection,
		appId: string | null,
	): Promise<void> {
		// Parse query parameters from URL
		const url = new URL(request.path, "http://localhost");
		const queryParams: Record<string, string> = {};
		url.searchParams.forEach((value, key) => {
			queryParams[key] = value;
		});

		this.body = request.body;
		this.query = queryParams;

		this.setApplication(appId);
		this.setChannels();
		await this.verifySignature(request);
	}

	/**
	 * Set the application instance for the incoming request's application ID.
	 *
	 * @param appId - The application ID to resolve
	 * @returns The resolved Application instance
	 * @throws {HttpException} 400 if application ID not provided
	 * @throws {HttpException} 404 if no matching application found
	 */
	protected setApplication(appId: string | null): Application {
		if (!appId) {
			throw new HttpException(400, "Application ID not provided.");
		}

		try {
			this.application = this.applicationProvider.findById(appId);
			return this.application;
		} catch (error) {
			throw new HttpException(
				404,
				`No matching application for ID [${appId}].`,
			);
		}
	}

	/**
	 * Set the channel manager instance for the application.
	 *
	 * Scopes the channel manager to the current application context.
	 */
	protected setChannels(): void {
		if (!this.application) {
			throw new HttpException(500, "Application not set.");
		}

		this.channels = this.channelManager.for(this.application);
	}

	/**
	 * Verify the Pusher authentication signature using HMAC-SHA256.
	 *
	 * Validates that the request was signed with the correct application secret
	 * by comparing the provided auth_signature against a computed signature.
	 *
	 * The signature is computed over:
	 * 1. HTTP method (e.g., POST)
	 * 2. Request path
	 * 3. Sorted query parameters (excluding auth_signature and internal params)
	 * 4. Body MD5 hash (if body is present)
	 *
	 * @param request - The incoming HTTP request
	 * @throws {HttpException} 401 if signature is invalid or missing
	 */
	protected async verifySignature(request: IHttpRequest): Promise<void> {
		if (!this.application) {
			throw new HttpException(500, "Application not set.");
		}

		// Build parameters for signature, excluding internal and signature params
		const params: Record<string, string> = { ...this.query };
		delete params.auth_signature;
		delete params.body_md5;
		delete params.appId;
		delete params.appKey;
		delete params.channelName;

		// Add body MD5 if body exists
		if (this.body && this.body !== "") {
			params.body_md5 = await this.md5(this.body);
		}

		// Sort parameters by key
		const sortedKeys = Object.keys(params).sort();
		const sortedParams: Record<string, string> = {};
		for (const key of sortedKeys) {
			sortedParams[key] = params[key] ?? "";
		}

		// Build signature string
		const url = new URL(request.path, "http://localhost");
		const signatureString = [
			request.method,
			url.pathname,
			this.formatQueryParametersForVerification(sortedParams),
		].join("\n");

		// Compute HMAC-SHA256 signature
		const signature = await this.hmacSha256(
			signatureString,
			this.application.secret(),
		);
		const authSignature = this.query.auth_signature ?? "";

		if (signature !== authSignature) {
			throw new HttpException(401, "Authentication signature invalid.");
		}
	}

	/**
	 * Format query parameters for signature verification.
	 *
	 * Converts a parameters object into a query string format (key=value&key=value).
	 * Arrays are converted to comma-separated strings.
	 *
	 * @param params - The parameters to format
	 * @returns Formatted query string
	 */
	protected formatQueryParametersForVerification(
		params: Record<string, string | string[]>,
	): string {
		if (typeof params !== "object" || params === null) {
			return String(params);
		}

		return Object.entries(params)
			.map(([key, value]) => {
				const formattedValue = Array.isArray(value) ? value.join(",") : value;
				return `${key}=${formattedValue}`;
			})
			.join("&");
	}

	/**
	 * Compute HMAC-SHA256 signature.
	 *
	 * Uses the Web Crypto API (crypto.subtle) to compute an HMAC-SHA256 hash.
	 *
	 * @param data - The data to sign
	 * @param secret - The secret key
	 * @returns Hexadecimal signature string
	 */
	protected async hmacSha256(data: string, secret: string): Promise<string> {
		const encoder = new TextEncoder();
		const keyData = encoder.encode(secret);
		const messageData = encoder.encode(data);

		const key = await crypto.subtle.importKey(
			"raw",
			keyData,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);

		const signature = await crypto.subtle.sign("HMAC", key, messageData);

		// Convert ArrayBuffer to hex string
		return Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	/**
	 * Compute MD5 hash of a string.
	 *
	 * Uses Bun's native crypto implementation for MD5 hashing.
	 *
	 * @param data - The data to hash
	 * @returns Hexadecimal MD5 hash string
	 */
	protected async md5(data: string): Promise<string> {
		const hasher = new Bun.CryptoHasher("md5");
		hasher.update(data);
		return hasher.digest("hex");
	}

	/**
	 * Send an error response to the connection.
	 *
	 * Helper method for sending HTTP error responses. This can be used by
	 * subclasses to send consistent error responses.
	 *
	 * @param connection - The HTTP connection
	 * @param statusCode - The HTTP status code
	 * @param message - The error message
	 */
	protected sendError(
		_connection: Connection,
		statusCode: number,
		message: string,
	): void {
		throw new HttpException(statusCode, message);
	}
}
