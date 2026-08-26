# Apex-Initiated Submissions — Feature Design

> **Status:** Implemented
> **Last Updated:** 2025-08-22
> **Owner:** Engineering Team

---

## 1. Overview

This feature allows **Apex users to create, fill, and submit annual data returns on behalf of cooperatives** under their management. The submission flows through the same review pipeline as cooperative-created submissions, with attribution tracking and an exclusive editor model.

**Core principle:** The apex acts as a full substitute for the cooperative — creating the submission, entering all data, and submitting it. The cooperative is informed but does not edit apex-initiated submissions unless the apex explicitly delegates during review.

### Quick Flow Summary

```
1. Apex creates submission for a cooperative
   → Apex is editor, cooperative sees read-only

2. Apex fills data and submits
   → Skips apex review, goes directly to Federation

3. Federation reviews
   ├─ Approve → Ministry (or Approved)
   └─ Return → Apex

4. Apex handles the returned submission (only for apex-created subs)
   ├─ Fix Myself → Apex edits, resubmits to Federation
   └─ Delegate to Cooperative → Coop edits, submits back to Apex → Apex reviews → Federation

5. Apex can Reclaim a delegated submission at any time

6. Cycle repeats until approved
```

> **Note:** The "Fix Myself / Delegate to Cooperative" option only appears for submissions created by the apex. For cooperative-created submissions returned to apex, the apex sees only the standard approve/return review panel.

---

## 2. Concurrency Model — Exclusive Editor

### 2.1 The Rule

**Only ONE person can edit a draft at a time.** There are no version numbers, no conflict detection, no heartbeats, no locks. The system enforces this through a single `edited_by` field on the submission.

| Who created the draft | Who can edit while draft | Who sees read-only |
|----------------------|------------------------|-------------------|
| Apex | Apex | Cooperative |
| Cooperative | Cooperative | Apex (when applicable) |
| Apex delegated to Cooperative | Cooperative | Apex |

### 2.2 How It Works

```
APEX CREATES DRAFT
  → edited_by = apex user UUID
  → Cooperative sees: "Created by John Dlamini (Apex)"  [read-only]

COOPERATIVE CREATES DRAFT
  → edited_by = cooperative user UUID
  → Apex sees: "Created by Mary Smith (Cooperative)"  [read-only]

APEX DELEGATES TO COOPERATIVE
  → edited_by = cooperative user UUID  (ownership transferred)
  → Apex sees: "Delegated to Mary Smith (Cooperative)"  [read-only]

COOPERATIVE SUBMITS
  → edited_by = NULL  (submitted — no one editing)
  → Everyone sees: "Submitted" status
```

### 2.3 Why No Versioning?

| Concern | Why it doesn't apply |
|---------|---------------------|
| "Two people might edit simultaneously" | Impossible — only the owner can edit |
| "What if someone edits an old version?" | Not possible — reads are always current |
| "What about offline edits?" | Offline saves queue locally, sync checks `edited_by` at push time |
| "What about long editing sessions?" | No issue — no expiry, no heartbeat. Owner edits until they submit or delegate |

**The only edge case:** If the owner's browser crashes mid-edit, the draft stays in "editing" state until they return. This is acceptable because:
1. Drafts are annual submissions — not urgent
2. The owner can simply refresh and continue
3. No one else needs to edit it anyway

### 2.4 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Owner's browser crashes | Draft stays "in editing". Owner refreshes, continues. No data loss. |
| Owner leaves tab open for hours | No issue — no timeout, no lock expiry |
| Two users click "Edit" at same time | First click wins. Second user sees "Currently editing by {name}" |
| Apex delegates, then wants it back | Apex re-delegates to themselves (new endpoint: `/reclaim`) |
| Owner submits, then wants to edit | Not possible — submission transitions to InReview. Must go through return flow. |

---

## 3. Roles & Responsibilities

