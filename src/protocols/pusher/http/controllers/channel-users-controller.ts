import type { Application } from "../../../../application";
import type { IApplicationProvider } from "../../../../contracts/application-provider";
import { Factory } from "../../../../servers/reverb/factory";
import type { Connection } from "../../../../servers/reverb/http/connection";
import { Response } from "../../../../servers/reverb/http/response";
import type { IHttpRequest } from "../../../../servers/reverb/http/router";
import { isPresenceChannel } from "../../concerns/interacts-with-channel-information";
import type { ChannelManager } from "../../contracts/channel-manager";
import type { MetricsHandler } from "../../metrics-handler";

/**
 * Channel Users Controller
 *
 * Handles GET requests to retrieve the list of users in a presence channel.
 *
 * Endpoint: GET /apps/:appId/channels/:channel/users
 *
 * Returns:
 * - 404 if channel doesn't exist
 * - 400 if channel is not a presence channel
 * - 200 with list of users if successful
 *
 * Response Format:
 * {
 *   "users": [
 *     { "id": "user_id_1" },
 *     { "id": "user_id_2" },
 *     ...
 *   ]
 * }
 *
 * Authentication:
 * - Requires valid Pusher authentication signature
 * - Validates using auth_signature query parameter
 *
 * @example
 * ```typescript
 * // Usage in router
 * router.get('/apps/:appId/channels/:channel/users', channelUsersController);
 *
 * // Sample request
 * GET /apps/123456/channels/presence-chat/users?auth_key=...&auth_signature=...
 * ```
 */
export async function channelUsersController(
  request: IHttpRequest,
  _connection: Connection,
  channel: string,
  appId: string,
): Promise<Response> {
  // Verify authentication and set up application/channels
  const { application, channels } = await verify(request, _connection, appId);

  // Find the channel
  const channelInstance = channels.for(application).find(channel);

  if (!channelInstance) {
    return new Response({}, 404);
  }

  // Check if it's a presence channel
  if (!isPresenceChannel(channelInstance)) {
    return new Response({}, 400);
  }

  // Get metrics handler instance
  const metricsHandler = getMetricsHandler();

  // Gather channel users metrics
  const users = await metricsHandler.gather(application, "channel_users", {
    channel: channel,
  });

  return new Response({ users });
}

/**
 * Verify the request authentication and set up application/channels.
 *
 * This function:
 * 1. Parses query parameters
 * 2. Extracts request body
 * 3. Sets the application instance
 * 4. Sets the channel manager
 * 5. Verifies the Pusher authentication signature
 *
 * @param request - The HTTP request object
 * @param connection - The connection object
 * @param appId - The application ID from route parameters
 * @returns Object containing application and channels instances
 * @throws {Error} If authentication fails or application not found
 */
async function verify(
  request: IHttpRequest,
  _connection: Connection,
  appId: string,
): Promise<{ application: Application; channels: ChannelManager }> {
  // Parse query parameters
  const url = new URL(
    request.url || request.getPath?.() || "",
    "http://localhost",
  );
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Get request body
  const body = request.body || (await request.text?.()) || "";

  // Set application
  const application = await setApplication(appId);

  // Set channels
  const channels = getChannelManager();

  // Verify signature
  verifySignature(request, query, body, application);

  return { application, channels };
}

/**
 * Set the application instance for the given app ID.
 *
 * @param appId - The application ID
 * @returns The application instance
 * @throws {Error} If application not found
 */
async function setApplication(appId: string | null): Promise<Application> {
  if (!appId) {
    throw new Error("Application ID not provided.");
  }

  const applicationProvider = getApplicationProvider();

  try {
    return await applicationProvider.findById(appId);
  } catch (_error) {
    throw new Error(`No matching application for ID [${appId}].`);
  }
}

/**
 * Verify the Pusher authentication signature.
 *
 * @param request - The HTTP request object
 * @param query - The parsed query parameters
 * @param body - The request body
 * @param application - The application instance
 * @throws {Error} If signature is invalid
 */
function verifySignature(
  request: IHttpRequest,
  query: Record<string, string>,
  body: string,
  application: Application,
): void {
  const crypto = require("node:crypto");

  // Prepare params for signature (exclude auth_signature and internal params)
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
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

  // Add body_md5 if body is not empty
  if (body !== "") {
    params.body_md5 = crypto.createHash("md5").update(body).digest("hex");
  }

  // Sort params by key
  const sortedKeys = Object.keys(params).sort();
  const sortedParams: Record<string, string> = {};
  for (const key of sortedKeys) {
    sortedParams[key] = params[key] ?? "";
  }

  // Format params for verification
  const queryString = formatQueryParametersForVerification(sortedParams);

  // Build signature string
  const method = request.method || request.getMethod?.() || "GET";
  const path = request.url
    ? new URL(request.url, "http://localhost").pathname
    : request.getPath?.() || "/";

  const signatureString = [method, path, queryString].join("\n");

  // Generate signature
  const signature = crypto
    .createHmac("sha256", application.secret())
    .update(signatureString)
    .digest("hex");

  const authSignature = query.auth_signature || "";

  if (signature !== authSignature) {
    throw new Error("Authentication signature invalid.");
  }
}

/**
 * Format query parameters for signature verification.
 *
 * @param params - The parameters to format
 * @returns Formatted query string
 */
function formatQueryParametersForVerification(
  params: Record<string, string | string[]>,
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      parts.push(`${key}=${value.join(",")}`);
    } else {
      parts.push(`${key}=${value}`);
    }
  }

  return parts.join("&");
}

/**
 * Get the application provider instance from the Factory.
 *
 * @returns The application provider instance
 */
function getApplicationProvider(): IApplicationProvider {
  return Factory.getApplicationProvider();
}

/**
 * Get the channel manager instance from the Factory.
 *
 * @returns The channel manager instance
 */
function getChannelManager(): ChannelManager {
  return Factory.getChannelManager();
}

/**
 * Get the metrics handler instance from the Factory.
 *
 * @returns The metrics handler instance
 */
function getMetricsHandler(): MetricsHandler {
  return Factory.getMetricsHandler();
}
