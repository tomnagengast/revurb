import type { IApplicationProvider } from "../../../../contracts/application-provider";
import type { Connection } from "../../../../servers/reverb/http/connection";
import type { IHttpRequest } from "../../../../servers/reverb/http/request";
import { Response } from "../../../../servers/reverb/http/response";
import type { ChannelManager } from "../../contracts/channel-manager";
import type { MetricsHandler } from "../../metrics-handler";
import { Controller } from "./controller";

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
export class ChannelsController extends Controller {
  /**
   * Create a new ChannelsController instance.
   *
   * @param metricsHandler - The metrics handler for gathering channel information
   * @param applicationProvider - The application provider for finding applications
   * @param channelManager - The channel manager for accessing channels
   */
  constructor(
    protected metricsHandler: MetricsHandler,
    protected override applicationProvider: IApplicationProvider,
    protected override channelManager: ChannelManager,
  ) {
    super(applicationProvider, channelManager);
  }

  /**
   * Handle the request.
   *
   * @param request - The HTTP request
   * @param connection - The HTTP connection
   * @param appId - The application ID from the route
   * @returns Promise resolving to the HTTP response
   */
  async handle(
    request: IHttpRequest,
    _connection: Connection,
    appId: string,
  ): Promise<Response> {
    this.verify(request, _connection, appId);

    if (!this.application) {
      throw new Error("Application not set.");
    }

    const options: Record<string, string> = {};
    if (this.query.filter_by_prefix) {
      options.filter = this.query.filter_by_prefix;
    }
    if (this.query.info) {
      options.info = this.query.info;
    }

    const channels = await this.metricsHandler.gather(
      this.application,
      "channels",
      options,
    );

    // Convert channels object to array format expected by Pusher API
    if (
      typeof channels === "object" &&
      channels !== null &&
      !Array.isArray(channels)
    ) {
      return new Response({
        channels: this.formatChannels(channels as Record<string, unknown>),
      });
    }
    return new Response({ channels: {} });
  }

  /**
   * Format channels object into Pusher-compatible response format.
   *
   * @param channels - Record of channel names to channel info
   * @returns Object with channels property containing the formatted data
   */
  protected formatChannels(
    channels: Record<string, unknown>,
  ): Record<string, unknown> {
    // Convert each channel info object to a plain object
    const formatted: Record<string, unknown> = {};

    for (const [name, info] of Object.entries(channels)) {
      if (typeof info === "object" && info !== null) {
        formatted[name] = { ...info };
      } else {
        formatted[name] = info;
      }
    }

    return formatted;
  }
}
