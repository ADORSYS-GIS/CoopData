# Database Schema & Offline Persistence Guide (Dexie / IndexedDB)

> **Core Philosophy**: The entire offline experience is built on top of a Dexie.js database (`AppDB`). Understanding the schema, versioning rules, composite keys, and error protection wrappers is mandatory before touching any repository or service file. **Never change a table's primary key in-place** — always drop and recreate (see versioning rules below).
>
> **Stop-and-Ask Rule**: If you need to add a new table or index that involves a language variant (`lang`), always use a `[id+lang]` composite primary key and ask if a migration version bump is needed.

---

## 1. File Location

```
frontend/src/services/db.ts    ← The ONLY place the database schema is defined
```

---

## 2. Full Schema — Current State (Version 20)

```typescript
// File: frontend/src/services/db.ts
import Dexie, { Table } from "dexie";

export class AppDB extends Dexie {
  // Simple primary key (string UUID)
  users!: Table<KeycloakUser, string>;
  dimensionAssessments!: Table<IDimensionAssessment, string>;
  assessments!: Table<Assessment, string>;
  submissions!: Table<Submission, string>;
  organizations!: Table<Organization, string>;
  cooperations!: Table<Cooperation, string>;
  cooperationUsers!: Table<CooperationUser, string>;
  action_plans!: Table<ActionPlan, string>;
  recommendations!: Table<IRecommendation, string>;
  organizationDimensions!: Table<OrganizationDimension, string>;

  // Auto-increment primary key (number)
  sync_queue!: Table<SyncQueueItem, number>;

  // Composite primary key [id+lang] — multi-language tables
  dimensions!: Table<IDimension, [string, string]>;
  digitalisationGaps!: Table<IDigitalisationGap, [string, string]>;
  digitalisationLevels!: Table<IDigitalisationLevel, [string, string]>;
  dimensionWithStatesCache!: Table<IDimensionWithStates & { lang: string }, [string, string]>;

  // Legacy table — kept for migration continuity, no longer used in business logic
  dimensionWithStates!: Table<IDimensionWithStates, string>;
}
```

---

## 3. Composite Primary Key Tables — Critical Rules

Three tables use a **two-field composite primary key** `[id+lang]`. This enables storing the same logical entity in multiple languages simultaneously.

| Table | Primary Key | Secondary Indexes |
|---|---|---|
| `dimensions` | `[id+lang]` | `id`, `lang` |
| `digitalisationLevels` | `[id+lang]` | `id`, `lang`, `dimensionId`, `[dimensionId+levelType]` |
| `digitalisationGaps` | `[id+lang]` | `id`, `lang`, `dimensionId`, `dimension_key`, `[dimension_key+gap_severity+lang]`, `[dimensionId+gap_severity+lang]` |
| `dimensionWithStatesCache` | `[id+lang]` | `id`, `lang` |

### Writing to a Composite Key Table
Every object written to these tables **must** contain both `id` AND `lang`. Missing either field causes a silent failure (caught by the error wrapper).

```typescript
// CORRECT ✅ — both id and lang present
await db.dimensions.put({
  id: "dim-123",
  lang: "en",
  name: "Digital Infrastructure",
  syncStatus: SyncStatus.SYNCED,
  // ... other fields
});

// WRONG ❌ — missing lang field — will silently fail
await db.dimensions.put({
  id: "dim-123",
  name: "Digital Infrastructure",
});
```

### Reading from a Composite Key Table
Use the `[id, lang]` array as the key:

```typescript
// Get a specific language variant
const dimension = await db.dimensions.get(["dim-123", "en"]);

// Query by a secondary index
const enDimensions = await db.dimensions.where("lang").equals("en").toArray();

// Query using a compound index
const gaps = await db.digitalisationGaps
  .where("[dimensionId+gap_severity+lang]")
  .equals(["dim-123", "HIGH", "en"])
  .toArray();
```

---

## 4. The `sync_queue` Table

This table is the backbone of offline writes. It uses an **auto-increment number** primary key and is ordered by `timestamp` during processing.

```typescript
// Schema: "++id, entityType, action"
// Every offline mutation creates one row here.

const queueItem: SyncQueueItem = {
  // id: auto-assigned by Dexie (++id)
  entityType: "assessments",         // Matches the Dexie table name
  entityId: "assessment-uuid-here",  // The entity being mutated
  action: "CREATE",                  // "CREATE" | "UPDATE" | "DELETE"
  payload: { assessment_name: "...", dimensions_id: [...] },
  timestamp: new Date().toISOString(),
  retries: 0,
  lastError: undefined,
};
await db.sync_queue.add(queueItem);
```

The `syncManager.syncAll()` processes items in `timestamp` ascending order to preserve causal consistency (e.g., a CREATE must execute before its associated UPDATE).

---

## 5. Schema Versioning — The Golden Rules

Dexie uses versioned schema migrations. **These rules are non-negotiable:**

