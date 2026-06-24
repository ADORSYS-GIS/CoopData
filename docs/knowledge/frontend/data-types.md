# Data Types & Constants Guide

> **Core Philosophy**: Define types and constants **once**, import them everywhere. Never duplicate a type. For our offline-first architecture, every entity that is stored in IndexedDB **must** extend `OfflineEntity` — the foundational interface that enforces `id`, `syncStatus`, `lastError`, and `syncRetries` on every locally-cached object.
>
> **Stop-and-Ask Rule**: If you find yourself writing a raw `string` or `number` where a known domain value could exist (like a role name or sync state), stop and use the proper enum or constant instead.

---

## 1. Directory Structure

```
frontend/src/
├── types/
│   ├── sync/
│   │   └── index.ts              # SyncStatus enum, OfflineEntity, SyncQueueItem
│   ├── api.ts                    # Raw API response shapes (dimension states)
│   ├── actionPlan.ts             # ActionItem, ActionPlan
│   ├── assessment.ts             # Assessment, AssessmentDetails, AssessmentSummary, payloads
│   ├── auth.ts                   # UserProfile, AuthState, AuthContextType
│   ├── consolidated_report.ts    # Report aggregation types
│   ├── cooperation.ts            # Cooperation entity
│   ├── cooperationUser.ts        # CooperationUser, AddCooperationUser
│   ├── digitalisationGap.ts      # IDigitalisationGap, Gap enum, score ranges
│   ├── digitalisationLevel.ts    # IDigitalisationLevel, LevelType, LevelState
│   ├── dimension.ts              # IDimension, IDimensionWithStates, submit payloads
│   ├── organization.ts           # Organization entity
│   ├── organizationDimension.ts  # Org-dimension link type
│   ├── recommendation.ts         # IRecommendation, priorities, CRUD payloads
│   ├── router.ts                 # RouteConfig, RoutesConfig
│   ├── types.ts                  # Shared generic utilities
│   └── user.ts                   # User entity
└── constants/
    ├── roles.ts                  # ROLES object — dgrv_admin, org_admin, coop_admin, coop_user
    └── user-roles.ts             # UserRole enum for form dropdowns
```

---

## 2. The Core Offline Foundation: `types/sync/index.ts`

This is the **single most critical type file** in the codebase. Every entity stored in IndexedDB inherits from `OfflineEntity`, and every mutation queued during offline sessions produces a `SyncQueueItem`. Never change these without understanding the full impact on the Dexie schema and `syncManager`.

```typescript
// File: frontend/src/types/sync/index.ts

/**
 * All possible synchronization states for a locally-cached entity.
 *
 * - SYNCED:   Record is in sync with the server. Safe to show without caveats.
 * - PENDING:  Record has been modified locally and is queued for upload.
 * - FAILED:   The last sync attempt failed. `lastError` will contain the reason.
 * - DIRTY:    Record has been modified but not yet enqueued (intermediate state).
 * - NEW:      Record was created offline and has never been sent to the server.
 * - UPDATED:  Record was modified while offline.
 * - DELETED:  Record was soft-deleted offline and will be deleted server-side on sync.
 */
export enum SyncStatus {
  SYNCED  = "synced",
  PENDING = "pending",
  FAILED  = "failed",
  DIRTY   = "dirty",
  NEW     = "new",
  UPDATED = "updated",
  DELETED = "deleted",
}

/**
 * Base interface for every entity persisted in IndexedDB.
 * ALL database-cached types MUST extend this interface.
 *
 * - id:           Primary key in IndexedDB. Must be a stable string UUID.
 * - syncStatus:   Current synchronization lifecycle state.
 * - lastError:    Human-readable error from the last failed sync attempt.
 * - syncRetries:  Number of times the sync manager has retried this record.
 */
export interface OfflineEntity {
  id: string;
  syncStatus: SyncStatus;
  lastError?: string;
  syncRetries?: number;
}

/**
 * A single item in the sync_queue Dexie table.
 * When an offline mutation occurs, the repository writes one of these rows
 * and the syncManager processes them sequentially when reconnected.
 *
 * - id:          Auto-incremented by Dexie (optional on creation).
 * - entityType:  The Dexie table name (e.g. "assessments", "dimensions").
 * - entityId:    The ID of the entity being mutated (UUID string).
 * - action:      The type of mutation to replay on the server.
 * - payload:     The full data to send in the API request body.
 * - timestamp:   ISO 8601 string. Used to process queue in chronological order.
 * - retries:     Number of sync attempts for this specific task.
 * - lastError:   Last error message from a failed sync attempt.
 */
export interface SyncQueueItem {
  id?: number;
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  payload: unknown;
  timestamp: string;
  retries: number;
  lastError?: string;
}
```

