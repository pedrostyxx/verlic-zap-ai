#!/bin/sh
set -e

echo "Running database migrations..."
prisma db push

echo "Starting server..."
exec node server.js
