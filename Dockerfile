FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN cd web && npm install
RUN cd web && npx prisma generate --schema ../prisma/schema.prisma
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "web/index.js"]