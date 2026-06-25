# Dockerfile for frontend (TanStack Start / React)
FROM node:22-alpine AS builder
# Upgrade all packages to latest patched versions to reduce CVE surface
RUN apk upgrade --no-cache
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
# Upgrade all packages to latest patched versions to reduce CVE surface
RUN apk upgrade --no-cache
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
# Run as non-root user for security hardening
USER node
CMD ["node", "dist/server/index.mjs"]
