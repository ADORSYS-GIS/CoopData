# CoopData Documentation

> **Last updated:** November 2, 2026
> This is the single entry point for all project documentation.

**Using CoopData?** Start with the [User Guide](user-guide/README.md).
**Running the server?** Start with the [Production Runbook](deployment/production-runbook.md).

---

## User Guide

| Document | Description | Audience |
|----------|-------------|----------|
| [`user-guide/README.md`](user-guide/README.md) | Overview, the organisation chain, the two cooperative types | Everyone |
| [`user-guide/getting-started.md`](user-guide/getting-started.md) | Sign-in, two-step verification, language, consents, offline use | Everyone |
| [`user-guide/cooperative.md`](user-guide/cooperative.md) | Creating, filling and sending submissions | Cooperative managers |
| [`user-guide/apex.md`](user-guide/apex.md) | Registering cooperatives, reviewing and final approval, submitting on behalf | Apex officers |
| [`user-guide/federation.md`](user-guide/federation.md) | Managing apexes, following their submissions | Federation officers |
| [`user-guide/ministry.md`](user-guide/ministry.md) | Following submissions, federations, forms, indicators, audit log | Ministry officials |
| [`user-guide/analytics-explained.md`](user-guide/analytics-explained.md) | Why a cooperative or year may be missing from a chart | Everyone |
| [`user-guide/faq.md`](user-guide/faq.md) | Common problems and answers | Everyone |

---

## Architecture & Design (Start Here)

| Document | Description | Audience |
|----------|-------------|----------|
| [`architecture/architecture.md`](architecture/architecture.md) | **System architecture** — Rust/Axum/SeaORM stack, database schema, AI pipeline, review workflow (the apex gives the final approval), KPI computation | All developers |
| [`architecture/RBAC_AND_AUTH_SYSTEM.md`](architecture/RBAC_AND_AUTH_SYSTEM.md) | **Auth & RBAC** — Keycloak integration, role system, entity lifecycle, scope enforcement, JWT claims | All developers |
| [`architecture/design.md`](architecture/design.md) | **IAM integration design** — User stories, routes, data models, tech stack decisions | All developers |
| [`architecture/database-schema.md`](architecture/database-schema.md) | **Database schema reference** — Table definitions, migrations | Backend developers |
| [`architecture/progress.md`](architecture/progress.md) | **Project roadmap** — Current phase, completed work, next steps | All team members |

---

## Features

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
| [`offline-first-architecture.md`](features/offline-first-architecture.md) |  Original offline design (outdated; see `knowledge/frontend/offline-mode.md`) |
| [`period-types.md`](features/period-types.md) | Reporting period types |
| [`report-export.md`](features/report-export.md) | Report export subsystem (PDF/Excel/CSV) |
| [`kpi-database-mapping.md`](features/kpi-database-mapping.md) | KPI ↔ database field mapping |
| [`manual-entry-mapping.md`](features/manual-entry-mapping.md) | Manual data entry field mapping |
| [`complete-year-periods.md`](features/complete-year-periods.md) | Complete reporting years: when a year counts in analytics |
| [`questionnaire-kpi-dashboard.md`](features/questionnaire-kpi-dashboard.md) | Questionnaire KPIs, Basic Analytics and the questionnaire report |
| [`legal-consent-management.md`](features/legal-consent-management.md) | Legal documents, consent recording and privacy requests |
| [`multilingual-report-exports.md`](features/multilingual-report-exports.md) | Reports in English, French, Portuguese and siSwati |
| [`report-export-on-demand.md`](features/report-export-on-demand.md) | On-demand report generation |
| [`report-template.md`](features/report-template.md) | Report template structure |
| [`cascade-delete.md`](features/cascade-delete.md) | What a cascade delete removes |
| [`rate-limiting-design.md`](features/rate-limiting-design.md) | Rate limiting |
| [`security-hardening-design.md`](features/security-hardening-design.md) | Security hardening overview |
| [`t1-input-sanitization.md`](features/t1-input-sanitization.md) | Input sanitization and injection prevention |
| [`t2-auth-double-gatekeeper.md`](features/t2-auth-double-gatekeeper.md) | Auth and authorization double gatekeeper |
| [`t3-session-management.md`](features/t3-session-management.md) | Session management and token expiry |
| [`t9-audit-trails.md`](features/t9-audit-trails.md) | Audit trails |
| [`t10-error-handling.md`](features/t10-error-handling.md) | Error handling and safe user messages |
| [`t12-retry-idempotency.md`](features/t12-retry-idempotency.md) | Retry and idempotency |
| [`t15-testing.md`](features/t15-testing.md) | Comprehensive testing |
| [`t18-chaos-resilience.md`](features/t18-chaos-resilience.md) | Chaos and resilience testing |

---

## Deployment