| Actor | Can create | Can edit data | Can submit | Can delete | Can delegate |
|-------|-----------|--------------|-----------|------------|-------------|
| Cooperative | ✅ Own submissions | ✅ Own drafts only | ✅ Own drafts only | ✅ Own drafts only | ❌ |
| Apex | ✅ On behalf of any coop under them | ✅ Drafts they own | ✅ Drafts they own | ✅ Drafts they own | ✅ Return submissions |
| Federation | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ministry | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Complete End-to-End Flow

### Phase 1: Apex Initiates

```
Apex user logs in → Submissions page → Clicks "New Submission"
    ↓
Modal: Pick Cooperative (dropdown of coops under this apex)
    ↓
Modal: Pick Reporting Year (calendar picker)
    ↓
Modal: Pick Submission Method (upload / manual / questionnaire)
    ↓
Backend creates submission:
    - cooperative_id = selected coop
    - submitted_by = apex user UUID
    - created_by_role = "apex"
    - edited_by = apex user UUID
    - status = Draft
    - current_tier = Cooperative
    - Creates sections based on method
    ↓
Submission appears in:
    - Apex's submissions list (with badge: "Created by You")
    - Cooperative's submissions list (with badge: "Created by Apex — {name}")
```

### Phase 2: Apex Fills the Data

The apex opens the submission detail page — identical UI to what the cooperative sees:

**If method = "upload":**
1. Apex uploads the cooperative's financial statement PDF
2. Extraction pipeline runs (same as today)
3. Line items, abnormality flags, financial sections populate
4. Apex reviews flags, resolves or acknowledges them

**If method = "manual":**
1. Apex fills members database
2. Apex fills savings accounts
3. Apex fills loans
4. Apex fills fixed deposits
5. Apex fills farm coop data (if applicable)

**If method = "questionnaire":**
1. Apex fills the financial questionnaire
2. Apex fills the non-financial questionnaire

**During this phase:**
- The cooperative sees the draft in their submissions list
- Badge shows: "In progress — Created by {apex_user_name}"
- Dashboard shows: "{apex_user_name} is editing submission for {coop_name} — Year {year}"
- The cooperative CANNOT edit this draft (apex owns it)

### Phase 3: Apex Submits → Skips to Federation

Once all sections are ready, apex clicks "Submit":

Backend validates:
- All required sections are ready
- No error-severity flags outstanding
- Financial statement exists (for non-questionnaire methods)

Then transitions:
- status: Draft → **InReview**
- current_tier: → **Federation** (skips apex review — apex already validated)
- edited_by: → NULL (no one editing)

Review audit log: "Submitted by {apex_user_name} on behalf of {cooperative_name}"

**Why skip apex review?** The apex created and filled the submission. Sending it to their own review queue adds no value. It goes directly to Federation.

### Phase 4: Federation Reviews

**Federation approves:**
- status: InReview → InReview
- current_tier: → Ministry

**Federation returns with comments:**
- status: InReview → Returned
- current_tier: → Apex

**For apex-created submissions — Apex decision point (two options):**

| Apex action | What happens |
|-------------|-------------|
| **"Fix myself"** | Apex edits the returned draft directly, resubmits to Federation |
| **"Delegate to Cooperative"** | Submission moves to Cooperative tier as Draft. Cooperative sees: "Returned by Federation — please fix and resubmit." Cooperative edits, submits → goes back to Apex tier → Apex reviews → forwards to Federation |

> **Important:** The "Fix Myself / Delegate to Cooperative" card only appears when `created_by_role = "apex"`. For cooperative-created submissions returned to apex, the apex only sees the standard approve/return review panel — they cannot delegate because the cooperative already owns the submission.

**For cooperative-created submissions returned to apex:**
- Apex sees only the standard approve/return review panel
- Apex approves → forwards to Ministry
- Apex returns → back to cooperative to fix

**Backend — new endpoint for delegation:**
```
POST /api/v1/apex/submissions/{id}/delegate
Body: { "comment": "Please update the members data" }
```

This transitions:
- status: Returned → Draft
- current_tier: → Cooperative
- edited_by: → cooperative user UUID (ownership transferred)
- Records review: { action: "delegate", comment: "..." }

