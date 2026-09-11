# Feature Design: User-Facing Legal, Privacy & Consent Management

> **Status:** Implemented
> **Ticket:** User-Facing Legal, Privacy & Consent Management
> **Component:** Frontend + Backend
> **Languages:** English (en), French (fr), Portuguese (pt), Siswati (ss)

---

## 1. Overview & Business Value

CoopData processes personal, organizational, and sensitive financial information. Providing clear legal documentation and auditable consent management improves transparency, user trust, and compliance readiness (GDPR, NDPR, CCPA).

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
│ • Static Markdown files (.md) in public/locales/{en|fr}/legal/            │
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

All 6 documents are authored in 4 languages (`en`, `fr`, `pt`, `ss`) both as static
markdown assets and as seeded rows in the `legal_policies` table (migration 40).

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
5. **Admin-Only Policy Management**: Creating/updating legal policies (`POST`/`PUT /api/v1/legal/policies`) and resolving privacy requests require the `ministry` or `federation` role (role-guarded middleware).
6. **Dynamic Versioning**: The current consent version for Terms and Privacy is resolved from the latest `legal_policies` row, so re-acceptance is triggered automatically when a policy is republished.

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
| POST | `/api/v1/legal/policies` | ministry/federation | Create policy |
| PUT | `/api/v1/legal/policies/{policy_id}` | ministry/federation | Publish new policy version |
