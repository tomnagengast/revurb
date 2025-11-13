/**
 * ApplicationManager - Factory for creating application providers
 *
 * Manages the creation of application provider instances based on configured drivers.
 * This is a simplified implementation that replaces Laravel's Manager base class
 * with a basic factory pattern suitable for TypeScript/Bun.
 *
 * Responsibilities:
 * - Creates application provider instances based on driver configuration
 * - Supports multiple driver types (currently only 'config')
 * - Retrieves default driver from configuration
 *
 * Architecture Notes:
 * - Replaces Laravel's Manager class with a simple factory pattern
 * - Configuration is injected via constructor for dependency inversion
 * - Driver methods follow naming convention: create{Driver}Driver()
 *
 * @example
 * ```typescript
 * import { ApplicationManager } from './application-manager';
 * import type { ReverbConfig } from './config/types';
 *
 * // Create manager with configuration
 * const manager = new ApplicationManager(config);
 *
 * // Get default driver provider
 * const provider = manager.driver();
 *
 * // Get specific driver
 * const configProvider = manager.driver('config');
 * ```
 */

import type { ReverbAppConfig, ReverbConfig } from "./config/types";
import { ConfigApplicationProvider } from "./config-application-provider";
import type { IApplicationProvider } from "./contracts/application-provider";

/**
 * ApplicationManager class
 *
 * Factory for creating application provider instances based on configured drivers.
 * Provides a simple manager pattern for switching between different application
 * provider implementations (currently only 'config' driver is supported).
 */
export class ApplicationManager {
	/**
	 * Create a new ApplicationManager instance.
	 *
	 * @param config - The Reverb configuration containing app provider settings
	 */
	constructor(private readonly config: ReverbConfig) {}

	/**
	 * Get an application provider driver instance.
	 *
	 * Returns a provider instance for the specified driver name. If no driver
	 * name is provided, uses the default driver from configuration.
	 *
	 * @param driver - The driver name (default: uses getDefaultDriver())
	 * @returns The application provider instance
	 * @throws {Error} If the requested driver is not supported
	 *
	 * @example
	 * ```typescript
	 * // Get default driver
	 * const provider = manager.driver();
	 *
	 * // Get specific driver
	 * const configProvider = manager.driver('config');
	 * ```
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
	 * The config driver loads applications from the configuration file.
	 * This is the default and currently only supported driver.
	 *
	 * @returns ConfigApplicationProvider instance with configured apps
	 *
	 * @example
	 * ```typescript
	 * const provider = manager.createConfigDriver();
	 * const apps = provider.all();
	 * ```
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
				// Default to ['*'] to match PHP behavior - empty array blocks everything
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
				config.options = app.options;
			}

			return config;
		});

		return new ConfigApplicationProvider(apps);
	}

	/**
	 * Get the default driver name.
	 *
	 * Retrieves the default application provider driver from configuration.
	 * Falls back to 'config' if not specified.
	 *
	 * @returns The default driver name (typically 'config')
	 *
	 * @example
	 * ```typescript
	 * const defaultDriver = manager.getDefaultDriver();
	 * console.log(defaultDriver); // 'config'
	 * ```
	 */
	public getDefaultDriver(): string {
		return this.config.apps?.provider ?? "config";
	}
}