**Backend — new endpoint for reclaim:**
```
POST /api/v1/apex/submissions/{id}/reclaim
Body: { "comment": "I'll handle this myself" }
```

This transitions:
- edited_by: → apex user UUID (ownership reclaimed)
- Records review: { action: "reclaim", comment: "..." }

**Flow diagram:**
```
Federation returns → Apex tier
                      ↓
            Apex decides:
           /              \
   Fix myself         Delegate to Coop
       ↓                    ↓
 Apex edits Draft     Coop sees Draft
       ↓                    ↓
 Apex resubmits       Coop resubmits
       ↓                    ↓
 → Federation         → Apex reviews
                            ↓
                      → Federation
```

### Phase 4.1: Detailed Delegation Flow

When apex delegates a returned submission to the cooperative, the following happens step by step:

```
1. APEX OPENS THE SUBMISSION (read-only view)
   → Sees: "Delegated to Mary Smith (Cooperative)" (if previously delegated)
   → Or sees: "Returned — Fix or Delegate" (first time returned)
   → Sees: any changes the cooperative has made so far
   → Button visible: "Delegate to Cooperative"

2. APEX CLICKS "DELEGATE"
   → DelegationDialog opens:
   ┌─────────────────────────────────────────────────┐
   │  Delegate to Cooperative                        │
   │                                                 │
   │  The cooperative will be notified to fix and    │
   │  resubmit.                                      │
   │                                                 │
   │  Comment (optional):                            │
   │  ┌─────────────────────────────────────────┐    │
   │  │ Please update the members data          │    │
   │  └─────────────────────────────────────────┘    │
   │                                                 │
   │  [Cancel]                    [Delegate]         │
   └─────────────────────────────────────────────────┘

3. BACKEND PROCESSES THE DELEGATION
   → POST /api/v1/apex/submissions/{id}/delegate
   → Body: { "comment": "Please update the members data" }
   → Backend:
     a. Verifies apex has permission (apex role + cooperative belongs to them)
     b. Verifies submission is in Returned status at Apex tier
     c. Records a review audit log entry:
        {
          action: "return",
          tier: "apex",
          reviewer_id: apex user UUID,
          comment: "Please update the members data",
          target_tier: "cooperative",
          created_at: NOW()
        }
     d. Sets edited_by = NULL (cooperative will pick it up when they open it)
     e. Returns updated submission

4. COOPERATIVE'S VIEW CHANGES
   → Before: "Returned to Apex" (read-only)
   → After: "Returned — Please fix" with edit button enabled
   → Badge: "Delegated by John Dlamini (Apex)"
   → Cooperative can now edit all sections and resubmit

5. COOPERATIVE EDITS AND SUBMITS
   → Cooperative opens submission → becomes the editor (edited_by = cooperative user)
   → Cooperative fixes the issues pointed out by federation
   → Cooperative clicks Submit
   → Backend: status → Submitted, current_tier → Apex, edited_by → NULL
   → Apex sees the submission in their review queue again
```

### Phase 4.2: Detailed Reclaim Flow

When apex wants to take back a delegated submission from the cooperative:

