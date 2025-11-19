import type { Application } from "../../../../application";
import type { ServerProvider } from "../../../../contracts/server-provider";
import type { Connection } from "../../../../servers/reverb/http/connection";
import { Response } from "../../../../servers/reverb/http/response";
import type { IHttpRequest } from "../../../../servers/reverb/http/router";
import type { ChannelManager } from "../../contracts/channel-manager";
import { dispatch } from "../../event-dispatcher";
import type { MetricsHandler } from "../../metrics-handler";

/**
 * Batch item structure
 */
interface BatchItem {
  name: string;
  channel: string;
  data: string;
  socket_id?: string;
  info?: string;
}

/**
 * Validation error structure
 */
interface ValidationErrors {
  [key: string]: string[];
}

/**
 * EventsBatchController - Handles batch event dispatching
 *
 * Implements POST /apps/:appId/batch_events endpoint for triggering
 * multiple events in a single API call. Supports batches of up to 10 events.
 *
 * Key Features:
 * - Validates batch size (max 10 events)
 * - Dispatches events using EventDispatcher
 * - Optionally gathers channel metrics for each event
 * - Returns batch results with channel info
 *
 * Request Format:
 * ```json
 * {
 *   "batch": [
 *     {
 *       "name": "my-event",
 *       "channel": "my-channel",
 *       "data": "{\"message\":\"hello\"}",
 *       "socket_id": "123.456",
 *       "info": "subscription_count"
 *     }
 *   ]
 * }
 * ```
 *
 * Response Format:
 * ```json
 * {
 *   "batch": [
 *     { "subscription_count": 5 },
 *     { "subscription_count": 3 }
 *   ]
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Usage with dependency injection
 * const controller = new EventsBatchController(metricsHandler);
 * const response = await controller.handle(request, connection, appId, application, channels);
 * ```
 */
export class EventsBatchController {
  /**
   * Create a new EventsBatchController instance.
   *
   * @param metricsHandler - The metrics handler for gathering channel info
   */
  constructor(private readonly metricsHandler: MetricsHandler) {}

  /**
   * Handle the batch events request.
   *
   * This method:
   * 1. Parses and validates the request body
   * 2. Dispatches each event to its channel
   * 3. Gathers metrics for events that request channel info
   * 4. Returns the batch results
   *
   * @param request - The HTTP request object
   * @param connection - The HTTP connection
   * @param appId - The application ID from route parameters
   * @param application - The verified application instance
   * @param channels - The channel manager scoped to the application
   * @param serverProvider - The server provider for scaling support
   * @returns Response object with batch results
   */
  async handle(
    request: IHttpRequest,
    _connection: Connection,
    _appId: string,
    application: Application,
    channels: ChannelManager,
    serverProvider?: ServerProvider,
  ): Promise<Response> {
    // Parse request body
    const body = this.getBody(request);
    let payload: unknown;

    try {
      payload = JSON.parse(body) as { batch?: BatchItem[] };
    } catch (_error) {
      return new Response(
        {
          message: "Invalid JSON in request body",
          errors: { body: ["The body must be valid JSON"] },
        },
        422,
      );
    }

    // Validate payload
    const validationErrors = this.validate(payload);
    if (validationErrors) {
      return new Response(
        { message: "Validation failed", errors: validationErrors },
        422,
      );
    }

    const typedPayload = payload as { batch: BatchItem[] };
    const batch = typedPayload.batch;

    // Process each batch item
    const items = batch.map((item) => {
      // Dispatch the event
      const channelConnection = item.socket_id
        ? (channels.connections()[item.socket_id] ?? null)
        : null;
      const excludeConnection = channelConnection
        ? channelConnection.connection()
        : null;

      if (serverProvider) {
        dispatch(
          application,
          {
            event: item.name,
            channel: item.channel,
            data: item.data,
          },
          channels,
          serverProvider,
          excludeConnection,
        );
      }

      // Return promise for metrics gathering if requested
      return item.info
        ? this.metricsHandler.gather(application, "channel", {
            channel: item.channel,
            info: item.info,
          })
        : Promise.resolve({});
    });

    // Check if any items requested metrics
    const hasMetrics = batch.some((item) => item.info);

    if (hasMetrics) {
      // Wait for all metrics to be gathered
      const results = await Promise.all(items);
      return new Response({
        batch: results.map((result) => result || {}),
      });
    }

    // No metrics requested, return empty batch object
    return new Response({ batch: {} });
  }

