import { Application } from "./application";
import type { IApplicationProvider } from "./contracts/application-provider";
import { InvalidApplication } from "./exceptions/invalid-application";

/**
 * Application configuration object structure.
 */
interface ApplicationConfig {
	app_id: string;
	key: string;
	secret: string;
	ping_interval: number;
	activity_timeout?: number;
	allowed_origins: string[];
	max_message_size: number;
	max_connections?: number | null;
	options?: Record<string, unknown>;
}

/**
 * Configuration-based application provider.
 *
 * This provider manages a collection of application configurations loaded from
 * a configuration source (e.g., config files). It implements the ApplicationProvider
 * interface to provide access to Application instances by ID, key, or other criteria.
 */
export class ConfigApplicationProvider implements IApplicationProvider {
	/**
	 * Create a new config provider instance.
	 *
	 * @param applications - Array of application configuration objects
	 */
	constructor(protected applications: ApplicationConfig[]) {}

	/**
	 * Get all of the configured applications as Application instances.
	 *
	 * @returns Array of all configured Application instances
	 */
	all(): Application[] {
		return this.applications.map((app) => {
			return this.findById(app.app_id);
		});
	}

	/**
	 * Find an application instance by ID.
	 *
	 * @param id - The application ID to search for
	 * @returns The Application instance matching the ID
	 * @throws {InvalidApplication} If no application with the given ID exists
	 */
	findById(id: string): Application {
		return this.find("app_id", id);
	}

	/**
	 * Find an application instance by key.
	 *
	 * @param key - The application key to search for
	 * @returns The Application instance matching the key
	 * @throws {InvalidApplication} If no application with the given key exists
	 */
	findByKey(key: string): Application {
		return this.find("key", key);
	}

	/**
	 * Find an application instance by a generic key-value pair.
	 *
	 * @param key - The property name to search by (e.g., 'app_id', 'key')
	 * @param value - The value to match
	 * @returns The Application instance matching the criteria
	 * @throws {InvalidApplication} If no application matches the given criteria
	 */
	find(key: string, value: unknown): Application {
		const app = this.applications.find(
			(app) => app[key as keyof ApplicationConfig] === value,
		);

		if (!app) {
			throw new InvalidApplication();
		}

		return new Application(
			app.app_id,
			app.key,
			app.secret,
			app.ping_interval,
			app.activity_timeout ?? 30,
			app.allowed_origins,
			app.max_message_size,
			app.max_connections ?? null,
			app.options ?? {},
		);
	}
}
