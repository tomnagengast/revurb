/**
 * ServerProvider abstract class - Server lifecycle hooks
 *
 * Provides the foundation for server provider implementations with lifecycle
 * and event subscription management. Subclasses override boot() and/or register()
 * to customize initialization behavior.
 *
 * @abstract
 */
export abstract class ServerProvider {
  /**
   * Bootstrap any application services.
   *
   * Called during the server boot phase, after services have been registered.
   * Typically used to register console commands, set up event listeners,
   * or perform other bootstrapping tasks.
   *
   * @returns {void}
   */
  boot(): void {
    // Override in subclass to bootstrap services
  }

  /**
   * Register any application services.
   *
   * Called during the service registration phase, before boot().
   * Used to bind services into the dependency injection container
   * or register other core services.
   *
   * @returns {void}
   */
  register(): void {
    // Override in subclass to register services
  }

  /**
   * Determine whether the server should publish events.
   *
   * Controls whether this server instance publishes events to other
   * servers in a scaled/clustered environment. Typically based on
   * configuration settings.
   *
   * @returns {boolean} True if events should be published, false otherwise
   */
  shouldPublishEvents(): boolean {
    return false;
  }

  /**
   * Determine whether the server subscribes to events.
   *
   * Controls whether this server instance subscribes to events from other
   * servers in a scaled/clustered environment. By default, delegates to
   * shouldPublishEvents() - servers that publish also subscribe.
   *
   * @returns {boolean} True if server should subscribe to events, false otherwise
   */
  subscribesToEvents(): boolean {
    return this.shouldPublishEvents();
  }

  /**
   * Determine whether the server should not publish events.
   *
   * Convenience method that returns the negation of shouldPublishEvents().
   * Useful for conditional logic and configuration validation.
   *
   * @returns {boolean} True if events should not be published, false otherwise
   */
  shouldNotPublishEvents(): boolean {
    return !this.shouldPublishEvents();
  }

  /**
   * Determine whether the server should not subscribe to events.
   *
   * Convenience method that returns the negation of subscribesToEvents().
   * Useful for conditional logic and configuration validation.
   *
   * @returns {boolean} True if server should not subscribe, false otherwise
   */
  doesNotSubscribeToEvents(): boolean {
    return !this.subscribesToEvents();
  }
}
