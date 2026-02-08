FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN bun install

# Copy source code
COPY . .

# Expose port
EXPOSE 8001

# Default command
CMD ["bun", "run", "src/index.ts"]
