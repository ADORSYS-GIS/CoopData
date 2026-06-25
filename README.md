# CoopData

A robust, secure, and multilingual web-based platform for data collection, analysis, and reporting for cooperatives in Eswatini. Built to support decision-making, transparency, and development planning across the cooperative sector.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Rust · Axum 0.7 · SeaORM 1.1 · PostgreSQL 16 |
| **Frontend** | React 19 · TanStack Start · TanStack Router · TanStack Query · Vite 7 |
| **UI** | shadcn/ui (New York) · Tailwind CSS v4 · Lucide Icons |
| **Auth** | Keycloak 26.3 (RS256 JWT) |
| **Cache** | Redis 7 |
| **API Docs** | utoipa 4 (OpenAPI 3 / Swagger UI) |
| **Infra** | Docker Compose · Multi-stage builds · Non-root containers |

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │
│  React SSR   │     │  Rust / Axum  │     │     16       │
│  :5174       │     │  :3000       │     │  :5432       │
└──────────────┘     └──────┬───────┘     └──────────────┘
                             │
                     ┌───────┴───────┐
                     │               │
              ┌──────┴──────┐ ┌──────┴──────┐
              │   Redis     │ │  Keycloak    │
              │   :6379     │ │  :8180       │
              └─────────────┘ └─────────────┘
```

The backend follows a layered architecture: **Route → Handler → Repository → Database**. JWT tokens from Keycloak are validated on every request via middleware. Redis provides response caching with TTL-based invalidation.

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24.0+
- [Docker Compose](https://docs.docker.com/compose/install/) V2
- [Git](https://git-scm.com/)

### One-Command Start

```bash
./start.sh
```

This script will:

1. Check that Docker and Docker Compose are installed
2. Detect if services are already running and offer to restart, stop, or rebuild
3. Check that ports 3000, 5432, 6379, and 8180 are available
4. Create `backend/.env` from `backend/.env.example` if it doesn't exist
5. Pull Docker images and build containers
6. Start all services and wait for health checks (up to 120 seconds)
7. Print service URLs and credentials

### Services After Startup

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5174 | — |
| Backend API | http://localhost:3000/api/v1 | — |
| Swagger UI | http://localhost:3000/swagger-ui/ | — |
| Keycloak Admin | http://localhost:8180 | admin / admin |
| PostgreSQL | localhost:5432 | coopdata / password |
| Redis | localhost:6379 | — |

### Test Users (Keycloak)

| Role | Username | Password |
|------|----------|----------|
| Ministry | thabo.nkosi | ministry123 |
| Federation | phindile.khumalo | federation123 |
| Cooperative | bongani.hlatshwayo | cooperative123 |
| Regional Officer | moses.dlamini | regional123 |

### Useful Commands

```bash
docker compose logs -f            # Follow all logs
docker compose logs -f backend     # Follow backend logs
docker compose down                # Stop all services (keep data)
docker compose down -v             # Stop and remove volumes (data loss!)
```

## Project Structure

```
CoopData/
├── backend/                   # Rust / Axum backend
│   ├── src/
│   │   ├── api/
│   │   │   ├── dto/           # Request / response types
│   │   │   ├── handlers/      # HTTP handlers
│   │   │   ├── routes/        # Route wiring
│   │   │   ├── middleware.rs   # Auth, CORS, logging
│   │   │   └── openapi.rs     # Swagger configuration
│   │   ├── auth/              # JWT validation + middleware
│   │   ├── entities/          # SeaORM entity definitions
│   │   ├── models/            # Non-DB models (Keycloak types)
│   │   ├── repositories/      # Database query layer
│   │   ├── services/          # External services (cache, Keycloak)
│   │   ├── config.rs          # Environment configuration
│   │   ├── database.rs        # DB connection pool setup
│   │   ├── error.rs           # AppError enum + IntoResponse
│   │   ├── lib.rs             # AppState, app factory
│   │   ├── main.rs            # Entry point
│   │   └── utils.rs           # Shared utilities
│   ├── migrations/             # SQL migrations
│   ├── Cargo.toml
│   ├── Dockerfile
│   └── .env.example
├── frontend/                  # React / TanStack Start frontend
│   ├── src/
│   │   ├── components/        # Reusable UI (shadcn/ui + app components)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities, auth, config, mock data
│   │   ├── routes/            # File-based routing (TanStack Router)
│   │   ├── router.tsx         # Router creation
│   │   ├── start.ts           # Client entry
│   │   └── server.ts          # SSR server entry
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── keycloak/                  # Realm export (auto-imported)
│   └── realm-coopdata.json
├── docs/                      # Knowledge base & guides
│   ├── knowledge/
│   │   ├── frontend/          # Frontend patterns & guides
│   │   └── rust/               # Backend patterns & guides
│   └── templates/             # Design & progress templates
├── docker-compose.yml         # Full stack orchestration
├── start.sh                   # Automated startup script
└── AGENTS.md                  # AI agent documentation
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | No | Health check |
| GET | `/api/v1/organizations` | Yes | List organizations |
| POST | `/api/v1/organizations` | Yes | Create organization |
| GET | `/api/v1/organizations/:id` | Yes | Get organization |
| PATCH | `/api/v1/organizations/:id` | Yes | Update organization |
| DELETE | `/api/v1/organizations/:id` | Yes | Delete organization |
| GET | `/api/v1/users` | Yes | List users |
| POST | `/api/v1/users` | Yes | Create user |
| GET | `/api/v1/users/:id` | Yes | Get user |
| PATCH | `/api/v1/users/:id` | Yes | Update user |
| DELETE | `/api/v1/users/:id` | Yes | Delete user |
| POST | `/api/v1/users/:id/assign-role` | Yes | Assign role to user |

Full interactive documentation is available at http://localhost:3000/swagger-ui/ when the backend is running.

## Role-Based Access

The platform enforces four roles with different permissions and navigation:

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Ministry** | National | Full oversight, analytics, compliance reviews, user management |
| **Federation** | Regional | Member cooperative management, report aggregation, data validation |
| **Cooperative** | Local | Data entry, financial reporting, own profile management |
| **Regional Officer** | Regional | Field verification, compliance checks, regional reporting |

## Configuration

Backend configuration is handled via environment variables (see `backend/.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | `postgresql://coopdata:password@postgres:5432/coopdata` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `KEYCLOAK_URL` | `http://keycloak:8180` | Keycloak server URL |
| `KEYCLOAK_REALM` | `coop-data` | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | `coopdata-backend` | Keycloak client ID |
| `KEYCLOAK_CLIENT_SECRET` | `change-me-in-production` | Keycloak client secret |
| `JWT_ISSUER` | `http://keycloak:8180/realms/coop-data` | JWT issuer URL |
| `JWT_AUDIENCE` | `coopdata-frontend` | Expected JWT audience |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `ENVIRONMENT` | `development` | Environment name (development/production) |

Frontend build-time variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | Backend API URL |
| `VITE_KEYCLOAK_URL` | `http://localhost:8180` | Keycloak URL |
| `VITE_KEYCLOAK_REALM` | `coop-data` | Keycloak realm |
| `VITE_KEYCLOAK_CLIENT_ID` | `coopdata-frontend` | Keycloak client ID |

## License

Proprietary — All rights reserved.