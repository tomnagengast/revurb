# Revurb Demo Chat App

A real-time chat application demonstrating Revurb WebSocket server integration with React.

## Quick Start

```bash
# Install dependencies
bun install

# Start both Revurb WebSocket server and frontend dev server
bun run dev
```

The command starts:
- **Revurb WebSocket server** on `ws://0.0.0.0:8080`
- **Frontend dev server** with hot module reloading

Open the URL shown in the console (typically `http://localhost:3000`) to access the chat app.

## What This Demo Shows

This demo showcases:

1. **Embedding Revurb** - How to use `createServer()` to start Revurb programmatically
2. **@revurb/echo Integration** - Direct usage of `@revurb/echo/react` hooks
3. **Private Channel Authentication** - Implementing the `/broadcasting/auth` endpoint
4. **Client Events** - Sending messages between connected clients

## Key Integration Points

### Starting Revurb

```typescript
import { createServer } from '@revurb/revurb';

const { server, shutdown } = await createServer({
  config: {
    // ... configuration
  },
});
```

### Using Echo in React

```typescript
import { configureEcho, useEcho } from '@revurb/echo/react';

// Configure once
configureEcho({
  broadcaster: 'reverb',
  key: 'my-app-key',
  wsHost: 'localhost',
  wsPort: 8080,
  // ...
});

// Subscribe to channels
useEcho('private-chat', 'client-message', handleMessage, []);
```

## Environment Variables

The demo uses these environment variables (all optional):

- `BUN_PUBLIC_REVERB_HOST` - Server host (default: localhost)
- `BUN_PUBLIC_REVERB_PORT` - Server port (default: 8080)
- `BUN_PUBLIC_REVERB_SCHEME` - http or https (default: http)
- `BUN_PUBLIC_REVERB_APP_KEY` - Application key (default: my-app-key)

## Features

- Real-time chat with multiple channels
- Connection status tracking
- Auto-reconnection handling
- Message history persistence
- Clean, focused implementation showcasing Revurb