```
1. APEX OPENS THE DELEGATED SUBMISSION
   → Sees: "Delegated to Mary Smith (Cooperative)" badge
   → Sees: any changes the cooperative has saved so far
   → Button visible: "Reclaim Submission"

2. APEX CLICKS "RECLAIM"
   → ReclaimDialog opens:
   ┌─────────────────────────────────────────────────┐
   │  Reclaim Submission                             │
   │                                                 │
   │  Transfer editing rights back to you.           │
   │  Mary Smith will no longer be able to edit.     │
   │                                                 │
   │  Comment (optional):                            │
   │  ┌─────────────────────────────────────────┐    │
   │  │ I have the correct data, taking over    │    │
   │  └─────────────────────────────────────────┘    │
   │                                                 │
   │  [Cancel]                    [Reclaim]          │
   └─────────────────────────────────────────────────┘

3. BACKEND PROCESSES THE RECLAIM
   → POST /api/v1/apex/submissions/{id}/reclaim
   → Body: { "comment": "I have the correct data, taking over" }
   → Backend:
     a. Verifies apex has permission (apex role + cooperative belongs to them)
     b. Verifies submission is a draft (in delegated state)
     c. Verifies the submission was previously delegated (has a return review with target_tier=cooperative)
     d. Records a review audit log entry:
        {
          action: "comment",
          tier: "apex",
          reviewer_id: apex user UUID,
          comment: "Reclaimed by apex: I have the correct data, taking over",
          created_at: NOW()
        }
     e. Sets edited_by = apex user UUID, edited_by_name = apex user name
     f. Returns updated submission

4. COOPERATIVE'S VIEW CHANGES
   → Before: "Editing — Mary Smith (Cooperative)" (editable)
   → After: "Returned — Apex editing" (read-only)
   → Badge: "Reclaimed by John Dlamini (Apex)"
   → Any edit/submit buttons are hidden
   → Cooperative can still VIEW the submission and see all data

5. APEX'S VIEW CHANGES
   → Before: read-only "Delegated to Mary Smith"
   → After: full edit mode — all forms unlocked
   → Apex can edit any section, submit, or delete
```

### Phase 4.3: What Happens to Partial Work?

When the cooperative was editing and the apex reclaims:

- **Data persists**: Any sections the cooperative saved are still in the database
- **No undo**: Reclaim does NOT revert the cooperative's changes
- **Apex sees everything**: When apex opens the reclaimed submission, they see all data the cooperative entered
- **Apex can**: Keep the cooperative's work and continue, overwrite with their own data, or review and adjust

Example:
```
Cooperative saved members data → 50 rows in members table
Apex reclaims → members data is still there (50 rows)
Apex opens submission → sees the cooperative's 50 member records
Apex can:
  a. Keep them and move to the next section
  b. Delete and re-enter with correct data
  c. Edit individual records
```

### Phase 4.4: The Delegation-Reclaim Cycle

The delegation-reclaim cycle can repeat multiple times:

```
Apex creates → Apex fills → Submits → Federation returns
    → Apex delegates to Coop → Coop edits
    → Apex reclaims → Apex finishes → Submits
    → Federation returns again
    → Apex delegates again → Coop fixes
    → Coop submits → Apex reviews → Forwards to Federation
```

Each delegation or reclaim is logged in the audit trail, so there's a full history of who handled the submission at each stage.

### Phase 4.5: The edited_by Lifecycle

```
Apex creates     → edited_by = Apex
Apex fills       → edited_by = Apex (unchanged)
Apex submits     → edited_by = NULL (submitted, no one editing)
Federation returns → edited_by = Apex (who needs to fix)
Apex delegates   → edited_by = NULL (cooperative picks it up)
Coop opens       → edited_by = Cooperative (first to open gets it)
Coop edits       → edited_by = Cooperative (unchanged)
Coop submits     → edited_by = NULL (submitted, no one editing)
Apex reclaims    → edited_by = Apex (ownership reclaimed)
Apex submits     → edited_by = NULL (submitted)
```

---

### Phase 5: Ministry Reviews (unchanged)

**Ministry approves:**
- status: InReview → Approved (terminal)
- KPIs computed, export generation triggered
- Both apex and cooperative see "Approved"

**Ministry rejects:**
- status: InReview → Rejected (terminal)
- Both apex and cooperative see "Rejected" with reason

---

## 5. Submission Ownership Rules

| Rule | Enforcement |
|------|------------|
| **One submission per cooperative per year** | Backend rejects `POST /submissions` if a submission already exists for that coop+year (any status except deleted). Returns 409 Conflict with details of existing submission. |
| **First creator owns the submission** | `submitted_by` + `created_by_role` columns track who created it. Only the owner (tracked by `edited_by`) can edit the draft. |
| **No duplicate creation** | If apex tries to create for a coop+year that already has a submission, error: "A submission already exists for {coop_name} — Year {year} (Status: {status}). [View Submission →]" |
| **Delete restriction** | Only the original creator can delete a draft. If apex created it, cooperative cannot delete it. |
| **Exclusive editor** | Only the user whose UUID is in `edited_by` can save changes to a draft. Others see read-only. |