---

## 3. Domain Type Definitions

### A. Authentication & User Profile (`types/auth.ts`)

The `UserProfile` is populated from parsed JWT token claims (`keycloak.tokenParsed`). It drives all RBAC decisions in `ProtectedRoute` and `AuthContext`.

```typescript
// File: frontend/src/types/auth.ts

/**
 * Parsed from the Keycloak JWT token. Fields map directly to token claims.
 * Stored in IndexedDB under the key "auth_profile" for offline rehydration.
 *
 * - sub:                  Keycloak user ID (stable UUID).
 * - preferred_username:   User's username.
 * - roles:                Custom claim — top-level roles array.
 * - realm_access.roles:   Standard Keycloak realm roles.
 * - organization:         Custom claim — the org_admin's organization ID.
 * - cooperation:          Custom claim — the coop_admin/user's cooperation ID.
 * - assigned_dimensions:  Custom claim — dimension IDs a coop_user can answer.
 * - is_member_of:         False if org_admin has no organization yet (pending invite).
 */
export interface UserProfile {
  sub: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  roles?: string[];
  realm_access?: { roles: string[] } | undefined;
  organization_name?: string;
  organization?: string;
  cooperation?: string;
  assigned_dimensions?: string[];
  is_member_of?: boolean;
}

/** Full shape of the auth context state object. */
export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  roles: string[];
  loading: boolean;
}

/** The value exposed by `useAuth()`. Includes actions alongside state. */
export interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
}
```

---

### B. Assessment Types (`types/assessment.ts`)

```typescript
// File: frontend/src/types/assessment.ts
import { OfflineEntity } from "./sync";

/**
 * A locally-cached assessment record.
 * Extends OfflineEntity so IndexedDB tracks its sync lifecycle.
 */
export interface Assessment extends OfflineEntity {
  name: string;
  dimensionIds?: string[];
  organization_id: string;
  cooperation_id?: string | null | undefined;
  created_at: string;
  status: string;
}

/**
 * Raw API response shape for a single assessment detail.
 * Does NOT extend OfflineEntity — this is the backend shape.
 * The repository maps this to an `Assessment` before caching.
 */
export interface AssessmentDetails {
  assessment_id: string;
  organization_id: string;
  cooperation_id?: string | null;
  document_title: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  dimensions_id: string[];
}

/** Summary of a single dimension's results within an assessment. */
export interface DimensionAssessmentSummary {
  dimension_assessment_id: string;
  assessment_id: string;
  dimension_id: string;
  current_state_id: string;
  desired_state_id: string;
  gap_score: number;
  gap_id: string;
  created_at: string;
  updated_at: string;
}

/** Aggregated data object returned by the summary endpoint. */
export interface AssessmentSummaryData {
  assessment: AssessmentDetails;
  dimension_assessments: DimensionAssessmentSummary[];
  gaps_count: number;
  recommendations_count: number;
  overall_score: number | null;
}

/**
 * Locally-cached assessment summary.
 * `id` comes from OfflineEntity and maps to `assessment.assessment_id`.
 */
export interface AssessmentSummary extends OfflineEntity, AssessmentSummaryData {}

/** Payload shape for creating a new assessment via the API or offline queue. */
export interface AddAssessmentPayload {
  assessment_name: string;
  dimensions_id: string[];
  organization_id: string;
  cooperation_id: string;
}
```

