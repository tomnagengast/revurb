/**
 * ApplicationProvider contract - Configuration provider interface
 *
 * Provides methods to access and retrieve application configurations.
 * All find methods throw InvalidApplication if the application is not found.
 */

import type { Application } from "../application";

/**
 * ApplicationProvider interface.
 *
 * Defines the contract for application configuration providers.
 * Implementations must provide methods to retrieve applications by various criteria.
 */
export interface IApplicationProvider {
	/**
	 * Get all of the configured applications as Application instances.
	 *
	 * @returns Array of all configured Application instances
	 */
	all(): Application[];

	/**
	 * Find an application instance by ID.
	 *
	 * @param id - The application ID to search for
	 * @returns The Application instance matching the ID
	 * @throws {InvalidApplication} If no application with the given ID exists
	 */
	findById(id: string): Application;

	/**
	 * Find an application instance by key.
	 *
	 * @param key - The application key to search for
	 * @returns The Application instance matching the key
	 * @throws {InvalidApplication} If no application with the given key exists
	 */
	findByKey(key: string): Application;

	/**
	 * Find an application instance by a generic key-value pair.
	 *
	 * @param key - The property name to search by (e.g., 'app_id', 'key')
	 * @param value - The value to match
	 * @returns The Application instance matching the criteria
	 * @throws {InvalidApplication} If no application matches the given criteria
	 */
	find(key: string, value: unknown): Application;
}