---

## 6. Attribution & Badges

Every submission response includes:

```json
{
  "id": "...",
  "cooperative_id": "...",
  "created_by_role": "apex",
  "created_by_user_id": "uuid-of-apex-user",
  "created_by_name": "John Dlamini",
  "edited_by": "uuid-of-current-editor",
  "edited_by_name": "John Dlamini"
}
```

### Badge Display Rules

| Scenario | Badge shown | Can edit? |
|----------|------------|-----------|
| Apex created, apex filling | 🟡 "In progress — Created by **John Dlamini** (Apex)" | Apex only |
| Apex created, submitted | 🔵 "Submitted by **John Dlamini** (Apex)" | No one |
| Returned, apex fixing | 🟠 "Returned — **Apex editing**" | Apex only |
| Returned, delegated to coop | 🟢 "Returned — **Cooperative to fix**" | Cooperative only |
| Coop created (normal) | No badge (default behavior) | Cooperative only |

### Dashboard Panel

The dashboard shows a real-time awareness panel:

```
╔══════════════════════════════════════════════════════════╗
║  📋 Active Submissions                                  ║
╠══════════════════════════════════════════════════════════╣
║  SUB-2025-00042  │  Draft  │  🟡 Editing by John Dlamini ║
║  SUB-2025-00038  │  Draft  │  🟢 Editing by Mary Smith   ║
║  SUB-2025-00035  │  In Review  │  —                     ║
╚══════════════════════════════════════════════════════════╝
```

This gives everyone awareness of who's working on what, without any locking overhead.

---

## 7. Visibility Matrix

| Stage | Cooperative sees | Cooperative can do | Apex sees | Apex can do |
|-------|-----------------|-------------------|-----------|------------|
| Draft (apex filling) | "Draft — Created by Apex" | View only | "Draft — Editing" | Edit, Submit, Delete |
| Draft (coop filling) | "Draft — Editing" | Edit, Submit, Delete | "Draft — Created by Coop" | View only |
| Submitted | "Submitted" | View only | "Submitted" | View only |
| In Review (Federation) | "In Review" | View only | "In Review" | View only |
| Returned to Apex (apex-created) | "Returned to Apex" | View only | "Returned — Fix or Delegate" | Edit, Submit, Delegate, Reclaim |
| Returned to Apex (coop-created) | "Returned to Apex" | View only | "Returned" | Approve, Return |
| Delegated to Coop | "Returned — Please fix" | Edit, Submit | "Delegated to Coop" | View, Reclaim |
| Approved | "Approved" ✅ | Download export | "Approved" ✅ | Download export |
| Rejected | "Rejected" ❌ | View reason | "Rejected" ❌ | View reason |

---

## 8. Database Schema Changes

### 8.1 New Migration

```sql
-- Create enum type for created_by_role
CREATE TYPE submission_created_by_role AS ENUM ('cooperative', 'apex');

-- Add attribution and ownership columns to submissions
ALTER TABLE submissions
    ADD COLUMN created_by_role submission_created_by_role NOT NULL DEFAULT 'cooperative',
    ADD COLUMN created_by_user_id UUID NULL,
    ADD COLUMN created_by_name TEXT NULL,
    ADD COLUMN edited_by UUID NULL,
    ADD COLUMN edited_by_name TEXT NULL;

-- Index for dashboard queries
CREATE INDEX idx_submissions_edited_by
    ON submissions (edited_by)
    WHERE status = 'draft';

-- Index for "one submission per coop per year" lookup
CREATE INDEX idx_submissions_coop_year
    ON submissions (cooperative_id, reporting_year)
    WHERE deleted_at IS NULL;
```

### 8.2 Column Descriptions

