import type {
  ReverbConfig,
  ReverbServerConfig,
  ReverbAppConfig,
  AppsConfig,
  ScalingConfig,
  RedisServerConfig,
  AppConnectionOptions,
  ServerOptions,
} from './types.js';

/**
 * Read an environment variable with an optional default value
 *
 * @param key - The environment variable key
 * @param defaultValue - The default value if the environment variable is not set
 * @returns The environment variable value or the default value
 */
export function env(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Read an environment variable and parse it as a boolean
 *
 * Handles common boolean string representations:
 * - true: 'true', '1', 'yes', 'on'
 * - false: 'false', '0', 'no', 'off', empty string
 *
 * @param key - The environment variable key
 * @param defaultValue - The default boolean value if the environment variable is not set
 * @returns The parsed boolean value
 */
export function envBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

/**
 * Read an environment variable and parse it as an integer
 *
 * @param key - The environment variable key
 * @param defaultValue - The default number value if the environment variable is not set
 * @returns The parsed integer value
 */
export function envInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Read an environment variable and parse it as an array by splitting on a delimiter
 *
 * @param key - The environment variable key
 * @param delimiter - The delimiter to split the string on (default: ',')
 * @param defaultValue - The default array value if the environment variable is not set
 * @returns The parsed array value
 */
export function envArray(
  key: string,
  delimiter: string = ',',
  defaultValue: string[] = []
): string[] {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value
    .split(delimiter)
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Load Redis server configuration from environment variables
 *
 * @returns The Redis server configuration
 */
function loadRedisServerConfig(): RedisServerConfig {
  const url = env('REDIS_URL');
  const host = env('REDIS_HOST', '127.0.0.1');
  const port = env('REDIS_PORT', '6379');
  const username = env('REDIS_USERNAME');
  const password = env('REDIS_PASSWORD');
  const database = env('REDIS_DB', '0');
  const timeout = envInt('REDIS_TIMEOUT', 60);

  return {
    ...(url !== undefined ? { url } : {}),
    ...(host !== undefined ? { host } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(password !== undefined ? { password } : {}),
    ...(database !== undefined ? { database } : {}),
    ...(timeout !== undefined ? { timeout } : {}),
  };
}

/**
 * Load scaling configuration from environment variables
 *
 * @returns The scaling configuration
 */
function loadScalingConfig(): ScalingConfig {
  const channel = env('REVERB_SCALING_CHANNEL', 'reverb');
  const server = loadRedisServerConfig();

  return {
    enabled: envBool('REVERB_SCALING_ENABLED', false),
    ...(channel !== undefined ? { channel } : {}),
    ...(Object.keys(server).length > 0 ? { server } : {}),
  };
}

/**
 * Load server options from environment variables
 *
 * @returns The server options
 */
function loadServerOptions(): ServerOptions {
  return {
    tls: {},
  };
}

/**
 * Load Reverb server configuration from environment variables
 *
 * @returns The Reverb server configuration
 */
function loadReverbServerConfig(): ReverbServerConfig {
  const path = env('REVERB_SERVER_PATH', '');
  const hostname = env('REVERB_HOST');
  const options = loadServerOptions();
  const max_request_size = envInt('REVERB_MAX_REQUEST_SIZE', 10000);
  const scaling = loadScalingConfig();
  const pulse_ingest_interval = envInt('REVERB_PULSE_INGEST_INTERVAL', 15);
  const telescope_ingest_interval = envInt('REVERB_TELESCOPE_INGEST_INTERVAL', 15);

  return {
    host: env('REVERB_SERVER_HOST', '0.0.0.0')!,
    port: envInt('REVERB_SERVER_PORT', 8080),
    ...(path !== undefined ? { path } : {}),
    ...(hostname !== undefined ? { hostname } : {}),
    ...(options !== undefined ? { options } : {}),
    ...(max_request_size !== undefined ? { max_request_size } : {}),
    ...(scaling !== undefined ? { scaling } : {}),
    ...(pulse_ingest_interval !== undefined ? { pulse_ingest_interval } : {}),
    ...(telescope_ingest_interval !== undefined ? { telescope_ingest_interval } : {}),
  };
}

/**
 * Load application connection options from environment variables
 *
 * @returns The application connection options
 */
function loadAppConnectionOptions(): AppConnectionOptions {
  const scheme = env('REVERB_SCHEME', 'https') as 'http' | 'https';
  const host = env('REVERB_HOST');
  const port = envInt('REVERB_PORT', 443);
  const useTLS = scheme === 'https';

  return {
    ...(host !== undefined ? { host } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(scheme !== undefined ? { scheme } : {}),
    ...(useTLS !== undefined ? { useTLS } : {}),
  };
}

/**
 * Load Reverb application configuration from environment variables
 *
 * @returns The Reverb application configuration
 */
function loadReverbAppConfig(): ReverbAppConfig {
  const key = env('REVERB_APP_KEY');
  const secret = env('REVERB_APP_SECRET');
  const appId = env('REVERB_APP_ID');

  if (!key || !secret || !appId) {
    throw new Error(
      'Missing required application credentials. Please set REVERB_APP_KEY, REVERB_APP_SECRET, and REVERB_APP_ID environment variables.'
    );
  }

  const options = loadAppConnectionOptions();
  const allowed_origins = envArray('REVERB_ALLOWED_ORIGINS', ',', ['*']);
  const ping_interval = envInt('REVERB_APP_PING_INTERVAL', 60);
  const activity_timeout = envInt('REVERB_APP_ACTIVITY_TIMEOUT', 30);
  const max_connections = env('REVERB_APP_MAX_CONNECTIONS')
    ? envInt('REVERB_APP_MAX_CONNECTIONS', 0)
    : undefined;
  const max_message_size = envInt('REVERB_APP_MAX_MESSAGE_SIZE', 10000);

  return {
    key,
    secret,
    app_id: appId,
    ...(Object.keys(options).length > 0 ? { options } : {}),
    ...(allowed_origins !== undefined ? { allowed_origins } : {}),
    ...(ping_interval !== undefined ? { ping_interval } : {}),
    ...(activity_timeout !== undefined ? { activity_timeout } : {}),
    ...(max_connections !== undefined ? { max_connections } : {}),
    ...(max_message_size !== undefined ? { max_message_size } : {}),
  };
}

/**
 * Load applications configuration from environment variables
 *
 * @returns The applications configuration
 */
function loadAppsConfig(): AppsConfig {
  return {
    provider: 'config',
    apps: [loadReverbAppConfig()],
  };
}

/**
 * Load the complete Reverb configuration from environment variables or config file
 *
 * This function reads all necessary environment variables and constructs
 * a complete ReverbConfig object with sensible defaults matching the PHP
 * Laravel configuration.
 *
 * If a configPath is provided, it will attempt to load and merge that configuration
 * with environment variables (env vars take precedence).
 *
 * Required environment variables:
 * - REVERB_APP_KEY: Application key for authentication
 * - REVERB_APP_SECRET: Application secret for authentication
 * - REVERB_APP_ID: Application ID
 *
 * Optional environment variables (with defaults):
 * - REVERB_SERVER (default: 'reverb')
 * - REVERB_SERVER_HOST (default: '0.0.0.0')
 * - REVERB_SERVER_PORT (default: 8080)
 * - REVERB_SERVER_PATH (default: '')
 * - REVERB_HOST (default: undefined)
 * - REVERB_MAX_REQUEST_SIZE (default: 10000)
 * - REVERB_SCALING_ENABLED (default: false)
 * - REVERB_SCALING_CHANNEL (default: 'reverb')
 * - REDIS_URL (default: undefined)
 * - REDIS_HOST (default: '127.0.0.1')
 * - REDIS_PORT (default: '6379')
 * - REDIS_USERNAME (default: undefined)
 * - REDIS_PASSWORD (default: undefined)
 * - REDIS_DB (default: '0')
 * - REDIS_TIMEOUT (default: 60)
 * - REVERB_PULSE_INGEST_INTERVAL (default: 15)
 * - REVERB_TELESCOPE_INGEST_INTERVAL (default: 15)
 * - REVERB_PORT (default: 443)
 * - REVERB_SCHEME (default: 'https')
 * - REVERB_APP_PING_INTERVAL (default: 60)
 * - REVERB_APP_ACTIVITY_TIMEOUT (default: 30)
 * - REVERB_APP_MAX_CONNECTIONS (default: undefined)
 * - REVERB_APP_MAX_MESSAGE_SIZE (default: 10000)
 * - REVERB_ALLOWED_ORIGINS (default: '*', comma-separated)
 *
 * @param configPath - Optional path to a configuration file to load
 * @throws {Error} If required environment variables are not set
 * @returns The complete Reverb configuration
 */
export async function loadConfig(configPath?: string): Promise<ReverbConfig> {
  const defaultServer = env('REVERB_SERVER', 'reverb')!;

  // Build default config from environment
  const envConfig: ReverbConfig = {
    default: defaultServer,
    servers: {
      [defaultServer]: loadReverbServerConfig(),
    },
    apps: loadAppsConfig(),
  };

  // If a config file path is provided, try to load and merge it
  if (configPath) {
    try {
      const fileConfig = await import(configPath);
      const config = fileConfig.default || fileConfig;

      // Merge configs - env vars take precedence
      return {
        ...config,
        ...envConfig,
        servers: {
          ...config.servers,
          ...envConfig.servers,
        },
        apps: {
          ...config.apps,
          ...envConfig.apps,
        },
      };
    } catch (error) {
      // If config file doesn't exist or can't be loaded, just use env config
      console.warn(`Warning: Could not load config file at ${configPath}, using environment variables`);
    }
  }

  return envConfig;
}
