FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ARG VITE_KEYCLOAK_URL=http://localhost:8180
ARG VITE_KEYCLOAK_REALM=coop-data
ARG VITE_KEYCLOAK_CLIENT_ID=coopdata-frontend

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/entry.mjs ./entry.mjs
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_ENV=production

USER appuser

EXPOSE 3001

CMD ["node", "entry.mjs"]