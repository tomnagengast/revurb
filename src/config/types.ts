/**
 * TLS configuration options for the server
 */
export interface TlsOptions {
  /** Path to the SSL certificate file */
  cert?: string;
  /** Path to the SSL key file */
  key?: string;
  /** Passphrase for the SSL key */
  passphrase?: string;
  /** Additional TLS options */
  [key: string]: unknown;
}

/**
 * Server options including TLS configuration
 */
export interface ServerOptions {
  /** TLS/SSL configuration options */
  tls?: TlsOptions;
}

/**
 * Redis server configuration for scaling
 */
export interface RedisServerConfig {
  /** Redis connection URL (alternative to host/port) */
  url?: string;
  /** Redis server host */
  host?: string;
  /** Redis server port */
  port?: string | number;
  /** Redis username for authentication */
  username?: string;
  /** Redis password for authentication */
  password?: string;
  /** Redis database number to use */
  database?: string | number;
  /** Connection timeout in seconds */
  timeout?: number;
}

/**
 * Scaling configuration for horizontal scaling across multiple servers
 */
export interface ScalingConfig {
  /** Whether scaling is enabled */
  enabled: boolean;
  /** Redis pub/sub channel name for scaling coordination */
  channel?: string;
  /** Redis server configuration for scaling */
  server?: RedisServerConfig;
}

/**
 * Reverb server configuration
 */
export interface ReverbServerConfig {
  /** Server bind host (e.g., '0.0.0.0' for all interfaces) */
  host: string;
  /** Server port number */
  port: number;
  /** Server path prefix for WebSocket endpoint */
  path?: string;
  /** Public hostname for the server */
  hostname?: string;
  /** Server options including TLS configuration */
  options?: ServerOptions;
  /** Maximum request size in bytes */
  max_request_size?: number;
  /** Scaling configuration for horizontal scaling */
  scaling?: ScalingConfig;
  /** Interval in seconds for ingesting Pulse data */
  pulse_ingest_interval?: number;
  /** Interval in seconds for ingesting Telescope data */
  telescope_ingest_interval?: number;
}

/**
 * Application connection options
 */
export interface AppConnectionOptions {
  /** Public host for client connections */
  host?: string;
  /** Public port for client connections */
  port?: number;
  /** Connection scheme (http or https) */
  scheme?: "http" | "https";
  /** Whether to use TLS for connections */
  useTLS?: boolean;
}

/**
 * Reverb application configuration
 */
export interface ReverbAppConfig {
  /** Application key for authentication */
  key: string;
  /** Application secret for authentication */
  secret: string;
  /** Application ID */
  app_id: string;
  /** Client connection options */
  options?: AppConnectionOptions;
  /** List of allowed origins for CORS (* for all) */
  allowed_origins?: string[];
  /** Interval in seconds between ping messages to keep connections alive */
  ping_interval?: number;
  /** Timeout in seconds for connection activity before disconnecting */
  activity_timeout?: number;
  /** Maximum number of concurrent connections allowed */
  max_connections?: number;
  /** Maximum message size in bytes */
  max_message_size?: number;
}

/**
 * Application provider configuration
 */
export interface AppsConfig {
  /** Provider type for application management */
  provider: "config" | string;
  /** List of application configurations */
  apps: ReverbAppConfig[];
}

/**
 * Complete Reverb configuration
 */
export interface ReverbConfig {
  /** Default server name to use */
  default: string;
  /** Map of server configurations by name */
  servers: {
    [name: string]: ReverbServerConfig;
  };
  /** Application configurations */
  apps: AppsConfig;
}
