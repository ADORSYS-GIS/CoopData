# CoopData

A robust, secure, and multilingual web-based platform for data collection, analysis, and reporting for cooperatives in Eswatini. Built to support decision-making, transparency, and development planning across the cooperative sector.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Rust · Axum 0.7 · SeaORM 1.1 · PostgreSQL 16 |
| **Frontend** | React 19 · TanStack Start · TanStack Router · TanStack Query · Vite 7 |
| **UI** | shadcn/ui (New York) · Tailwind CSS v4 · Lucide Icons |
| **Auth** | Keycloak 26.4 (RS256 JWT, optional authenticator-app MFA) |
| **Cache** | Redis 7 |
| **Files** | MinIO (S3 compatible) |
| **Reports** | Gotenberg (HTML to PDF) |
| **Monitoring** | Prometheus · Grafana · Autoheal |
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
- [Docker Compose](https://docs.docker.com/compose/install/) 2.24+ (`docker-compose.override.yml` uses the `!override` tag)
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
| Frontend (dev, hot reload) | http://localhost:5173 | — |
| Frontend (production build, offline/PWA testing) | http://localhost:5174 | — |
| Backend API | http://localhost:3000/api/v1 | — |
| Swagger UI | http://localhost:3000/swagger-ui/ | — |
| Keycloak Admin | http://localhost:8180 | admin / admin |
| PostgreSQL | localhost:5432 | coopdata / password |
| Redis | localhost:6379 | — |

> **Testing offline mode?** Use **:5174**. The dev server on :5173 has no service worker, so the app cannot load there offline. After frontend changes, rebuild with `docker compose up -d --build frontend-pwa`. See [offline-local-testing.md](docs/knowledge/frontend/offline-local-testing.md). How offline mode works: [offline-mode.md](docs/knowledge/frontend/offline-mode.md).

### Test Users (Keycloak)

Local development only. [`keycloak/seed-test-users.sh`](keycloak/seed-test-users.sh) creates one user per role: `ministry@test.coopdata`, `federation@test.coopdata`, `apex@test.coopdata` and `cooperative@test.coopdata`. The password is set by `TEST_PASSWORD` in that script. Never use these accounts, or the dev defaults above, on a real server.

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

## API

The API lives under `/api/v1`. Routes are grouped by role in `backend/src/api/routes/` (`ministry`, `federation`, `apex`, `cooperative`, `shared`, `users`). The complete, always-current list with request and response shapes is the interactive Swagger UI at http://localhost:3000/swagger-ui/ when the backend runs. The frontend client in `frontend/src/openapi-client/` is generated from it.

## Role-Based Access

The platform has four roles, arranged as a chain. Each level sees only its own part of the chain. The apex is the final approval level; the federation and the Ministry oversee and analyse.

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Ministry** | National | Follows every submission, national analytics and reports, federations and invitations, questionnaire forms, indicators, custom KPIs, audit log |
| **Federation** | Its apexes | Manage apexes and their members, follow their submissions, federation analytics and reports |
| **Apex** | Its cooperatives | Register cooperatives, review and give the final approval of submissions, submit on a cooperative's behalf, manage apex members |
| **Cooperative** | Itself | Create and fill submissions (upload, manual entry or questionnaire), track reviews, own analytics and reports |

A return goes from the cooperative to its apex, which approves it or sends it back. See the [user guide](docs/user-guide/README.md) and [`docs/architecture/RBAC_AND_AUTH_SYSTEM.md`](docs/architecture/RBAC_AND_AUTH_SYSTEM.md).

## Configuration

All configuration is environment variables (twelve-factor). Nothing is hardcoded and no secret is committed.

| File | Used for |
|------|----------|
| [`.env.example`](.env.example) | The full list for the Docker stack and production. Copy to `.env` |
| [`backend/.env.example`](backend/.env.example) | Running the backend directly with `cargo run` |
| [`frontend/.env.example`](frontend/.env.example) | Running the frontend directly. `VITE_API_BASE_URL` has no `/api/v1` suffix |
| [`.env.demo.example`](.env.demo.example) | A demo stack beside production |

Every variable is explained in the [production runbook](docs/deployment/production-runbook.md#2-configuration).

## Documentation

| Read | For |
|------|-----|
| [User guide](docs/user-guide/README.md) | How each role uses CoopData |
| [Production runbook](docs/deployment/production-runbook.md) | Installing, releasing, backing up and recovering |
| [Documentation index](docs/README.md) | Architecture, features, testing, operations and developer references |
| [`CLAUDE.md`](CLAUDE.md) | The development rules and conventions for this repository |
