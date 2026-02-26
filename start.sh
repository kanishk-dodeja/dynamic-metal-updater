#!/bin/sh
echo "Running database migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma
echo "Starting server..."
node web/index.js
