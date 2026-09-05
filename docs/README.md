# 📚 CoopData Documentation

> **Last restructured:** August 31, 2026
> This is the single entry point for all project documentation.

---

## 🏗️ Architecture & Design (Start Here)

| Document | Description | Audience |
|----------|-------------|----------|
| [`architecture/architecture.md`](architecture/architecture.md) | **System architecture** — Rust/Axum/SeaORM stack, database schema, AI pipeline, 4-tier review workflow, KPI computation | All developers |
| [`architecture/RBAC_AND_AUTH_SYSTEM.md`](architecture/RBAC_AND_AUTH_SYSTEM.md) | **Auth & RBAC** — Keycloak integration, role system, entity lifecycle, scope enforcement, JWT claims | All developers |
| [`architecture/design.md`](architecture/design.md) | **IAM integration design** — User stories, routes, data models, tech stack decisions | All developers |
| [`architecture/database-schema.md`](architecture/database-schema.md) | **Database schema reference** — Table definitions, migrations | Backend developers |
| [`architecture/progress.md`](architecture/progress.md) | **Project roadmap** — Current phase, completed work, next steps | All team members |

---

## 🚀 Features

Feature-specific design documents. Each covers a single feature's design, data models, and implementation approach.

| Document | Description |
|----------|-------------|
| [`apex-initiated-submissions.md`](features/apex-initiated-submissions.md) | Apex creates and submits on behalf of cooperatives |
| [`apex-cooperative-architecture.md`](features/apex-cooperative-architecture.md) | Apex → Cooperative hierarchy architecture |
| [`non-financial-indicators.md`](features/non-financial-indicators.md) | 56 business non-financial indicator system |
| [`ai-narratives.md`](features/ai-narratives.md) | AI-generated report narratives |
| [`analytics-kpis.md`](features/analytics-kpis.md) | KPI calculations and visualizations |
| [`analytics-implementation-plan.md`](features/analytics-implementation-plan.md) | Analytics feature implementation plan |
| [`comparative-analytics.md`](features/comparative-analytics.md) | Comparative analytics across cooperatives |
| [`cooperative-ranking.md`](features/cooperative-ranking.md) | Cooperative ranking system |
| [`benchmark-design.md`](features/benchmark-design.md) | Benchmarking design (differential privacy) |
| [`basic-benchmarking.md`](features/basic-benchmarking.md) | Basic benchmarking implementation |
| [`dynamic-localization.md`](features/dynamic-localization.md) | Dynamic content localization |
| [`high-stakes-deletion.md`](features/high-stakes-deletion.md) | Cascade delete with verification tokens |
| [`offline-first-architecture.md`](features/offline-first-architecture.md) | Offline-first sync architecture |
| [`period-types.md`](features/period-types.md) | Reporting period types |
| [`report-export.md`](features/report-export.md) | Report export subsystem (PDF/Excel/CSV) |
| [`kpi-database-mapping.md`](features/kpi-database-mapping.md) | KPI ↔ database field mapping |
| [`manual-entry-mapping.md`](features/manual-entry-mapping.md) | Manual data entry field mapping |

---

## 🚢 Deployment

| Document | Description |
|----------|-------------|
| [`deployment.md`](deployment/deployment.md) | AWS EC2 deployment guide (Terraform + Docker Compose) |
| [`manual-deployment.md`](deployment/manual-deployment.md) | Manual deployment steps |
| [`deployment-flow.md`](deployment/deployment-flow.md) | Deployment pipeline flow |
| [`docker-compose-specs.md`](deployment/docker-compose-specs.md) | Docker Compose service specifications |

---

## ⚙️ Operations & Monitoring

| Document | Description |
|----------|-------------|
| [`observability.md`](operations/observability.md) | Observability implementation plan |
| [`observability-monitoring.md`](operations/observability-monitoring.md) | Monitoring dashboards and alerts |
| [`audit-context-middleware.md`](operations/audit-context-middleware.md) | Audit context middleware implementation |
| [`mfa-totp.md`](operations/mfa-totp.md) | MFA/TOTP implementation |

---

## 🧪 Testing