---

### C. Dimension Types (`types/dimension.ts`)

Dimensions are the core data model. They include a `lang` field because a single logical dimension is stored multiple times in IndexedDB — once per language — using the `[id+lang]` composite primary key.

```typescript
// File: frontend/src/types/dimension.ts
import { OfflineEntity } from "@/types/sync/index";
import { CreateDimensionRequest } from "@/openapi-client/types.gen";

/**
 * A locally-cached dimension record.
 * CRITICAL: The `lang` field is required for the [id+lang] composite index in Dexie.
 * The `dimension_key` is the stable cross-language identifier (e.g. "digitalisation").
 * The `id` from OfflineEntity is the Dexie primary key component.
 */
export interface IDimension extends OfflineEntity {
  name: string;
  description?: string | null;
  category?: string | null;
  weight?: number | null;
  is_active?: boolean | null;
  lang: string;           // e.g. "en", "fr", "pt", "ss"
  dimension_key?: string | null; // Stable identifier, same across all language rows
}

/**
 * Extends the OpenAPI-generated request type with a temporary offline ID.
 * When a dimension is created offline, the repository assigns a `crypto.randomUUID()`
 * as the `id` and replaces it with the server ID upon sync.
 */
export interface ICreateDimensionRequest extends CreateDimensionRequest {
  id?: string; // Temporary ID for offline creation
}

/** A single maturity state within a dimension (e.g. Level 1, Level 2). */
export interface IDimensionState {
  id: string;
  dimensionId: string;
  level: number;
  name: string;
  score?: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** A dimension enriched with its associated current/desired maturity states. */
export interface IDimensionWithStates extends IDimension {
  currentState?: IDimensionState | null;
  desiredState?: IDimensionState | null;
  states?: IDimensionState[];
  current_states?: IDimensionState[];
  desired_states?: IDimensionState[];
}

/**
 * The full payload for submitting a dimension assessment answer.
 * Includes offline-specific fields (`lang`, `dimensionKey`, level numbers)
 * that are needed to store the response in IndexedDB and resolve display.
 */
export interface ISubmitDimensionAssessmentRequest {
  dimensionId: string;
  assessmentId: string;
  currentStateId: string;
  desiredStateId: string;
  gapScore: number;
  organizationId: string;
  cooperationId: string | null;    // null for org_admin users
  userRoles?: string[];
  // Offline storage and UI display fields:
  currentLevel: number;
  desiredLevel: number;
  lang: string;
  dimensionKey?: string;
}

/** Shape of the server's response after a dimension assessment is submitted. */
export interface IDimensionAssessmentResponse {
  id: string;
  dimensionId: string;
  assessmentId: string;
  currentState: IDimensionState;
  desiredState: IDimensionState;
  createdAt: string;
  updatedAt: string;
  gap_id?: string;
}

/** Locally-cached dimension assessment. Includes sync tracking fields. */
export interface IDimensionAssessment
  extends Omit<IDimensionAssessmentResponse, "id"> {
  id: string;
  syncStatus: string;
  lastError?: string;
  gap_id?: string;
}
```

---

### D. Digitalisation Gap Types (`types/digitalisationGap.ts`)

