#!/bin/sh
echo "Running database migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma
if [ $? -ne 0 ]; then
  echo "migrate deploy failed, falling back to db push..."
  npx prisma db push --schema prisma/schema.prisma --accept-data-loss
fi
echo "Starting server..."
node web/index.js
