#!/bin/sh
set -e

echo "Running database migrations..."
prisma db push --skip-generate

echo "Starting server..."
exec node server.js