### Rule 1: Never change a primary key in-place
If you need to change the primary key of an existing table, you must:
1. Drop the table by setting it to `null` in a new version.
2. Recreate it with the new schema in a subsequent version.

```typescript
// Example: How dimensions was migrated to composite key [id+lang]

// Version 14 — first attempt (was a bad approach, later dropped)
this.version(14).stores({
  dimensions: "[id+lang], id, lang",
});

// Version 16 — drop the tables that need PK changes
this.version(16).stores({
  dimensions: null,           // ← Must drop before recreating
  digitalisationLevels: null,
  digitalisationGaps: null,
});

// Version 17 — recreate with correct composite PKs
this.version(17).stores({
  dimensions: "[id+lang], id, lang",
  digitalisationLevels: "[id+lang], id, lang, dimensionId, [dimensionId+levelType]",
  digitalisationGaps: "[id+lang], id, lang, dimensionId, [dimensionId+currentLevel+desiredLevel+lang]",
});
```

### Rule 2: Only add new versions — never edit existing ones
Modifying a past `.version()` block after it's been deployed to users causes `UpgradeError` crashes. Always increment.

### Rule 3: New tables or indexes are always additive
To add a new table or a new index to an existing table, simply add a new `.version(N+1).stores({})` block with the delta.

### Rule 4: One-time data migrations use `.upgrade()`
If a schema version requires data transformation (e.g. normalizing a field), use `.upgrade(tx)`:

```typescript
this.version(21).stores({
  assessments: "id, organization_id, cooperation_id, status",
}).upgrade(async (tx) => {
  // Migrate existing records
  await tx.table("assessments").toCollection().modify((assessment) => {
    if (!assessment.status) {
      assessment.status = "active";
    }
  });
});
```

---

## 6. Global Error Protection Wrappers

All composite-key tables are wrapped with error-safe versions of `put`, `bulkPut`, `add`, and `bulkAdd`. This prevents a single malformed record from crashing the application.

```typescript
// Applied in db.ts after the AppDB instance is created:
wrapTableOperations(db.dimensions, 'dimensions');
wrapTableOperations(db.digitalisationLevels, 'digitalisationLevels');
wrapTableOperations(db.digitalisationGaps, 'digitalisationGaps');
wrapTableOperations(db.dimensionWithStatesCache, 'dimensionWithStatesCache');
```

The wrapper catches `key path did not yield a value` errors (missing composite key fields) and logs them without re-throwing, so the application continues operating.

### Pattern — How the Wrapper Works
```typescript
table.put = async function(item: any, key?: any) {
  try {
    return await originalPut(item, key);
  } catch (error: any) {
    console.error(`IndexedDB ${tableName}.put error:`, error);
    if (error.message?.includes('key path did not yield a value')) {
      console.error(`Missing required fields for ${tableName}:`, item);
    }
    return Promise.resolve(key || item.id || item); // Graceful no-op
  }
};
```

---

## 7. Global Unhandled Rejection Guard

`main.tsx` registers a global `unhandledrejection` listener that intercepts and suppresses IndexedDB-originated errors to prevent full-page crashes:

```typescript
// File: frontend/src/main.tsx
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    reason?.name === 'DataError' ||
    reason?.message?.includes('IDBObjectStore') ||
    reason?.name === 'DatabaseError'
  ) {
    event.preventDefault(); // Suppress — do not crash the app
  } else {
    console.error('Unhandled promise rejection:', reason);
  }
});
```

---

## 8. One-Time Data Migrations (localStorage Guards)

Some migrations need to run once per device at startup. Use `localStorage` flags to guard them:

```typescript
// File: frontend/src/main.tsx

// Clear stale action_plans cache that may contain cross-cooperation data
const ACTION_PLANS_CACHE_CLEARED = "action_plans_cache_v2_cleared";
if (!localStorage.getItem(ACTION_PLANS_CACHE_CLEARED)) {
  db.action_plans.clear().then(() => {
    localStorage.setItem(ACTION_PLANS_CACHE_CLEARED, "1");
  });
}
```

**Pattern**: The key name should be descriptive and versioned (e.g., `_v2_`) so that future migrations can use a new key name to re-trigger the clear.

---

## Checklist

- [ ] New entities cached offline extend `OfflineEntity` and include `id` and `syncStatus` fields.
- [ ] Multi-language entities include a `lang` field and use the `[id+lang]` composite primary key.
- [ ] Schema changes use a new `.version(N+1)` block — existing versions are never modified.
- [ ] Primary key changes are always done via drop (`null`) then recreate in two separate version blocks.
- [ ] All composite key tables are wrapped using `wrapTableOperations()` after `new AppDB()`.
- [ ] One-time startup migrations use versioned `localStorage` keys to prevent re-running.
- [ ] Queries on `sync_queue` always order by `timestamp` ascending.
- [ ] New tables intended for multi-language use are defined with `[id+lang]` from the start.
