#!/bin/sh
set -e

echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"
echo "Running database migrations..."

# Prisma 7 requer a URL no config, passamos via variável de ambiente
prisma db push --skip-generate

echo "Starting server..."
exec node server.js