```typescript
// File: frontend/src/types/digitalisationGap.ts
import { SyncStatus } from "@/types/sync";

/**
 * Severity classifications for a digitalisation gap.
 * Determined by the gap_score from the dimension assessment.
 */
export enum Gap {
  HIGH   = "HIGH",
  MEDIUM = "MEDIUM",
  LOW    = "LOW",
}

/**
 * Maps each severity to the score range that triggers it.
 * Used for UI labels and filtering.
 */
export const scoreRanges = {
  [Gap.HIGH]:   "0-50",
  [Gap.MEDIUM]: "50-75",
  [Gap.LOW]:    "75-100",
};

/**
 * A locally-cached digitalisation gap record.
 * Stored in Dexie with the [id+lang] composite primary key.
 * The `dimension_key` links this gap to its parent dimension across languages.
 */
export interface IDigitalisationGap {
  id: string;
  lang: string;
  dimensionId: string;
  dimension_key?: string;
  gap_severity: Gap;
  description: string;
  currentLevel?: number;
  desiredLevel?: number;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  syncStatus: SyncStatus;
  lastError?: string;
}

/** Extended with the dimension name for display in list views. */
export interface IDigitalisationGapWithDimension extends IDigitalisationGap {
  dimensionName: string;
}

/** Strips server-managed and sync fields when creating a gap. */
export type AddDigitalisationGapPayload = Omit<
  IDigitalisationGap,
  "id" | "syncStatus" | "createdAt" | "updatedAt" | "isDeleted"
>;

/** Partial update — requires `id` but all other fields are optional. */
export type UpdateDigitalisationGapPayload =
  Partial<AddDigitalisationGapPayload> & { id: string };
```

---

### E. Digitalisation Level Types (`types/digitalisationLevel.ts`)

```typescript
// File: frontend/src/types/digitalisationLevel.ts
import { OfflineEntity } from "./sync";
import {
  CreateCurrentStateRequest,
  CreateDesiredStateRequest,
} from "@/openapi-client/types.gen";

/** Whether the level represents a current or desired maturity state. */
export type LevelType = "current" | "desired";

/** Numeric representation of the maturity level (e.g. 1, 2, 3, 4, 5). */
export type LevelState = number;

/**
 * A locally-cached maturity level for a dimension.
 * Stored in Dexie with composite key [id+lang].
 *
 * - state:     Numeric maturity score (maps to `score` in the API).
 * - level:     String descriptor from the API (e.g. "Beginner") — different from `state`.
 * - levelType: Whether this is a "current" or "desired" state option.
 */
export interface IDigitalisationLevel extends OfflineEntity {
  dimensionId: string;
  levelType: LevelType;
  state: LevelState;
  title: string;
  description: string | null;
  level?: string | null;
  lang: string;
}

/** Extends the OpenAPI request type with offline temp ID and UI helpers. */
export interface ICreateCurrentStateRequest extends CreateCurrentStateRequest {
  id?: string;
  levelType: LevelType;
  level?: string | null;
  title: string;
}

export interface ICreateDesiredStateRequest extends CreateDesiredStateRequest {
  id?: string;
  levelType: LevelType;
  level?: string | null;
  title: string;
}
```

---

### F. Recommendation Types (`types/recommendation.ts`)

```typescript
// File: frontend/src/types/recommendation.ts
import { SyncStatus } from "./sync";

export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH";

/**
 * A locally-cached or server-fetched recommendation for a dimension gap.
 * `syncStatus` and `lastError` are optional here because recommendations
 * can also be fetched from the server without being cached locally first.
 */
export interface IRecommendation {
  id: string;
  recommendation_id?: string;
  dimension_id: string;
  dimension_key?: string;
  title?: string;
  description: string;
  category?: string;
  priority?: RecommendationPriority;
  language?: string;
  effort?: string;
  cost?: number;
  impact?: number;
  created_at?: string;
  updated_at?: string;
  syncStatus?: SyncStatus;
  lastError?: string;
}

export interface ICreateRecommendationRequest {
  dimension_id?: string;
  dimension_key: string;
  priority: RecommendationPriority;
  description: string;
  language?: string;
}

export interface IUpdateRecommendationRequest {
  id: string;
  dimension_id?: string;
  priority?: RecommendationPriority;
  description?: string;
}

/** Raw server response before mapping to IRecommendation. */
export interface IRecommendationResponse {
  recommendation_id: string;
  dimension_id: string;
  title: string;
  description: string;
  category?: string;
  priority?: RecommendationPriority;
  effort?: string;
  cost?: number;
  impact?: number;
  created_at: string;
  updated_at: string;
}
```