| Column | Type | Purpose |
|--------|------|---------|
| `created_by_role` | ENUM | Who created this submission: `cooperative` or `apex` |
| `created_by_user_id` | UUID | UUID of the user who created it (for attribution) |
| `created_by_name` | TEXT | Display name of the creator (denormalized for read performance) |
| `edited_by` | UUID | UUID of the user who currently owns the draft (for exclusive editing) |
| `edited_by_name` | TEXT | Display name of the current editor (denormalized for read performance) |

### 8.3 What We're NOT Adding

| Column | Why not |
|--------|---------|
| `version` | No optimistic concurrency — exclusive editor model |
| `locked_by` | No pessimistic locks — ownership is implicit via `edited_by` |
| `locked_at` | No lock expiry — no timeout mechanism |
| `last_edited_by` | `edited_by` serves this purpose while draft is active; `submitted_by` tracks who submitted |
| `last_edited_at` | Not needed — submission timestamps (`created_at`, `updated_at`, `submitted_at`) are sufficient |

---

## 9. API Endpoints

### 9.1 New Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/v1/apex/submissions` | Create submission for a cooperative | apex |
| POST | `/api/v1/apex/submissions/{id}/delegate` | Delegate returned submission to cooperative | apex |
| POST | `/api/v1/apex/submissions/{id}/reclaim` | Reclaim delegated submission back to apex | apex |
| GET | `/api/v1/apex/submissions` | List submissions for all coops under this apex | apex |
| GET | `/api/v1/cooperative/submissions` | List submissions (including apex-created) | cooperative |

### 9.2 Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `PATCH /api/v1/submissions/{id}` | Add `edited_by` check — only owner can save |
| `POST /api/v1/submissions/{id}/submit` | Add `edited_by` check — only owner can submit. Clear `edited_by` on submit. |
| `POST /api/v1/submissions/{id}/return` | Set `edited_by` based on `current_tier` after return |
| `DELETE /api/v1/submissions/{id}` | Add `created_by_role` check — only original creator can delete |

---

## 10. Frontend Changes

### 10.1 New Components

| Component | Purpose |
|-----------|---------|
| `NewApexSubmissionModal` | Modal for apex to pick cooperative, year, method |
| `SubmissionAttributionBadge` | Badge showing creator info and edit status |
| `EditOwnershipIndicator` | Shows who currently owns the draft |
| `DelegationDialog` | Dialog for apex to delegate with optional comment |
| `ReclaimDialog` | Dialog for apex to reclaim a delegated submission |
| `ReadOnlyOverlay` | Visual overlay on submission detail when user doesn't have edit rights |

### 10.2 Modified Components

| Component | Change |
|-----------|--------|
| `SubmissionsPage` | Show apex-created submissions with attribution badges |
| `SubmissionDetailPage` | Add read-only mode for non-owners; show ownership indicator |
| `SubmissionDashboard` | Add active editing awareness panel |
| `NewSubmissionModal` | Only show for cooperative users (apex uses `NewApexSubmissionModal`) |

### 10.3 Edit Permission Logic

```typescript
const canEdit = (submission: Submission, user: UserProfile): boolean => {
  // Only the owner can edit drafts
  if (submission.status !== 'draft') return false;
  return submission.edited_by === user.sub;
};

const canDelete = (submission: Submission, user: UserProfile): boolean => {
  // Only the original creator can delete
  if (submission.status !== 'draft') return false;
  return submission.created_by_user_id === user.sub;
};

const canDelegate = (submission: Submission, user: UserProfile): boolean => {
  // Only apex can delegate, and only when status is Returned
  if (user.role !== 'apex') return false;
  return submission.status === 'returned' && submission.current_tier === 'apex';
};
```

---

## 11. Scenarios & Edge Cases

### Happy Path

1. Apex logs in → Submissions page → clicks "New Submission"
2. Picks cooperative from dropdown, picks year, picks method
3. Fills all data (upload PDF / manual entry / questionnaire)
4. All sections ready → clicks Submit
5. Submission goes to Federation tier → Federation reviews → approves → Ministry → Approved
6. Both apex and cooperative see "Approved"

### Federation Returns