| Document | Description |
|----------|-------------|
| [`testing-guide.md`](testing/testing-guide.md) | Testing strategy and conventions |
| [`unit-test-analysis.md`](testing/unit-test-analysis.md) | Current test coverage analysis + improvement roadmap |
| [`apex-cooperative-testing-guide.md`](testing/apex-cooperative-testing-guide.md) | Apex ↔ Cooperative flow testing |
| [`federation-iam-testing-guide.md`](testing/federation-iam-testing-guide.md) | Federation IAM testing guide |

---

## 📊 Analysis & Mapping

| Document | Description |
|----------|-------------|
| [`kpi-analysis-report.md`](analysis/kpi-analysis-report.md) | KPI analysis report |
| [`pdf-export-architecture.md`](analysis/pdf-export-architecture.md) | PDF export architecture |
| [`ai-mapping.md`](analysis/ai-mapping.md) | AI model ↔ data mapping |

---

## 📖 Knowledge Base

Reference documentation for developers. Organized by technology.

### Frontend (`knowledge/frontend/`)

| Document | Description |
|----------|-------------|
| [`pages.md`](knowledge/frontend/pages.md) | Page patterns (CRUD, list, detail) |
| [`components.md`](knowledge/frontend/components.md) | Component standards |
| [`hooks.md`](knowledge/frontend/hooks.md) | Custom hook patterns |
| [`forms.md`](knowledge/frontend/forms.md) | Form patterns (Zod + React Hook Form) |
| [`tables.md`](knowledge/frontend/tables.md) | Table patterns (TanStack Table) |
| [`ui-design.md`](knowledge/frontend/ui-design.md) | UI design gold standard |
| [`layout.md`](knowledge/frontend/layout.md) | Layout patterns |
| [`routing.md`](knowledge/frontend/routing.md) | Router setup |
| [`authentication.md`](knowledge/frontend/authentication.md) | Keycloak auth integration |
| [`internationalization.md`](knowledge/frontend/internationalization.md) | i18n guide |
| [`api-integration.md`](knowledge/frontend/api-integration.md) | OpenAPI & TanStack Query |
| [`data-types.md`](knowledge/frontend/data-types.md) | Type patterns |
| [`security.md`](knowledge/frontend/security.md) | Security best practices |
| [`testing.md`](knowledge/frontend/testing.md) | Frontend testing strategy |
| [`rbac-testing.md`](knowledge/frontend/rbac-testing.md) | RBAC testing patterns |
| [`sync-manager.md`](knowledge/frontend/sync-manager.md) | Sync manager patterns |
| [`offline-sync-conflict.md`](knowledge/frontend/offline-sync-conflict.md) | Offline sync conflict resolution |
| [`e2e-mock-auth.md`](knowledge/frontend/e2e-mock-auth.md) | E2E mock auth setup |
| [`user_manual.md`](knowledge/frontend/user_manual.md) | User manual |
| [`database.md`](knowledge/frontend/database.md) | Frontend database (Dexie/IndexedDB) |

### Backend / Rust (`knowledge/rust/`)

| Document | Description |
|----------|-------------|
| [`rust-architecture.md`](knowledge/rust/rust-architecture.md) | System flow & layers |
| [`rust-api-handlers.md`](knowledge/rust/rust-api-handlers.md) | How to write handlers |
| [`rust-dto.md`](knowledge/rust/rust-dto.md) | Request/response DTOs |
| [`rust-entities.md`](knowledge/rust/rust-entities.md) | SeaORM entities |
| [`rust-repositories.md`](knowledge/rust/rust-repositories.md) | Database queries |
| [`rust-services.md`](knowledge/rust/rust-services.md) | External services |
| [`rust-routes.md`](knowledge/rust/rust-routes.md) | Route wiring |
| [`rust-error-handling.md`](knowledge/rust/rust-error-handling.md) | Error patterns |
| [`rust-testing.md`](knowledge/rust/rust-testing.md) | Testing strategy |
| [`rust-openapi.md`](knowledge/rust/rust-openapi.md) | Swagger/utoipa docs |
| [`rust-caching.md`](knowledge/rust/rust-caching.md) | Caching strategy |
| [`rust-best-practices.md`](knowledge/rust/rust-best-practices.md) | Code style & conventions |

