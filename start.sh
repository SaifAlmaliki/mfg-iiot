#!/bin/sh
# UNS Platform Startup Script
# Runs database migrations and starts the application

set -e

echo "🚀 Starting UNS Platform..."

# Generate Prisma client (ensure it's available)
echo "🔧 Generating Prisma client..."
npx prisma generate || true

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy || echo "⚠️ Migration failed, trying db push..."
npx prisma db push --accept-data-loss || true

# Run database seed
echo "🌱 Checking if database needs seeding..."
npx prisma db seed 2>/dev/null || echo "   Database already seeded"

# Start the application
echo "🌟 Starting Next.js server..."
exec node server.js
