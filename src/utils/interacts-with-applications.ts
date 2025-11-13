import type { Application } from "../application";

/**
 * Interface for classes that can be scoped to a specific application.
 */
export interface InteractsWithApplications {
  /**
   * The application instance.
   */
  application?: Application;

  /**
   * Set the application the instance should be scoped to.
   *
   * @param application - The application to scope to
   * @returns The instance for method chaining
   */
  for(application: Application): this;
}

/**
 * Base implementation that can be used to implement the InteractsWithApplications interface.
 * This provides the basic functionality for setting and managing an application instance.
 */
export abstract class InteractsWithApplicationsBase
  implements InteractsWithApplications
{
  /**
   * The application instance.
   */
  application?: Application;

  /**
   * Set the application the instance should be scoped to.
   *
   * @param application - The application to scope to
   * @returns The instance for method chaining
   */
  for(application: Application): this {
    this.application = application;
    return this;
  }
}
