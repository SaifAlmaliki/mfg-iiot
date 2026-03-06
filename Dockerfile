# UNS Manufacturing Platform - Dockerfile
# Production-ready Next.js standalone deployment

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl netcat-openbsd
WORKDIR /app

# Install bun for faster installs
RUN npm install -g bun

# Copy package files and Prisma config (required for Prisma 7)
COPY package.json bun.lock* ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Install dependencies (omit --frozen-lockfile so build succeeds if lockfile is out of sync; run "bun install" locally and commit bun.lock for reproducibility)
RUN bun install

# Generate Prisma client (output: ./generated/prisma/client). DATABASE_URL not used for generate but required by prisma.config.ts
ENV DATABASE_URL=postgresql://localhost:5432/dummy
RUN npx prisma generate

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy dependencies and generated Prisma client from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .

# Set environment variables for build (DATABASE_URL required by db.ts at build time during page data collection)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_DATABASE_URL=${DATABASE_URL}

# Build the application
RUN bun run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install required packages
RUN apk add --no-cache openssl netcat-openbsd

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files and generated client for runtime (Prisma 7 uses custom output path)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy seed file
COPY --from=builder /app/prisma/seed.ts ./prisma/seed.ts

# Copy startup script
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application with migrations
CMD ["./start.sh"]
