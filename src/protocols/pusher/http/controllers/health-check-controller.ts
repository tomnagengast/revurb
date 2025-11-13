import type { Connection } from "../../../../servers/reverb/http/connection";
import { Response } from "../../../../servers/reverb/http/response";
import type { IHttpRequest } from "../../../../servers/reverb/http/router";
import { Controller } from "./controller";

/**
 * Health Check Controller
 *
 * Simple health check endpoint that returns 200 OK.
 * This endpoint is used for monitoring and load balancer health checks.
 *
 * @example
 * ```typescript
 * const controller = new HealthCheckController();
 * const response = controller.__invoke(request, connection);
 * // Returns: Response with {health: 'OK'}
 * ```
 */
export class HealthCheckController extends Controller {
  /**
   * Handle the health check request.
   *
   * Returns a simple JSON response indicating the server is healthy
   * and able to accept requests.
   *
   * @param request - The HTTP request object
   * @param connection - The connection object
   * @returns Response with health status
   */
  __invoke(_request: IHttpRequest, _connection: Connection): Response {
    return new Response({ health: "OK" });
  }
}
