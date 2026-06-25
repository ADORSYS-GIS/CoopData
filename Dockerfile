# Dockerfile for frontend (TanStack Start / React)
FROM node:22-bookworm AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server/index.mjs"]
