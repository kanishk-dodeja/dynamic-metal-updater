#!/bin/sh
echo "Running database setup..."
npx prisma db push --schema prisma/schema.prisma
echo "Starting server..."
node web/index.js
