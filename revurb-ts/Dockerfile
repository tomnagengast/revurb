FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build the project
RUN bun run build

# Expose default port
EXPOSE 8080

# Default command
CMD ["bun", "run", "src/cli.ts"]
