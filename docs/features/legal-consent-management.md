# Feature Design: User-Facing Legal, Privacy & Consent Management

> **Status:** Implemented
> **Ticket:** User-Facing Legal, Privacy & Consent Management
> **Component:** Frontend + Backend
> **Languages:** English (en), French (fr), Portuguese (pt), Siswati (ss)

---

## 1. Overview & Business Value

CoopData processes personal, organizational, and sensitive financial information. Providing clear legal documentation and auditable consent management improves transparency, user trust, and compliance readiness (Eswatini Data Protection Act; GDPR where applicable).

The platform will:
1. Provide publicly accessible, multi-lingual legal documentation for 6 key policies.
2. Require mandatory acceptance of the Terms of Service and Privacy Policy during account registration.
3. Record immutable, versioned consent history per user server-side.
4. Support policy versioning and re-acceptance flows when material updates occur.
5. Provide user privacy settings and privacy request mechanisms (data export, correction, deletion).

---

## 2. Architecture & Data Flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Static & Fast Content Layer)                                    │
│ • Markdown files (.md) in public/locales/{en|fr|pt|ss}/legal/ (source)   │
│ • Rendered dynamically via LegalCenterPage.tsx                            │
│ • Works 100% offline via PWA caching                                      │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ User accepts policy / checks status
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ BACKEND (Consent Audit & Compliance Engine)                               │
│ • POST /api/v1/consents            (Record user acceptance)              │
│ • GET  /api/v1/consents/me         (User acceptance history)             │
│ • GET  /api/v1/consents/status     (Active policy compliance check)      │
│ • POST /api/v1/privacy/requests    (Data export / deletion requests)     │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ DATABASE (PostgreSQL)                                                     │
│ • user_consents (id, user_id, document_type, document_version, ...)       │
│ • privacy_requests (id, user_id, request_type, status, ...)               │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Scope of Legal Documents

| # | Document Type | Slug | Assets Location |
|---|---|---|---|
| 1 | `TERMS_OF_SERVICE` | `terms` | `/locales/{lang}/legal/terms.md` |
| 2 | `PRIVACY_POLICY` | `privacy` | `/locales/{lang}/legal/privacy.md` |
| 3 | `COOKIE_POLICY` | `cookies` | `/locales/{lang}/legal/cookies.md` |
| 4 | `ACCEPTABLE_USE` | `acceptable-use` | `/locales/{lang}/legal/acceptable_use.md` |
| 5 | `SECURITY_PROTECTION` | `security` | `/locales/{lang}/legal/security.md` |
| 6 | `DATA_RETENTION` | `data-retention` | `/locales/{lang}/legal/data_retention.md` |
| 7 | `DATA_USE_CONSENT` | `data-use` | `/locales/{lang}/legal/data_use.md` |
| 8 | `DATA_PROCESSING_GOVERNANCE` | `data-processing` | `/locales/{lang}/legal/data_processing.md` |

The English texts come from the approved sources in `sources/policies/` (Word documents
01–08); French, Portuguese and Siswati are translations of them. Source 09, the
*Consent & Legal Acceptance Management Standard*, is internal and kept in
`docs/legal/consent-acceptance-standard.md`.

All 8 documents are authored in 4 languages (`en`, `fr`, `pt`, `ss`). The Markdown
files are the **only place the texts are edited**; the app shows the published copy in
the `legal_policies` table (the files are a fallback when the API is unreachable).
See section 7 for how a change is published.

---

## 4. Database Schema

### `legal_policies` Table (versioned policies)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Unique record ID |
| `policy_id` | UUID | Logical identifier grouping versions of the same policy |
| `slug` | TEXT | URL-safe slug (`terms`, `privacy`, `cookies`, ...) |
| `title_en/fr/pt/ss` | TEXT | Localized titles |
| `content_en/fr/pt/ss` | TEXT | Localized markdown content |
| `version` | INTEGER | Version number, incremented on each edit |
| `created_at` / `updated_at` | TIMESTAMPTZ | Timestamps |

