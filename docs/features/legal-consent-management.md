# Feature Design: User-Facing Legal, Privacy & Consent Management

> **Status:** Draft / Proposed  
> **Ticket:** User-Facing Legal, Privacy & Consent Management  
> **Component:** Frontend + Backend  

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

| # | Document Type | Endpoint / Route | Assets Location |
|---|---|---|---|
| 1 | `TERMS_OF_SERVICE` | `/legal/terms` | `/locales/{lang}/legal/terms_v1.0.md` |
| 2 | `PRIVACY_POLICY` | `/legal/privacy` | `/locales/{lang}/legal/privacy_v1.0.md` |
| 3 | `COOKIE_POLICY` | `/legal/cookies` | `/locales/{lang}/legal/cookie_v1.0.md` |
| 4 | `ACCEPTABLE_USE` | `/legal/acceptable-use` | `/locales/{lang}/legal/acceptable_use_v1.0.md` |
| 5 | `SECURITY_PROTECTION` | `/legal/security` | `/locales/{lang}/legal/security_v1.0.md` |
| 6 | `DATA_RETENTION` | `/legal/data-retention` | `/locales/{lang}/legal/data_retention_v1.0.md` |

---

## 4. Database Schema

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
4. **Unauthenticated Public Access**: All 6 legal document pages (`/legal/*`) are publicly accessible without authentication.
