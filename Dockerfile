FROM node:20-slim as build

# Install dependencies needed for build only
RUN apt-get update && \
    apt-get install -y postgresql-client curl && \
    rm -rf /var/lib/apt/lists/*

# Enable yarn
RUN corepack enable && corepack prepare yarn@1.22.19 --activate

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install ALL dependencies including devDependencies
RUN yarn install

# Copy source code
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations

# Build the TypeScript code
RUN yarn build

# ---------- Production Stage ----------
FROM node:20-slim

# Install PostgreSQL client for database connection check
RUN apt-get update && \
    apt-get install -y postgresql-client && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only copy the compiled dist and necessary files from the build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/node_modules ./node_modules
COPY package.json yarn.lock ./

# Create logs directory with proper permissions
RUN mkdir -p logs && chmod 777 logs

# Create compiler-cache directory with proper permissions
RUN mkdir -p compiler-cache && chmod 777 compiler-cache

# Switch to a non-root user for security
USER node

# Expose the API port
EXPOSE 3000

# Run the application
CMD ["yarn", "start"]
