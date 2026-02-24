# Production-ready Dockerfile for Shopify App (Node/Express + React/Vite)
FROM node:18-alpine AS base
WORKDIR /app

# Install root dependencies and build frontend
COPY package.json ./
COPY web/package.json ./web/
RUN npm install

# Copy all source code
COPY . .

# Build frontend (runs: cd web && npm install && npm run build)
RUN npm run build

# --- Production image ---
FROM node:18-alpine AS prod
WORKDIR /app

# Copy only necessary files from build stage
COPY --from=base /app/package.json ./
COPY --from=base /app/web/package.json ./web/
COPY --from=base /app/web/index.js ./web/index.js
COPY --from=base /app/web/services ./web/services
COPY --from=base /app/web/frontend/dist ./web/frontend/dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/shopify.app.toml ./shopify.app.toml

# Install only production dependencies
RUN npm install --omit=dev && cd web && npm install --omit=dev

# Expose Shopify standard port
EXPOSE 8081

# Start the app
CMD ["npm", "start"]
