# Echo Client

`@revurb/echo` is a TypeScript port of Laravel Echo for the Bun runtime. It provides a fluent API for subscribing to channels and listening for events broadcast by your server-side application.

## Installation

```bash
bun add @revurb/echo pusher-js
```

## Basic Usage

### Configuration

To get started, import `Echo` and configure it with your broadcaster settings:

```typescript
import Echo from "@revurb/echo";
import Pusher from "pusher-js";

// Configure Echo
const echo = new Echo({
  broadcaster: "reverb",
  key: "your-app-key",
  wsHost: "localhost",
  wsPort: 8080,
  forceTLS: false,
  enabledTransports: ["ws", "wss"],
  Pusher: Pusher, // Inject the Pusher client
});
```

### Subscribing to Channels

Once configured, you can listen for events:

```typescript
echo.channel("orders")
  .listen("OrderShipped", (e) => {
    console.log("Order shipped:", e.order);
  });
```

### Private Channels

```typescript
echo.private("orders.1")
  .listen("OrderShipped", (e) => {
    console.log(e.order);
  });
```

### Presence Channels

```typescript
echo.join("chat")
  .here((users) => {
    console.log("Users here:", users);
  })
  .joining((user) => {
    console.log("User joined:", user);
  })
  .leaving((user) => {
    console.log("User left:", user);
  });
```

## React Integration

`@revurb/echo` ships with first-class React hooks.

```bash
bun add @revurb/echo react
```

### Setup

Configure Echo globally using `configureEcho`. This is typically done in your app entry point.

```typescript
import { configureEcho } from "@revurb/echo/react";
import Pusher from "pusher-js";

configureEcho({
  broadcaster: "reverb",
  key: "your-app-key",
  wsHost: "localhost",
  wsPort: 8080,
  forceTLS: false,
  Pusher: Pusher,
});
```

### Hooks

Use the `useEcho` hook to subscribe to channels in your components.

```tsx
import { useEcho } from "@revurb/echo/react";

function OrderStatus({ orderId }) {
  useEcho(`orders.${orderId}`, "OrderShipped", (event) => {
    console.log("Order updated:", event);
  });

  return <div>Listening for updates...</div>;
}
```

For presence channels, use `useEchoPresence`:

```tsx
import { useEchoPresence } from "@revurb/echo/react";

function ChatRoom() {
  const { users, here, joining, leaving } = useEchoPresence("chat");

  // users is a reactive state of current users
  
  return (
    <ul>
      {users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```

## Interceptors & X-Socket-Id

By default, Echo will attempt to register interceptors for popular HTTP clients (Axios, Vue, jQuery, Turbo) to attach the `X-Socket-Id` header to outgoing requests. This is required for broadcasting to "others" (excluding the current user).

If you are running in a non-browser environment or wish to disable this behavior, pass `withoutInterceptors: true`:

```typescript
const echo = new Echo({
  broadcaster: "reverb",
  // ...
  withoutInterceptors: true,
});
```

## Broadcasters

### Reverb / Pusher

Revurb is designed to work seamlessly with Laravel Reverb and other Pusher-compatible servers.

### Socket.IO

To use Socket.IO, install the client:

```bash
bun add socket.io-client
```

And configure Echo:

```typescript
import io from "socket.io-client";

const echo = new Echo({
  broadcaster: "socket.io",
  host: "http://localhost:6001",
  client: io,
});
```

### Null

For testing or fallback:

```typescript
const echo = new Echo({
  broadcaster: "null",
});
```
