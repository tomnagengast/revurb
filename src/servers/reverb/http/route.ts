/**
 * HTTP route handler type
 */
type RouteHandler = (req?: any, res?: any) => any | Promise<any>;

/**
 * HTTP methods supported by the route
 */
type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "CONNECT"
  | "OPTIONS"
  | "TRACE";

/**
 * Route configuration object
 */
export interface RouteConfig {
  path: string;
  methods: HttpMethod[];
  handler: RouteHandler;
}

/**
 * Route class provides static methods for creating routes for all HTTP verbs.
 * Each method creates a new Route instance and returns a route configuration.
 */
export class Route {
  private route: RouteConfig;

  /**
   * Create a new route instance.
   *
   * @param path - The route path
   */
  constructor(path: string) {
    this.route = {
      path,
      methods: [],
      handler: () => {},
    };
  }

  /**
   * Create a new `GET` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static get(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "GET", action);
  }

  /**
   * Create a new `POST` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static post(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "POST", action);
  }

  /**
   * Create a new `PUT` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static put(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "PUT", action);
  }

  /**
   * Create a new `PATCH` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static patch(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "PATCH", action);
  }

  /**
   * Create a new `DELETE` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static delete(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "DELETE", action);
  }

  /**
   * Create a new `HEAD` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static head(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "HEAD", action);
  }

  /**
   * Create a new `CONNECT` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static connect(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "CONNECT", action);
  }

  /**
   * Create a new `OPTIONS` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static options(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "OPTIONS", action);
  }

  /**
   * Create a new `TRACE` route.
   *
   * @param path - The route path
   * @param action - The route handler function
   * @returns A route configuration object
   */
  static trace(path: string, action: RouteHandler): RouteConfig {
    return Route.route(path, "TRACE", action);
  }

  /**
   * Create a new route with the specified methods.
   *
   * @param path - The route path
   * @param methods - The HTTP method(s)
   * @param action - The route handler function
   * @returns A route configuration object
   */
  protected static route(
    path: string,
    methods: HttpMethod | HttpMethod[],
    action: RouteHandler,
  ): RouteConfig {
    const methodsArray = Array.isArray(methods) ? methods : [methods];
    const routeInstance = new Route(path);

    routeInstance.route.methods = methodsArray;
    routeInstance.route.handler = action;

    return routeInstance.route;
  }

  /**
   * Set the HTTP methods for this route.
   *
   * @param methods - The HTTP method(s)
   * @returns This route instance for method chaining
   */
  methods(methods: HttpMethod[]): Route {
    this.route.methods = methods;
    return this;
  }

  /**
   * Set the handler for this route.
   *
   * @param handler - The route handler function
   * @returns This route instance for method chaining
   */
  controller(handler: RouteHandler): Route {
    this.route.handler = handler;
    return this;
  }
}

export type { RouteHandler, HttpMethod };