### `user_consents` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique record ID |
| `user_id` | UUID / VARCHAR | NOT NULL | User sub / ID |
| `document_type` | VARCHAR(50) | NOT NULL | Enum: TERMS_OF_SERVICE, PRIVACY_POLICY, etc. |
| `document_version` | VARCHAR(20) | NOT NULL | e.g. "1.0", "2.1" |
| `accepted_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Server timestamp |
| `ip_address` | VARCHAR(45) | NULLABLE | Client IP for audit |
| `user_agent` | TEXT | NULLABLE | Client browser metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |

### `privacy_requests` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique request ID |
| `user_id` | UUID / VARCHAR | NOT NULL | User initiating request |
| `request_type` | VARCHAR(50) | NOT NULL | `EXPORT_DATA`, `CORRECT_DATA`, `DELETE_ACCOUNT` |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'PENDING' | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `REJECTED` |
| `details` | TEXT | NULLABLE | Additional context |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Submission timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Resolution timestamp |

---

## 5. Security & Authorization Rules

1. **Server-Side Enforcement**: Policy acceptance must strictly be validated and recorded on the server. Frontend client state is never trusted.
2. **Immutable Audit Trail**: Previous consent records are never updated or overwritten. New acceptances insert new rows.
3. **Data Isolation**: Users can only query or view their own consent records (`user_id == claims.sub`).
4. **Unauthenticated Public Access**: The public legal center (`/legal`) is accessible without authentication.
5. **No in-app policy editing**: policies are published from the repository (section 7), so every change is reviewed in a pull request. The admin page `/app/admin-legal` only shows the published versions. Resolving privacy requests requires the `ministry` or `federation` role (role-guarded middleware).
6. **Dynamic Versioning**: The current consent version for Terms and Privacy is resolved from the latest `legal_policies` row, so re-acceptance is triggered automatically when a policy is republished.
7. **Server-chosen consent version**: `POST /api/v1/consents` records the version that is published at that moment. The client only names the document; any version it sends is ignored, and unknown document types are rejected.

## 6. API Surface

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/consents` | Any user | Record a consent acceptance |
| GET | `/api/v1/consents/me` | Any user | User's consent history |
| GET | `/api/v1/consents/status` | Any user | Active compliance check |
| POST | `/api/v1/privacy/requests` | Any user | Submit export/correct/delete request |
| GET | `/api/v1/privacy/requests/me` | Any user | User's privacy requests |
| GET | `/api/v1/privacy/requests` | ministry/federation | List all privacy requests |
| PUT | `/api/v1/privacy/requests/{id}` | ministry/federation | Update request status |
| GET | `/api/v1/legal/policies` | Any user | List latest policies |
| GET | `/api/v1/legal/policies/{slug}` | Any user | Get latest policy by slug |

---

## 7. Publishing a policy change

The Markdown files are the source; the database holds the published versions users
see and accept. To change a policy:

1. Edit `frontend/public/locales/{en,fr,pt,ss}/legal/<document>.md`. Line 1 must be
   `# Title`; use `##` / `###` for sections (they build the table of contents). Do not
   write a version or effective date in the text: the page shows them from the database.
2. Run `python3 scripts/publish-legal.py`. It writes
   `backend/migrations/NN_publish_legal_policies.sql`, which adds a new version of each
   changed document, and records the fingerprint of the published texts in
   `backend/legal/published.json`.
3. Commit the Markdown, the migration and `published.json` together and open a PR.
4. On deploy, `scripts/migrate-db.sh` applies the migration once. A version is only
   added when its text differs from the latest one, so re-running it is harmless.
   Users are then asked to accept an updated Terms of Service or Privacy Policy once.

**CI guard:** the `Legal Documents Published` job in `ci-frontend.yml` runs
`python3 scripts/publish-legal.py --check`. It fails when a Markdown file changed but
was not published, so the database and the files cannot drift apart.

Migrations: `50_create_legal_policies.sql`, `51_legal_policies_4lang.sql`,
`52_user_consents_and_privacy_requests.sql`, `53_publish_legal_policies.sql` (first
publication). They are idempotent, so databases that ran the earlier, mis-numbered
versions (38–40) accept them again unchanged.
