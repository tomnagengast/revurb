#!/usr/bin/env bash

# Test script for starting the Revurb server
# This will start the server and make a health check request

export REVERB_APP_KEY=test-app-key
export REVERB_APP_SECRET=test-app-secret
export REVERB_APP_ID=test-app-id
export REVERB_SERVER_HOST=127.0.0.1
export REVERB_SERVER_PORT=8081
export REVERB_HOST=localhost
export REVERB_PORT=8081
export REVERB_SCHEME=http
export REVERB_ALLOWED_ORIGINS=*

echo "Starting Revurb server..."
echo "Environment configured:"
echo "  Host: $REVERB_SERVER_HOST"
echo "  Port: $REVERB_SERVER_PORT"
echo ""

# Start server in background
timeout 5s bun run src/cli.ts start &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Make health check request
echo "Testing health check endpoint..."
curl -s http://127.0.0.1:8081/up || echo "Health check failed"

# Stop server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "Test complete"
