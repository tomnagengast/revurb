/**
 * ApplicationManager - Factory for creating application providers
 *
 * Manages the creation of application provider instances based on configured drivers.
 */

import type { ReverbAppConfig, ReverbConfig } from "./config/types";
import { ConfigApplicationProvider } from "./config-application-provider";
import type { IApplicationProvider } from "./contracts/application-provider";

/**
 * ApplicationManager class
 *
 * Factory for creating application provider instances based on configured drivers.
 */
export class ApplicationManager {
  /**
   * Create a new ApplicationManager instance.
   *
   * @param config - The Reverb configuration
   */
  constructor(private readonly config: ReverbConfig) {}

  /**
   * Get an application provider driver instance.
   *
   * @param driver - The driver name
   * @returns The application provider instance
   * @throws {Error} If the requested driver is not supported
   */
  public driver(driver?: string): IApplicationProvider {
    const driverName = driver ?? this.getDefaultDriver();

    switch (driverName) {
      case "config":
        return this.createConfigDriver();
      default:
        throw new Error(
          `Unsupported application provider driver [${driverName}].`,
        );
    }
  }

  /**
   * Create an instance of the configuration driver.
   *
   * @returns ConfigApplicationProvider instance
   */
  public createConfigDriver(): ConfigApplicationProvider {
    const reverbApps: ReverbAppConfig[] = this.config.apps?.apps ?? [];

    // Map ReverbAppConfig to the format expected by ConfigApplicationProvider
    const apps = reverbApps.map((app) => {
      const config: {
        app_id: string;
        key: string;
        secret: string;
        ping_interval: number;
        allowed_origins: string[];
        max_message_size: number;
        activity_timeout?: number;
        max_connections?: number | null;
        options?: Record<string, unknown>;
      } = {
        app_id: app.app_id,
        key: app.key,
        secret: app.secret,
        ping_interval: app.ping_interval ?? 30,
        // Default to ['*'] for broad compatibility by default
        allowed_origins: app.allowed_origins ?? ["*"],
        max_message_size: app.max_message_size ?? 10000,
      };

      // Only add optional properties if they are defined
      if (app.activity_timeout !== undefined) {
        config.activity_timeout = app.activity_timeout;
      }
      if (app.max_connections !== undefined) {
        config.max_connections = app.max_connections;
      }
      if (app.options !== undefined) {
        config.options = app.options as Record<string, unknown>;
      }

      return config;
    });

    return new ConfigApplicationProvider(apps);
  }

  /**
   * Get the default driver name.
   *
   * @returns The default driver name
   */
  public getDefaultDriver(): string {
    return this.config.apps?.provider ?? "config";
  }
}
