# Multi-stage Dockerfile for AutoResearch Agent
# Builder stage: install deps and compile TypeScript
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copy package manifests first to leverage Docker cache
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm install --silent

# Copy project files and compile
COPY . .
RUN npm run build

# Production stage: smaller image with only production deps + compiled output
FROM node:20-slim AS production

WORKDIR /usr/src/app
ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev --silent

# Copy compiled output from builder
COPY --from=builder /usr/src/app/dist ./dist

# Expose a port if your bot/service listens on one (optional)
# EXPOSE 3000

# Default command — runs the compiled entrypoint
CMD ["node", "dist/index.js"]
