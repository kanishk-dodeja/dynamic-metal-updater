FROM node:20-alpine

WORKDIR /app

# Copy the entire project
COPY . .

# Install root dependencies
RUN npm install --legacy-peer-deps

# Install web dependencies
RUN cd web && npm install --legacy-peer-deps

# Generate Prisma Client (Critical for database interaction)
RUN cd web && npx prisma generate --schema ../prisma/schema.prisma

EXPOSE 3000

# Start the server
CMD ["node", "web/index.js"]