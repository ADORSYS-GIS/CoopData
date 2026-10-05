FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Leave the URL args empty by default: the app then falls back to
# window.location.origin + "/auth" (prod) / relative /api, producing a
# domain-agnostic image. NEVER bake an absolute host URL into the bundle.
ARG VITE_API_BASE_URL=
ARG VITE_KEYCLOAK_URL=
ARG VITE_KEYCLOAK_REALM=coop-data
ARG VITE_KEYCLOAK_CLIENT_ID=coopdata-frontend

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

RUN npm run build

FROM nginx:alpine AS runner

RUN apk upgrade --no-cache

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
