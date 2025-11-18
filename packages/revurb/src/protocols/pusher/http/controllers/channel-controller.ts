import type { Application } from "../../../../application";
import type { IApplicationProvider } from "../../../../contracts/application-provider";
import { Response } from "../../../../servers/reverb/http/response";
import type { ChannelManager } from "../../contracts/channel-manager";
import type { MetricsHandler } from "../../metrics-handler";

/**
 * ChannelController
 *
 * Handles GET /apps/:appId/channels/:channel endpoint.
 * Returns information about a specific channel including:
 * - occupied: Whether the channel has any connections
 * - user_count: Number of unique users (presence channels only)
 * - subscription_count: Number of subscriptions (non-presence channels)
 * - cache: Cached payload (cache channels only)
 *
 * This controller implements the Pusher HTTP API specification for retrieving
 * channel information. It requires proper authentication via Pusher signature.
 *
 * @example
 * GET /apps/app123/channels/my-channel?info=user_count,subscription_count
 */
export class ChannelController {
  /**
   * The current application instance
   */
  protected application: Application | null = null;

  /**
   * The active channels for the application
   */
  protected channels: ChannelManager | null = null;

  /**
   * The incoming request's body
   */
  protected body: string | null = null;

  /**
   * The incoming request's query parameters
   */
  protected query: Record<string, string> = {};

  /**
   * Create a new ChannelController instance.
   *
   * @param applicationProvider - Provider for application configuration
   * @param channelManager - Manager for channel operations
   * @param metricsHandler - Handler for gathering metrics
   */
  constructor(
    protected applicationProvider: IApplicationProvider,
    protected channelManager: ChannelManager,
    protected metricsHandler: MetricsHandler,
  ) {}

  /**
   * Handle the incoming request.
   *
   * @param request - The incoming HTTP request
   * @param appId - The application ID from the route
   * @param channel - The channel name from the route
   * @returns Promise resolving to a Response with channel information
   *
   * @example
   * ```typescript
   * const controller = new ChannelController(appProvider, channelManager, metricsHandler);
   * const response = await controller.handle(request, 'app123', 'my-channel');
   * ```
   */
  async handle(
    request: Request,
    appId: string,
    channel: string,
  ): Promise<Response> {
    // Verify the request (authentication, app ID, etc.)
    await this.verify(request, appId);

    // Parse query parameters
    const url = new URL(request.url);
    const infoParam = url.searchParams.get("info");

    // Add 'occupied' to the info fields if not already present
    const info = infoParam ? `${infoParam},occupied` : "occupied";

    if (!this.application) {
      throw new Error("Application not set.");
    }

    // Gather channel metrics
    const channelData = await this.metricsHandler.gather(
      this.application,
      "channel",
      {
        channel,
        info,
      },
    );

    // Return response with channel data
    return new Response(channelData);
  }

  /**
   * Verify that the incoming request is valid.
   *
   * This method:
   * 1. Parses the request query parameters
   * 2. Reads the request body
   * 3. Sets the application instance
   * 4. Sets the channel manager
   * 5. Verifies the Pusher signature
   *
   * @param request - The incoming HTTP request
   * @param appId - The application ID
   * @throws {HttpException} If verification fails
   */
  protected async verify(request: Request, appId: string): Promise<void> {
    // Parse query parameters
    const url = new URL(request.url);
    this.query = {};
    url.searchParams.forEach((value, key) => {
      this.query[key] = value;
    });

    // Read request body
    this.body = await request.text();

    // Set application and channels
    this.setApplication(appId);
    this.setChannels();

    // Verify signature
    this.verifySignature(request);
  }

  /**
   * Set the Reverb application instance for the incoming request's application ID.
   *
   * @param appId - The application ID
   * @throws {Error} If application ID is not provided or application not found
   */
  protected setApplication(appId: string | null): void {
    if (!appId) {
      throw new Error("Application ID not provided.");
    }

    try {
      this.application = this.applicationProvider.findById(appId);
    } catch (_error) {
      throw new Error(`No matching application for ID [${appId}].`);
    }
  }

  /**
   * Set the Reverb channel manager instance for the application.
   */
  protected setChannels(): void {
    if (!this.application) {
      throw new Error("Application not set");
    }
    this.channels = this.channelManager.for(this.application);
  }

  /**
   * Verify the Pusher authentication signature.
   *
   * The signature is computed from:
   * 1. HTTP method (GET, POST, etc.)
   * 2. Request path
   * 3. Query parameters (sorted, excluding auth_signature)
   * 4. Body MD5 (if body is not empty)
   *
   * @param request - The incoming HTTP request
   * @throws {Error} If signature verification fails
   */
  protected verifySignature(request: Request): void {
    if (!this.application) {
      throw new Error("Application not set");
    }

    // Exclude certain parameters from signature calculation
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.query)) {
      if (
        ![
          "auth_signature",
          "body_md5",
          "appId",
          "appKey",
          "channelName",
        ].includes(key)
      ) {
        params[key] = value;
      }
    }

    // Add body MD5 if body is not empty
    if (this.body && this.body !== "") {
      params.body_md5 = this.md5(this.body);
    }

    // Sort parameters by key
    const sortedKeys = Object.keys(params).sort();
    const sortedParams: Record<string, string> = {};
    for (const key of sortedKeys) {
      sortedParams[key] = params[key] ?? "";
    }

    // Format query parameters for verification
    const queryString = this.formatQueryParametersForVerification(sortedParams);

    // Build signature string
    const url = new URL(request.url);
    const signatureString = [request.method, url.pathname, queryString].join(
      "\n",
    );

    // Compute HMAC SHA256 signature
    const signature = this.hmacSha256(
      signatureString,
      this.application.secret(),
    );
    const authSignature = this.query.auth_signature ?? "";

    if (signature !== authSignature) {
      throw new Error("Authentication signature invalid.");
    }
  }

  /**
   * Format the given parameters into the correct format for signature verification.
   *
   * Converts parameters object into a query string format: key1=value1&key2=value2
   * Arrays are joined with commas.
   *
   * @param params - The parameters to format
   * @returns Formatted query string
   */
  protected formatQueryParametersForVerification(
    params: Record<string, string | string[]>,
  ): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      const formattedValue = Array.isArray(value) ? value.join(",") : value;
      parts.push(`${key}=${formattedValue}`);
    }

    return parts.join("&");
  }

  /**
   * Compute HMAC SHA256 signature.
   *
   * @param data - The data to sign
   * @param secret - The secret key
   * @returns The hexadecimal signature
   */
  protected hmacSha256(data: string, secret: string): string {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);

    // Use Node.js crypto module for HMAC
    const crypto = require("node:crypto");
    const hmac = crypto.createHmac("sha256", keyData);
    hmac.update(messageData);
    return hmac.digest("hex");
  }

  /**
   * Compute MD5 hash of a string.
   *
   * @param data - The data to hash
   * @returns The hexadecimal MD5 hash
   */
  protected md5(data: string): string {
    const crypto = require("node:crypto");
    return crypto.createHash("md5").update(data).digest("hex");
  }
}