  /**
   * Validate the request payload.
   *
   * Validates:
   * - batch is required and must be an array
   * - batch must contain at most 10 items
   * - Each item must have required fields (name, data, channel)
   * - Each item's fields must be strings
   *
   * @param payload - The parsed request body
   * @returns Validation errors object or null if valid
   */
  protected validate(payload: unknown): ValidationErrors | null {
    const errors: ValidationErrors = {};

    // Validate batch field exists
    if (!payload || typeof payload !== "object") {
      errors.batch = ["The batch field is required."];
      return errors;
    }

    const payloadObj = payload as Record<string, unknown>;

    if (!payloadObj.batch) {
      errors.batch = ["The batch field is required."];
      return errors;
    }

    // Validate batch is an array
    if (!Array.isArray(payloadObj.batch)) {
      errors.batch = ["The batch field must be an array."];
      return errors;
    }

    // Validate batch size (max 10 events)
    if (payloadObj.batch.length > 10) {
      errors.batch = ["The batch may not contain more than 10 events."];
      return errors;
    }

    // Validate each batch item
    const batch = payloadObj.batch as unknown[];
    batch.forEach((item: unknown, index: number) => {
      if (typeof item !== "object" || item === null) {
        errors[`batch.${index}`] = ["The batch item must be an object."];
        return;
      }

      const itemObj = item as Record<string, unknown>;

      // Validate name
      if (!itemObj.name) {
        errors[`batch.${index}.name`] = ["The name field is required."];
      } else if (typeof itemObj.name !== "string") {
        errors[`batch.${index}.name`] = ["The name field must be a string."];
      }

      // Validate data
      if (!itemObj.data) {
        errors[`batch.${index}.data`] = ["The data field is required."];
      } else if (typeof itemObj.data !== "string") {
        errors[`batch.${index}.data`] = ["The data field must be a string."];
      }

      // Validate channel (required_without channels, but in batch mode it's just required)
      if (!itemObj.channel) {
        errors[`batch.${index}.channel`] = ["The channel field is required."];
      } else if (typeof itemObj.channel !== "string") {
        errors[`batch.${index}.channel`] = [
          "The channel field must be a string.",
        ];
      }

      // Validate optional socket_id field
      if (
        itemObj.socket_id !== undefined &&
        typeof itemObj.socket_id !== "string"
      ) {
        errors[`batch.${index}.socket_id`] = [
          "The socket_id field must be a string.",
        ];
      }

      // Validate optional info field
      if (itemObj.info !== undefined && typeof itemObj.info !== "string") {
        errors[`batch.${index}.info`] = ["The info field must be a string."];
      }
    });

    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Get the request body content.
   *
   * Extracts the body string from the HTTP request object.
   * The body should contain the JSON-encoded batch payload.
   *
   * @param request - The HTTP request object
   * @returns The request body as a string
   */
  protected getBody(request: IHttpRequest): string {
    // Access body from the request object
    // IHttpRequest has a body property directly
    return request.body || "";
  }
}

/**
 * Factory function to create a controller handler.
 *
 * This function creates a controller callback that can be used with the router.
 * It handles dependency injection and wires up the controller with its dependencies.
 *
 * Usage Notes:
 * - This assumes that request verification (authentication) happens at the router level
 * - The application and channels parameters must be provided by the route handler
 * - This follows the pattern where controllers receive pre-verified context
 *
 * @param metricsHandler - The metrics handler instance
 * @returns Controller callback function
 *
 * @example
 * ```typescript
 * const handler = createEventsBatchController(metricsHandler);
 * router.post('/apps/:appId/batch_events', handler);
 * ```
 */
export function createEventsBatchController(
  metricsHandler: MetricsHandler,
): (
  request: IHttpRequest,
  connection: Connection,
  appId: string,
  application: Application,
  channels: ChannelManager,
) => Promise<Response> {
  const controller = new EventsBatchController(metricsHandler);
  // Note: createEventsBatchController factory doesn't support serverProvider injection yet
  // This factory is likely deprecated or needs updating if used.
  // For now, using the class directly in factory.ts is preferred.
  return (request, _connection, _appId, application, channels) =>
    controller.handle(request, _connection, _appId, application, channels);
}
