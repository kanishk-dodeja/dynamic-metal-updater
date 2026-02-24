FROM node:18-alpine

WORKDIR /app

# Copy the entire project
COPY . .

# Install root dependencies
RUN npm install --legacy-peer-deps

# Install web dependencies and build frontend
RUN cd web && npm install --legacy-peer-deps && cd frontend && npm install --legacy-peer-deps && npm run build

# Generate Prisma Client (Critical for database interaction)
RUN cd web && npx prisma generate --schema ../prisma/schema.prisma

EXPOSE 3000

# Start the server
CMD ["node", "web/index.js"]