# ============================================================================
# Austin RTASS - Production Docker Image
# ============================================================================
# Multi-stage build for optimal size and security
# Target platforms: linux/amd64, linux/arm64
# Base image: Node.js 20 Alpine (minimal, secure)
# Final image size: ~300MB (target < 500MB)
# ============================================================================

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
# Install production and development dependencies
# This stage is cached separately for faster rebuilds
# ============================================================================
FROM node:20-alpine AS deps

# Install system dependencies for Alpine compatibility
# - libc6-compat: glibc compatibility for Alpine Linux
# NOTE: python3, make, g++ removed - no native npm modules require compilation
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files for dependency installation
# Copying package*.json separately enables Docker layer caching
# If package.json hasn't changed, Docker reuses the cached layer
COPY package.json package-lock.json ./

# Install dependencies.
# Note: Avoid BuildKit-only features (e.g. RUN --mount=type=cache) so remote builders
# like `az acr build` work reliably without special configuration.
RUN npm ci --frozen-lockfile --prefer-offline --no-audit

# ============================================================================
# Stage 2: Builder
# ============================================================================
# Build the Next.js application
# This stage includes all source code and devDependencies
# ============================================================================
FROM node:20-alpine AS builder

# Install system dependencies for the build process
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
# .dockerignore filters out unnecessary files
COPY . .

# Set environment variables for Next.js build
# NEXT_TELEMETRY_DISABLED: disable telemetry for privacy and faster builds
# NODE_ENV: set to production for optimized build
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Build the Next.js application
# This creates the .next folder with optimized production build
# Standalone output mode is enabled in next.config.mjs for minimal deployment
RUN npm run build

# ============================================================================
# Stage 3: Production Runtime
# ============================================================================
# Final minimal production image
# Only includes built application and production dependencies
# ============================================================================
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
# dumb-init ensures proper PID 1 process management for graceful shutdown
# Also upgrade all packages to get latest security patches
RUN apk add --no-cache dumb-init && \
    apk upgrade --no-cache

WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Create non-root user for security
# Running as non-root is a security best practice
# UID 1001 is conventional for Node.js applications
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder stage
# .next/standalone: minimal Next.js server (standalone mode)
# .next/static: static assets (CSS, JS, images)
# public: public static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# RTASS built-in rubrics are loaded at runtime by the API route.
COPY --from=builder --chown=nextjs:nodejs /app/data/rtass-rubrics ./data/rtass-rubrics

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Health check endpoint
# Checks if the application is responding
# Interval: 30s, Timeout: 3s, Start period: 40s (allows app to start), Retries: 3
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
# This ensures graceful shutdown when SIGTERM is sent
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js production server
# server.js is created by Next.js standalone build
CMD ["node", "server.js"]

# ============================================================================
# Build Instructions
# ============================================================================
#
# Local Build (macOS):
# -------------------
# Build for local testing (ARM64 for M1/M2 Macs):
#   docker build -t austin-rtass:local .
#
# Build for Azure deployment (x86_64):
#   docker buildx build --platform linux/amd64 -t austin-rtass:azure .
#
# Multi-platform build (both ARM64 and x86_64):
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     -t austin-rtass:latest .
#
# Build with Azure Container Registry:
#   docker build --platform linux/amd64 \
#     -t myregistry.azurecr.io/austin-rtass:latest .
#
# ============================================================================
# Run Instructions
# ============================================================================
#
# Run locally with environment variables:
#   docker run -p 3000:3000 \
#     -e AZURE_OPENAI_API_KEY=your-key \
#     -e AZURE_OPENAI_ENDPOINT=your-endpoint \
#     austin-rtass:local
#
# Run with env file:
#   docker run -p 3000:3000 --env-file .env.local \
#     austin-rtass:local
#
# Run with docker-compose:
#   docker-compose up
#
# ============================================================================
# Image Size Optimization
# ============================================================================
#
# This Dockerfile uses several techniques to minimize image size:
# 1. Multi-stage build (3 stages): only final artifacts in runtime image
# 2. Alpine Linux base: minimal OS (~5MB vs ~100MB for full Linux)
# 3. .dockerignore: excludes unnecessary files from build context
# 4. Next.js standalone mode: includes only required files
# 5. No devDependencies: only production dependencies in final image
# 6. Layer caching: package.json copied separately for cache efficiency
#
# Expected image sizes:
# - deps stage: ~500MB (includes all dependencies + build tools)
# - builder stage: ~800MB (includes source + built assets)
# - runner stage: ~300MB (minimal runtime, production only)
#
# ============================================================================
# Security Features
# ============================================================================
#
# 1. Non-root user: runs as 'nextjs' user (UID 1001)
# 2. Minimal base image: Alpine Linux with minimal attack surface
# 3. No unnecessary packages: only essential runtime dependencies
# 4. Explicit ownership: files owned by nextjs user
# 5. Health checks: monitors application health
# 6. Signal handling: dumb-init for graceful shutdown
# 7. Production mode: all debug features disabled
#
# ============================================================================