---

### G. Router Types (`types/router.ts`)

```typescript
// File: frontend/src/types/router.ts
import { ReactNode } from "react";

/**
 * A single route configuration node.
 * Consumed by the recursive renderRoutes() function in AppRouter.tsx.
 * Children are rendered as nested <Route> elements.
 */
export interface RouteConfig {
  path: string;
  element: ReactNode;
  children?: RouteConfig[];
}

export type RoutesConfig = RouteConfig[];
```

---

## 4. Constants

### Role Constants (`constants/roles.ts`)

These string values **must exactly match** the Keycloak realm role names. They are used everywhere: `ProtectedRoute`, `AuthContext`, `syncManager`, and repository role filters.

```typescript
// File: frontend/src/constants/roles.ts

/**
 * Keycloak realm role name constants.
 * CRITICAL: These values must exactly match the role names configured in Keycloak.
 * Used in ProtectedRoute (allowedRoles), AuthContext (RBAC), and repositories
 * (role-based pre-caching logic).
 */
export const ROLES = {
  ADMIN:      "dgrv_admin",   // Global DGRV administrator
  ORG_ADMIN:  "org_admin",    // Organization-level administrator
  COOP_ADMIN: "coop_admin",   // Cooperative-level administrator
  COOP_USER:  "coop_user",    // Cooperative-level regular user
};
```

### User Role Enum (`constants/user-roles.ts`)

Used in dropdown form selects when inviting users or managing cooperative members.

```typescript
// File: frontend/src/constants/user-roles.ts

/** Used in UI dropdowns for role assignment forms. */
export enum UserRole {
  Admin = "admin",
  User  = "user",
}

/** Ready-to-use options array for <Select> components. */
export const userRoles = [
  { label: "Admin", value: UserRole.Admin },
  { label: "User",  value: UserRole.User  },
];
```

---

## 5. Naming Conventions & Code Style

| Subject | Convention | Example |
|---|---|---|
| Interfaces | PascalCase | `IDimension`, `OfflineEntity`, `UserProfile` |
| Enums | PascalCase | `SyncStatus`, `Gap`, `UserRole` |
| Enum values | UPPER_SNAKE_CASE | `SyncStatus.PENDING`, `Gap.HIGH` |
| Constants objects | UPPER_SNAKE_CASE | `ROLES`, `CONFIG` |
| Type aliases | PascalCase | `LevelType`, `RecommendationPriority` |
| Payload types | Descriptive suffix | `AddAssessmentPayload`, `UpdateDigitalisationGapPayload` |

**Key rules:**
1. **No `any`** — use `unknown` for truly dynamic payloads (`SyncQueueItem.payload`).
2. **`as const`** on all plain-object constants to prevent mutation and get literal types.
3. **`Omit<>`** for payload types — never duplicate fields manually.
4. **`extends OfflineEntity`** on every type stored in IndexedDB.
5. Import types from `@/openapi-client/types.gen` as the base, then extend for local use.

---

## Checklist

- [ ] All IndexedDB-cached types extend `OfflineEntity` from `@/types/sync`.
- [ ] Types with language variants include a `lang: string` field for composite `[id+lang]` Dexie keys.
- [ ] Raw API response types do **not** extend `OfflineEntity` — repositories map them.
- [ ] Payload types use `Omit<>` to exclude server-managed fields (`id`, `created_at`, `syncStatus`).
- [ ] All role strings come from the `ROLES` constant — no hardcoded `"dgrv_admin"` strings.
- [ ] Enum values are used in switch/case and comparisons, never raw strings.
- [ ] New entity types are added to the appropriate file in `frontend/src/types/`.
- [ ] `SyncQueueItem` is the only shape written to `db.sync_queue` — no ad-hoc objects.
