FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev
COPY . .
RUN npm install
RUN cd web && npm install
RUN cd web && npx prisma generate --schema ../prisma/schema.prisma
RUN chmod +x start.sh
EXPOSE 3000
ENV NODE_ENV=production
CMD ["sh", "start.sh"]