1. Federation returns with comments → status: Returned, tier: Apex
2. Apex sees two options: **"Fix myself"** or **"Delegate to Cooperative"**
3. **If fix myself:** Apex edits, resubmits → back to Federation
4. **If delegate:** Submission moves to cooperative tier. Cooperative fixes, submits → back to Apex tier → Apex reviews → forwards to Federation

### Cooperative Already Has a Draft

1. Cooperative created draft for 2025
2. Apex tries to create another for same coop + year
3. Backend returns 409: "A submission already exists for {coop_name} — Year 2025 (Status: Draft)"
4. Apex can view the existing draft

### Apex Created Submission — Cooperative View

1. Apex creates submission for cooperative
2. Cooperative logs in → sees submission in list with badge: "Created by John Dlamini (Apex)"
3. Cooperative clicks → sees detail page in read-only mode
4. Cooperative cannot edit, submit, or delete — only view

### Delegation Flow

1. Federation returns submission to Apex
2. Apex clicks "Delegate to Cooperative"
3. DelegationDialog opens with optional comment field
4. Apex types: "Please update the members data and resubmit"
5. Backend transitions: status → Draft, current_tier → Cooperative, edited_by → cooperative
6. Cooperative sees: "Returned by Federation — Please fix and resubmit"
7. Cooperative edits, submits → goes back to Apex tier
8. Apex reviews → forwards to Federation

### Reclaim Flow

1. Apex delegated to cooperative
2. Apex realizes they can fix it themselves
3. Apex clicks "Reclaim"
4. Backend transitions: edited_by → apex
5. Cooperative sees: "Returned — Apex editing"
6. Apex fixes, submits → back to Federation

### Browser Crash / Session Loss

1. Owner is editing a draft
2. Browser crashes
3. Draft stays in "editing" state with `edited_by` still set
4. Owner reopens browser, logs in, navigates to submission
5. Backend checks: is `edited_by` the current user? Yes → allows editing
6. Owner continues where they left off

**Why this works:** The owner is the only person who would try to edit it. No one else is blocked because no one else can edit it anyway.

---

## 12. Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | DB migration + `created_by_role`, `edited_by` columns + new apex create endpoint | Backend small |
| **Phase 2** | Edit permission enforcement in all mutation endpoints (update, submit, delete) | Backend medium |
| **Phase 3** | Apex frontend — cooperative picker + create flow (`NewApexSubmissionModal`) | Frontend medium |
| **Phase 4** | Apex editing on drafts + delegation/reclaim UI | Frontend medium |
| **Phase 5** | Return flow adjustments + audit trail | Backend small |
| **Phase 6** | Cooperative visibility of apex-created subs + read-only mode | Frontend small |
| **Phase 7** | Testing + edge case coverage | Both |

---

## 13. Acceptance Criteria

- [ ] Apex can create a submission for any cooperative under their management
- [ ] Apex selects cooperative, reporting year, and submission method
- [ ] Created submission appears in both apex's and cooperative's submission lists
- [ ] Submission shows attribution badge with creator name and role
- [ ] Only the creator (or delegated user) can edit the draft
- [ ] Non-owners see read-only mode with clear "Created by" indicator
- [ ] Dashboard shows who is currently editing each draft
- [ ] One submission per cooperative per year is enforced (409 on duplicate)
- [ ] Apex submits directly to Federation (skips apex review)
- [ ] Federation returns allow apex to fix or delegate to cooperative
- [ ] Delegation transfers edit rights to the cooperative
- [ ] Apex can reclaim a delegated submission
- [ ] Cooperative can view but not edit apex-created drafts
- [ ] All new endpoints have `#[utoipa::path]` annotations for OpenAPI
- [ ] All new endpoints have scope enforcement (apex can only manage their own cooperatives)

---

## 14. Out of Scope (Future)

- Real-time WebSocket updates for dashboard awareness
- Email notifications for delegation
- Ministry/federation creating submissions on behalf of cooperatives
- Concurrent editing with merge capabilities
- Automatic reassignment of ownership based on workload