### Other Knowledge

| Document | Description |
|----------|-------------|
| [`observability.md`](knowledge/observability.md) | Observability patterns |
| [`keycloak-theme.md`](knowledge/keycloak-theme.md) | Keycloak theme customization |
| [`runbooks.md`](knowledge/runbooks.md) | Operational runbooks |
| [`reviewer.md`](knowledge/reviewer.md) | Code review guidelines |

### Templates (`knowledge/templates/`)

| Document | Description |
|----------|-------------|
| [`design.md`](knowledge/templates/design.md) | Design document template |
| [`progress.md`](knowledge/templates/progress.md) | Progress tracking template |
| [`ui-ux-gold-standard.md`](knowledge/templates/ui-ux-gold-standard.md) | UI/UX design system prompt |

---

## 📦 Archive

Historical sprint reports and implementation records. Preserved for reference but no longer actively maintained.

| Document | Sprint |
|----------|--------|
| [`sprint-2-epic-2-primary-coop-data.md`](archive/sprint-2-epic-2-primary-coop-data.md) | Sprint 2 |
| [`sprint-3-epic-3-ai-ingestion.md`](archive/sprint-3-epic-3-ai-ingestion.md) | Sprint 3 |
| [`sprint-4-epic-4-analytics-dashboards.md`](archive/sprint-4-epic-4-analytics-dashboards.md) | Sprint 4 |
| [`sprint-4-analytics-implementation.md`](archive/sprint-4-analytics-implementation.md) | Sprint 4 |
| [`implementation-federation-iam-sprint1.md`](archive/implementation-federation-iam-sprint1.md) | Sprint 1 |
| [`epic-2-ticket-3-4-complete-implementation.md`](archive/epic-2-ticket-3-4-complete-implementation.md) | Epic 2 |
| [`progress-offline-implementation.md`](archive/progress-offline-implementation.md) | Offline feature |
| [`ticket-2-implementation-status.md`](archive/ticket-2-implementation-status.md) | Ticket 2 |
| [`ticket-2-ministry-implementation.md`](archive/ticket-2-ministry-implementation.md) | Ticket 2 |
| [`ticket-2-ai-extraction-pipeline.md`](archive/ticket-2-ai-extraction-pipeline.md) | Ticket 2 |
| [`ticket-3-non-financial-data.md`](archive/ticket-3-non-financial-data.md) | Ticket 3 |
| [`ticket-5-cascade-audit-implementation.md`](archive/ticket-5-cascade-audit-implementation.md) | Ticket 5 |

---

## 📁 Structure Overview

```
docs/
├── README.md                          ← You are here
│
├── architecture/                      ← Core architecture docs (5 files)
│   ├── architecture.md                ← System architecture (start here)
│   ├── RBAC_AND_AUTH_SYSTEM.md        ← Auth & RBAC (source of truth)
│   ├── design.md                      ← IAM integration design
│   ├── database-schema.md             ← Database schema reference
│   └── progress.md                    ← Project roadmap
│
├── features/                          ← Feature-specific design docs (17 files)
├── deployment/                        ← Deployment guides (4 files)
├── operations/                        ← Ops & monitoring (4 files)
├── testing/                           ← Testing docs (4 files)
├── analysis/                          ← Analysis & mapping (3 files)
├── archive/                           ← Historical sprint reports (12 files)
│
└── knowledge/                         ← Developer reference docs
    ├── frontend/                      ← Frontend patterns (20 files)
    ├── rust/                          ← Backend patterns (12 files)
    ├── templates/                     ← Doc templates (3 files)
    └── *.md                           ← Other reference docs (4 files)
```

---

## 🧹 Maintenance Rules

1. **New feature designs** → `docs/features/`
2. **New deployment guides** → `docs/deployment/`
3. **New testing docs** → `docs/testing/`
4. **Sprint reports** → `docs/archive/` (never at root)
5. **Reference patterns** → `docs/knowledge/{frontend,rust}/`
6. **Architecture docs** → `docs/architecture/`
7. **No filename typos** — use `kebab-case.md` format
8. **No duplicates** — one source of truth per topic
