FROM node:18-alpine

WORKDIR /app
COPY . .

# Install root dependencies
RUN npm install

# Install and build frontend manually to avoid loops
RUN cd web && npm install && cd frontend && npm install && npm run build

# Install backend dependencies
RUN cd web && npm install

EXPOSE 3000

# Start the server
CMD ["node", "web/index.js"]