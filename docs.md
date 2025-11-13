<!-- https://laravel.com/docs/12.x/reverb.md -->
# Revurb (TypeScript Port of Laravel Reverb)

- [Introduction](#introduction)
- [Installation](#installation)
- [Configuration](#configuration)
    - [Application Credentials](#application-credentials)
    - [Allowed Origins](#allowed-origins)
    - [Additional Applications](#additional-applications)
    - [SSL](#ssl)
- [Running the Server](#running-server)
    - [Debugging](#debugging)
    - [Restarting](#restarting)
- [Monitoring](#monitoring)
- [Running Revurb in Production](#production)
    - [Open Files](#open-files)
    - [Event Loop](#event-loop)
    - [Web Server](#web-server)
    - [Ports](#ports)
    - [Process Management](#process-management)
    - [Scaling](#scaling)

<a name="introduction"></a>
## Introduction

[Revurb](https://github.com/laravel/reverb) is a TypeScript port of Laravel Reverb, bringing blazing-fast and scalable real-time WebSocket communication to your applications. It runs on Bun runtime and provides seamless integration with applications that need real-time event broadcasting capabilities.

Revurb implements the Pusher protocol, making it compatible with Pusher-compatible clients and Laravel's broadcasting system.

<a name="installation"></a>
## Installation

You may install Revurb by cloning the repository and installing dependencies:

```shell
git clone <repository-url>
cd revurb-ts
bun install
```

To build the project:

```shell
bun run build
```

<a name="configuration"></a>
## Configuration

Revurb can be configured using environment variables or a TypeScript configuration file. Configuration is loaded in the following order of precedence:

1. Path specified by `--config` CLI option
2. Environment variables (`REVERB_*`)
3. `./reverb.config.ts` file
4. Built-in defaults

<a name="application-credentials"></a>
### Application Credentials

In order to establish a connection to Revurb, a set of Revurb "application" credentials must be exchanged between the client and server. These credentials are configured on the server and are used to verify the request from the client. You may define these credentials using the following environment variables:

```bash
REVERB_APP_ID=my-app-id
REVERB_APP_KEY=my-app-key
REVERB_APP_SECRET=my-app-secret
```

Alternatively, you may configure these in a `reverb.config.ts` file:

```typescript
export default {
  default: 'reverb',
  servers: {
    reverb: {
      host: '0.0.0.0',
      port: 8080,
    },
  },
  apps: {
    provider: 'config',
    apps: [
      {
        app_id: 'my-app-id',
        key: 'my-app-key',
        secret: 'my-app-secret',
        allowed_origins: ['*'],
      },
    ],
  },
};
```

<a name="allowed-origins"></a>
### Allowed Origins

You may also define the origins from which client requests may originate by updating the value of the `allowed_origins` configuration value within the `apps` section of your configuration. Any requests from an origin not listed in your allowed origins will be rejected. You may allow all origins using `*`:

```typescript
apps: {
  provider: 'config',
  apps: [
    {
      app_id: 'my-app-id',
      allowed_origins: ['laravel.com'],
      // ...
    }
  ]
}
```

Or via environment variable:

```bash
REVERB_ALLOWED_ORIGINS=laravel.com,example.com
```

<a name="additional-applications"></a>
### Additional Applications

Typically, Revurb provides a WebSocket server for a single application. However, it is possible to serve more than one application using a single Revurb installation.

For example, you may wish to maintain a single Revurb server which provides WebSocket connectivity for multiple applications. This can be achieved by defining multiple `apps` in your configuration file:

```typescript
apps: {
  provider: 'config',
  apps: [
    {
      app_id: 'my-app-one',
      key: 'app-one-key',
      secret: 'app-one-secret',
      // ...
    },
    {
      app_id: 'my-app-two',
      key: 'app-two-key',
      secret: 'app-two-secret',
      // ...
    },
  ],
}
```

<a name="ssl"></a>
### SSL

In most cases, secure WebSocket connections are handled by the upstream web server (Nginx, etc.) before the request is proxied to your Revurb server.

However, it can sometimes be useful, such as during local development, for the Revurb server to handle secure connections directly. You may configure TLS/SSL by providing certificate paths in your configuration file:

```typescript
servers: {
  reverb: {
    host: '0.0.0.0',
    port: 8080,
    options: {
      tls: {
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        // Optional: passphrase for the key
        passphrase: 'your-passphrase',
      },
    },
  },
}
```

You may also specify a hostname when starting the server to help with certificate resolution:

```shell
bun run src/cli.ts start --hostname="laravel.test"
```

<a name="running-server"></a>
## Running the Server

The Revurb server can be started using the CLI:

```shell
bun run src/cli.ts start
```

Or if you've built the project:

```shell
bun run start
```

You can also use the built binary directly:

```shell
./dist/cli.js start
```

By default, the Revurb server will be started at `0.0.0.0:8080`, making it accessible from all network interfaces.

If you need to specify a custom host or port, you may do so via the `--host` and `--port` options when starting the server:

```shell
bun run src/cli.ts start --host=127.0.0.1 --port=9000
```

You can also specify a custom configuration file:

```shell
bun run src/cli.ts start --config=./custom.config.ts
```

Alternatively, you may define `REVERB_SERVER_HOST` and `REVERB_SERVER_PORT` environment variables in your environment configuration.

The `REVERB_SERVER_HOST` and `REVERB_SERVER_PORT` environment variables should not be confused with `REVERB_HOST` and `REVERB_PORT`. The former specify the host and port on which to run the Revurb server itself, while the latter pair instruct applications where to send broadcast messages. For example, in a production environment, you may route requests from your public Revurb hostname on port `443` to a Revurb server operating on `0.0.0.0:8080`. In this scenario, your environment variables would be defined as follows:

```bash
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080

REVERB_HOST=ws.laravel.com
REVERB_PORT=443
```

<a name="debugging"></a>
### Debugging

To improve performance, Revurb does not output any debug information by default. If you would like to see the stream of data passing through your Revurb server, you may provide the `--debug` option to the `start` command:

```shell
bun run src/cli.ts start --debug
```

<a name="restarting"></a>
### Restarting

Since Revurb is a long-running process, changes to your code will not be reflected without restarting the server. To restart the server, stop it using `Ctrl+C` and start it again.

If you are running Revurb with a process manager such as Supervisor or PM2, the server will be automatically restarted by the process manager after it stops.

> [!NOTE]
> Unlike Laravel Reverb, Revurb does not currently have a dedicated `restart` command. You must stop and start the server manually, or rely on your process manager to handle restarts.

<a name="monitoring"></a>
## Monitoring

Revurb provides a built-in health check endpoint for monitoring server status. You can access the health endpoint at:

```
GET /up
```

This endpoint returns a JSON response indicating the server's health status:

```json
{"health": "OK"}
```

The health check endpoint is useful for:
- Load balancer health checks
- Monitoring and alerting systems
- Container orchestration health probes

> [!NOTE]
> Laravel Pulse and Telescope integrations are not currently available in the TypeScript port. These are Laravel framework-specific features that would require separate implementation.

<a name="production"></a>
## Running Revurb in Production

Due to the long-running nature of WebSocket servers, you may need to make some optimizations to your server and hosting environment to ensure your Revurb server can effectively handle the optimal number of connections for the resources available on your server.

<a name="open-files"></a>
### Open Files

Each WebSocket connection is held in memory until either the client or server disconnects. In Unix and Unix-like environments, each connection is represented by a file. However, there are often limits on the number of allowed open files at both the operating system and application level.

<a name="operating-system"></a>
#### Operating System

On a Unix based operating system, you may determine the allowed number of open files using the `ulimit` command:

```shell
ulimit -n
```

This command will display the open file limits allowed for different users. You may update these values by editing the `/etc/security/limits.conf` file. For example, updating the maximum number of open files to 10,000 for the `forge` user would look like the following:

```ini
# /etc/security/limits.conf
forge        soft  nofile  10000
forge        hard  nofile  10000
```

<a name="event-loop"></a>
### Event Loop

Under the hood, Revurb uses Bun's native event loop to manage WebSocket connections on the server. Bun's event loop is highly optimized and can handle a large number of concurrent connections efficiently. Unlike PHP's ReactPHP which may be limited by `stream_select` (typically 1,024 open files), Bun's event loop can handle many more concurrent connections without requiring additional extensions.

Bun's event loop is built on top of libuv (similar to Node.js) and provides excellent performance for I/O-bound operations like WebSocket connections.

<a name="web-server"></a>
### Web Server

In most cases, Revurb runs on a non web-facing port on your server. So, in order to route traffic to Revurb, you should configure a reverse proxy. Assuming Revurb is running on host `0.0.0.0` and port `8080` and your server utilizes the Nginx web server, a reverse proxy can be defined for your Revurb server using the following Nginx site configuration:

```nginx
server {
    ...

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Scheme $scheme;
        proxy_set_header SERVER_PORT $server_port;
        proxy_set_header REMOTE_ADDR $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";

        proxy_pass http://0.0.0.0:8080;
    }

    ...
}
```

> [!WARNING]
> Revurb listens for WebSocket connections at `/app/{appKey}` (where `{appKey}` is your application key) and handles API requests at `/apps`. You should ensure the web server handling Revurb requests can serve both of these URIs.

To connect to Revurb using a WebSocket client, use the following format:

```
ws://your-server:8080/app/your-app-key?protocol=7&client=js&version=8.4.0
```

Or for secure connections:

```
wss://your-server:443/app/your-app-key?protocol=7&client=js&version=8.4.0
```

Replace `your-app-key` with the actual application key configured in your Revurb server.

Typically, web servers are configured to limit the number of allowed connections in order to prevent overloading the server. To increase the number of allowed connections on an Nginx web server to 10,000, the `worker_rlimit_nofile` and `worker_connections` values of the `nginx.conf` file should be updated:

```nginx
user forge;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;
worker_rlimit_nofile 10000;

events {
  worker_connections 10000;
  multi_accept on;
}
```

The configuration above will allow up to 10,000 Nginx workers per process to be spawned. In addition, this configuration sets Nginx's open file limit to 10,000.

<a name="ports"></a>
### Ports

Unix-based operating systems typically limit the number of ports which can be opened on the server. You may see the current allowed range via the following command:

```shell
cat /proc/sys/net/ipv4/ip_local_port_range
# 32768	60999
```

The output above shows the server can handle a maximum of 28,231 (60,999 - 32,768) connections since each connection requires a free port. Although we recommend [horizontal scaling](#scaling) to increase the number of allowed connections, you may increase the number of available open ports by updating the allowed port range in your server's `/etc/sysctl.conf` configuration file.

<a name="process-management"></a>
### Process Management

In most cases, you should use a process manager such as Supervisor or PM2 to ensure the Revurb server is continually running. If you are using Supervisor to run Revurb, you should update the `minfds` setting of your server's `supervisor.conf` file to ensure Supervisor is able to open the files required to handle connections to your Revurb server:

```ini
[supervisord]
...
minfds=10000
```

Example Supervisor configuration for Revurb:

```ini
[program:revurb]
command=bun run /path/to/revurb-ts/dist/cli.js start
directory=/path/to/revurb-ts
autostart=true
autorestart=true
user=your-user
redirect_stderr=true
stdout_logfile=/var/log/revurb.log
```

For PM2, you can create an `ecosystem.config.js` file:

```javascript
module.exports = {
  apps: [{
    name: 'revurb',
    script: './dist/cli.js',
    args: 'start',
    cwd: '/path/to/revurb-ts',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      REVERB_APP_ID: 'your-app-id',
      REVERB_APP_KEY: 'your-app-key',
      REVERB_APP_SECRET: 'your-app-secret',
    },
  }],
};
```

<a name="scaling"></a>
### Scaling

If you need to handle more connections than a single server will allow, you may scale your Revurb server horizontally. Utilizing the publish / subscribe capabilities of Redis, Revurb is able to manage connections across multiple servers. When a message is received by one of your application's Revurb servers, the server will use Redis to publish the incoming message to all other servers.

To enable horizontal scaling, you should set the `REVERB_SCALING_ENABLED` environment variable to `true` in your environment configuration:

```bash
REVERB_SCALING_ENABLED=true
```

Next, you should configure Redis connection details. Revurb will use Redis to publish messages to all of your Revurb servers:

```bash
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
# Or use a Redis URL
REDIS_URL=redis://:password@127.0.0.1:6379/0
```

You may also configure Redis in your configuration file:

```typescript
servers: {
  reverb: {
    host: '0.0.0.0',
    port: 8080,
    scaling: {
      enabled: true,
      channel: 'reverb',
      server: {
        host: '127.0.0.1',
        port: 6379,
        password: 'your-redis-password',
      },
    },
  },
}
```

Once you have enabled Revurb's scaling option and configured a Redis server, you may simply invoke the `start` command on multiple servers that are able to communicate with your Redis server. These Revurb servers should be placed behind a load balancer that distributes incoming requests evenly among the servers.

> [!NOTE]
> The default Redis implementation in Revurb is a no-op mock. For production multi-server deployments requiring Redis, you must extend the `RedisClientFactory` and override `createClient()` to use a real Redis client library such as `ioredis` or `redis`.
