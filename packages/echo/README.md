# @revurb/echo

A generic, framework-agnostic WebSocket client for Revurb, compatible with Laravel Echo server protocols (Reverb, Pusher, Socket.io).

This package is a TypeScript port of `laravel-echo` designed for the Bun/modern JS ecosystem, removing the dependency on `laravel-echo` while maintaining architectural parity.

## Installation

```bash
bun add @revurb/echo pusher-js
```

## Usage

### Basic Usage (Reverb)

By default, `@revurb/echo` is configured for Reverb (the default Revurb broadcaster).

```ts
import Echo from "@revurb/echo";

const echo = new Echo({
  broadcaster: "reverb",
  key: "your-app-key",
  wsHost: "localhost",
  wsPort: 8080,
  forceTLS: false,
});

echo.channel("orders")
  .listen("OrderShipped", (e) => {
    console.log(e.order.name);
  });
```

### Supported Broadcasters

#### Pusher

```ts
const echo = new Echo({
  broadcaster: "pusher",
  key: "your-pusher-key",
  cluster: "mt1",
  forceTLS: true,
});
```

#### Socket.io

Requires `socket.io-client` peer dependency.

```bash
bun add socket.io-client
```

```ts
import io from "socket.io-client";

const echo = new Echo({
  broadcaster: "socket.io",
  host: "http://localhost:6001",
  client: io,
});
```

#### Null (Testing)

```ts
const echo = new Echo({
  broadcaster: "null",
});
```

### Interceptors (X-Socket-Id)

`@revurb/echo` can automatically attach the `X-Socket-Id` header to outgoing HTTP requests for Axios, Vue, jQuery, and Turbo. This is useful for authorizing private channels.

Interceptors are **enabled by default** unless you pass `withoutInterceptors: true`.

```ts
// Interceptors enabled (default)
const echo = new Echo({
  broadcaster: "reverb",
  // ...
});

// Interceptors disabled
const echo = new Echo({
  broadcaster: "reverb",
  withoutInterceptors: true,
  // ...
});
```

## React Hooks

We provide a dedicated React package for easy integration.

```bash
bun add @revurb/echo
```

### Configuration

Configure Echo once at the root of your app:

```tsx
// src/main.tsx
import { configureEcho } from "@revurb/echo/react";

configureEcho({
  broadcaster: "reverb",
  key: "your-app-key",
  wsHost: "localhost",
  wsPort: 8080,
});
```

### Hooks

#### `useEcho`

Listen to private channels and events.

```tsx
import { useEcho } from "@revurb/echo/react";

function OrderTracker({ orderId }) {
  useEcho(
    `orders.${orderId}`, 
    "OrderShipped", 
    (event) => {
      console.log("Shipped!", event);
    },
    [orderId]
  );

  return <div>Tracking Order {orderId}</div>;
}
```

#### `useEchoPresence`

Join presence channels.

```tsx
import { useEchoPresence } from "@revurb/echo/react";

function Room({ roomId }) {
  useEchoPresence(
    `chat.${roomId}`,
    "here",
    (users) => {
      console.log("Users here:", users);
    }
  );
  
  // ...
}
```

#### `useEchoNotification`

Listen for user notifications.

```tsx
import { useEchoNotification } from "@revurb/echo/react";

function Notifications() {
  useEchoNotification(
    `App.Models.User.${userId}`,
    (notification) => {
      console.log("New notification:", notification);
    }
  );
  
  // ...
}
```

## License

MIT