| Document | Description |
|----------|-------------|
| [`production-runbook.md`](deployment/production-runbook.md) | **Start here.** What runs, configuration, releasing, backup, recovery, incidents |
| [`deployment-flow.md`](deployment/deployment-flow.md) | The branch and release pipeline in detail |
| [`docker-compose-specs.md`](deployment/docker-compose-specs.md) | Docker Compose service specifications |
| [`manual-deployment.md`](deployment/manual-deployment.md) | Installing on the client server step by step |
| [`BACKUP_AND_RECOVERY_GUIDE.md`](BACKUP_AND_RECOVERY_GUIDE.md) | Backups, restore and disaster recovery |
| [`MULTI_ENVIRONMENT_GUIDE.md`](MULTI_ENVIRONMENT_GUIDE.md) | Production plus demo on one host |
| [`RELEASE_STRATEGY_GUIDE.md`](RELEASE_STRATEGY_GUIDE.md) | Versioning and release rules |
| [`archive/ec2-subdomain-ssl-report.md`](archive/ec2-subdomain-ssl-report.md) | Historical: notes from the former AWS demo server |

---

## Operations & Monitoring

| Document | Description |
|----------|-------------|
| [`observability.md`](operations/observability.md) | Observability implementation plan |
| [`observability-monitoring.md`](operations/observability-monitoring.md) | Monitoring dashboards and alerts |
| [`audit-context-middleware.md`](operations/audit-context-middleware.md) | Audit context middleware implementation |
| [`mfa-totp.md`](operations/mfa-totp.md) | MFA/TOTP implementation |
| [`keycloak-mfa-troubleshooting.md`](keycloak-mfa-troubleshooting.md) | MFA problems and fixes |
| [`load-testing-report.md`](load-testing-report.md) | Load test results |
| [`loadtestOverview.md`](loadtestOverview.md) | Load test overview |
| [`uiux-consistency-assessment.md`](uiux-consistency-assessment.md) | UI/UX consistency assessment |

---

## Testing

| Document | Description |
|----------|-------------|
| [`testing-guide.md`](testing/testing-guide.md) | Testing strategy and conventions |
| [`unit-test-analysis.md`](testing/unit-test-analysis.md) | Current test coverage analysis + improvement roadmap |
| [`apex-cooperative-testing-guide.md`](testing/apex-cooperative-testing-guide.md) | Apex ↔ Cooperative flow testing |
| [`federation-iam-testing-guide.md`](testing/federation-iam-testing-guide.md) | Federation IAM testing guide |
| [`TESTING_GUIDE.md`](TESTING_GUIDE.md) | Top-level testing guide |
| [`TEST_GUIDE.md`](testing/TEST_GUIDE.md) | Test guide |
| [`full-stack-e2e-testing-plan.md`](testing/full-stack-e2e-testing-plan.md) | Full-stack end-to-end test plan |
| [`reference-test-data-2025.md`](testing/reference-test-data-2025.md) | Reference test data, 2025 |
| [`reference-test-data-round2.md`](testing/reference-test-data-round2.md) | Reference test data, round 2 |

---

## Analysis & Mapping

| Document | Description |
|----------|-------------|
| [`kpi-analysis-report.md`](analysis/kpi-analysis-report.md) | KPI analysis report |
| [`pdf-export-architecture.md`](analysis/pdf-export-architecture.md) | PDF export architecture |
| [`ai-mapping.md`](analysis/ai-mapping.md) | AI model ↔ data mapping |

---

## Knowledge Base

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
| [`rbac-smoke-testing.md`](knowledge/frontend/rbac-smoke-testing.md) | RBAC smoke testing patterns |
| [`sync-manager.md`](knowledge/frontend/sync-manager.md) |  Original sync-manager plan (outdated) |
| [`offline-mode.md`](knowledge/frontend/offline-mode.md) | **How offline mode works today** (start here) |
| [`offline-review-guide.md`](knowledge/frontend/offline-review-guide.md) | Every offline fix explained, with step-by-step checks |
| [`offline-sync-conflict.md`](knowledge/frontend/offline-sync-conflict.md) |  Original conflict-resolution plan (outdated) |
| [`offline-local-testing.md`](knowledge/frontend/offline-local-testing.md) | Testing offline mode locally (why :5173 can't, use :5174) |
| [`offline-known-issues.md`](knowledge/frontend/offline-known-issues.md) | Offline bugs found, reproduction results, fix tracker |
| [`e2e-smoke-tests-mock-auth.md`](knowledge/frontend/e2e-smoke-tests-mock-auth.md) | E2E smoke tests mock auth setup |
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

## Archive

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

## Structure Overview

```
docs/
├── README.md                          ← You are here
├── user-guide/                        ← End-user guide, one page per role
├── architecture/                      ← Core architecture docs
├── features/                          ← Feature-specific design docs
├── deployment/                        ← Production runbook and deployment guides
├── operations/                        ← Ops & monitoring
├── testing/                           ← Testing docs
├── analysis/                          ← Analysis & mapping
├── legal/                             ← Consent standard
├── archive/                           ← Historical sprint reports
├── *.md                               ← Backup, release, multi-environment, testing and load-test guides
└── knowledge/                         ← Developer reference docs
    ├── frontend/
    ├── rust/
    ├── templates/
    └── *.md
```

---

## Maintenance Rules

0. **End-user instructions** → `docs/user-guide/` (update it whenever a screen or flow changes)
1. **New feature designs** → `docs/features/`
2. **New deployment guides** → `docs/deployment/`
3. **New testing docs** → `docs/testing/`
4. **Sprint reports** → `docs/archive/` (never at root)
5. **Reference patterns** → `docs/knowledge/{frontend,rust}/`
6. **Architecture docs** → `docs/architecture/`
7. **No filename typos** — use `kebab-case.md` format
8. **No duplicates** — one source of truth per topic
