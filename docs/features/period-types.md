# Design Document: Dynamic Financial Submission Period Types

> **Source:** Issue #95 - Add other different financial submission type
> **Priority:** High
> **Status:** Design Phase

---

## 1. Problem Statement

**Current State:**
- All cooperatives must enter 12 months of financial data regardless of their actual reporting frequency
- No flexibility for annual audits, quarterly reviews, or monthly tracking
- One-size-fits-all approach doesn't match real-world cooperative compliance cycles

**Desired State:**
- Cooperatives can choose their reporting period type (YEARLY/QUARTERLY/MONTHLY)
- Dynamic UI adapts to the selected period type
- Each submission represents one reporting period
- No duplicate submissions for the same period

---

## 2. Period Type Definitions

| Period Type | Period Value | Columns in Grid | Use Case |
|-------------|--------------|-----------------|----------|
| **YEARLY** | `2026` | 1 (Year total) | Annual audits only |
| **QUARTERLY** | `Q1`, `Q2`, `Q3`, `Q4` | 4 (Quarter totals) | Quarterly reviews |
| **MONTHLY** | `01`-`12` | 12 (Monthly values) | Full monthly tracking |

---

## 3. UX Flow (Mermaid Diagram)

```mermaid
flowchart TD
    subgraph SUBMISSION_CREATION["Submission Creation Flow"]
        A([Coop clicks "New Submission"]) --> B{Select Period Type}
        B -->|YEARLY| C1[Select Year<br/>e.g., 2026]
        B -->|QUARTERLY| C2[Select Year + Quarter<br/>e.g., 2026, Q1]
        B -->|MONTHLY| C3[Select Year + Month<br/>e.g., 2026, August]
        
        C1 --> D1{Already Submitted?}
        C2 --> D2{Already Submitted?}
        C3 --> D3{Already Submitted?}
        
        D1 -->|Yes| E1[Show Error:<br/>"Already submitted"]
        D1 -->|No| F1[Create Submission<br/>YEARLY - 2026]
        D2 -->|Yes| E2[Show Error:<br/>"Already submitted"]
        D2 -->|No| F2[Create Submission<br/>QUARTERLY - Q1 2026]
        D3 -->|Yes| E3[Show Error:<br/>"Already submitted"]
        D3 -->|No| F3[Create Submission<br/>MONTHLY - Aug 2026]
    end

    subgraph DATA_ENTRY["Financial Data Entry"]
        F1 --> G1[1-Column Grid<br/>Year Total]
        F2 --> G2[4-Column Grid<br/>Q1 | Q2 | Q3 | Q4]
        F3 --> G3[12-Column Grid<br/>Jan | Feb | ... | Dec]
    end

    subgraph SUBMISSION_LIST["Submission List View"]
        H1[Badge: YEARLY - 2026]
        H2[Badge: QUARTERLY - Q2 2026]
        H3[Badge: MONTHLY - Aug 2026]
    end
```

---

## 4. UI Mockups & Wireframes

### 4.1 Submission Creation Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Create New Submission                              [X]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Reporting Period Type *                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   YEARLY    │ │  QUARTERLY  │ │   MONTHLY   │           │
│  │     ○       │ │     ●       │ │     ○       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Reporting Year *                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  2026                                              ▼ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Quarter * (only shown for QUARTERLY)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │   Q1    │ │   Q2    │ │   Q3    │ │   Q4    │           │
│  │   ●     │ │   ○     │ │   ○     │ │   ○     │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                             │
│  Month * (only shown for MONTHLY)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  August 2026                                       ▼ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ Note: You can only submit once per period               │
│                                                             │
│              [Cancel]              [Create Submission]      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Financial Data Entry Grid - YEARLY

```
┌─────────────────────────────────────────────────────────────┐
│  Financial Statement - YEARLY 2026                    [Save]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ASSETS                                                     │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Account Code │ Account Name      │ 2026 (Year)      │   │
│  ├──────────────┼───────────────────┼──────────────────┤   │
│  │ 1101         │ Cash & Bank       │ [__________]      │   │
│  │ 1102         │ Short-term Invest │ [__________]      │   │
│  │ 1103         │ Loans Receivable  │ [__________]      │   │
│  │ ...          │ ...              │ ...              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  LIABILITIES                                                │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 2101         │ Member Deposits  │ [__________]       │   │
│  │ ...          │ ...             │ ...                │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Financial Data Entry Grid - QUARTERLY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Financial Statement - QUARTERLY 2026                                  [Save]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ASSETS                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Account Code │ Account Name      │   Q1    │   Q2    │   Q3    │  Q4  │   │
│  ├──────────────┼───────────────────┼─────────┼─────────┼─────────┼──────┤   │
│  │ 1101         │ Cash & Bank       │ [_____] │ [_____] │ [_____] │[___] │   │
│  │ 1102         │ Short-term Invest │ [_____] │ [_____] │ [_____] │[___] │   │
│  │ 1103         │ Loans Receivable  │ [_____] │ [_____] │ [_____] │[___] │   │
│  │ ...          │ ...               │   ...   │   ...   │   ...   │ ...  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LIABILITIES                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 2101         │ Member Deposits  │ [_____] │ [_____] │ [_____] │[___] │   │
│  │ ...          │ ...             │   ...   │   ...   │   ...   │ ...  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Financial Data Entry Grid - MONTHLY (Current)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  Financial Statement - MONTHLY August 2026                                              [Save]│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ASSETS                                                                                     │
│  ┌────────────┬────────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐   │
│  │ Account    │ Account Name   │ Jan  │ Feb  │ Mar  │ Apr  │ May  │ Jun  │ Jul  │ Aug  │ Sep  │ Oct  │ Nov  │ Dec  │   │
│  ├────────────┼────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤   │
│  │ 1101       │ Cash & Bank    │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │   │
│  │ 1102       │ Short-term Inv │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │[___] │   │
│  │ ...        │ ...            │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │   │
│  └────────────┴────────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Submission List with Period Badges

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  My Submissions                                                      [+ New Submission]     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  Filters: [Period Type ▼] [Year ▼] [Status ▼]                                               │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ Status   │ Period              │ Year  │ Submitted    │ Actions                      │   │
│  ├──────────┼────────────────────┼───────┼──────────────┼───────────────────────────────┤   │
│  │ ● Draft  │ 🟡 QUARTERLY        │ 2026  │ Aug 15, 2026 │ [Edit] [Delete]              │   │
│  │ ✓ Submit │ 🟢 QUARTERLY        │ 2026  │ Aug 20, 2026 │ [View]                       │   │
│  │ ✓ Submit │ 🔵 YEARLY           │ 2025  │ Dec 31, 2025 │ [View]                       │   │
│  │ ✓ Submit │ 🔵 YEARLY           │ 2024  │ Dec 31, 2024 │ [View]                       │   │
│  │ ✓ Submit │ 🟣 MONTHLY          │ 2026  │ Aug 5, 2026  │ [View]                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  Legend: 🟡 Quarterly | 🔵 Yearly | 🟣 Monthly                                              │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema Changes

### 5.1 New Enum

```sql
CREATE TYPE period_type AS ENUM ('YEARLY', 'QUARTERLY', 'MONTHLY');
```

### 5.2 Updated Submissions Table

```sql
ALTER TABLE submissions
ADD COLUMN period_type period_type NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN period_value VARCHAR(10) NOT NULL DEFAULT '01';

-- Unique constraint: No duplicate submissions per cooperative per period
CREATE UNIQUE INDEX idx_unique_submission_period 
ON submissions (cooperative_id, period_type, reporting_year, period_value);
```

### 5.3 Migration Strategy

```sql
-- Migration 1: Add columns with defaults
ALTER TABLE submissions 
ADD COLUMN period_type period_type NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN period_value VARCHAR(10) NOT NULL DEFAULT '01';

-- Migration 2: Backfill existing submissions
UPDATE submissions 
SET 
    period_type = 'MONTHLY',
    period_value = '01'  -- Will be updated with actual month from line items
WHERE period_type IS NULL;

-- Migration 3: Add unique constraint (after backfill)
CREATE UNIQUE INDEX idx_unique_submission_period 
ON submissions (cooperative_id, period_type, reporting_year, period_value);
```

---

## 6. Backend Changes

### 6.1 DTO Changes

```rust
// CreateSubmissionRequest - add period fields
pub struct CreateSubmissionRequest {
    pub reporting_year: i32,
    pub period_type: PeriodType,           // NEW
    pub period_value: String,             // NEW: "01", "Q1", "2026"
    pub submission_method: SubmissionMethod,
}

// SubmissionResponse - add period fields
pub struct SubmissionResponse {
    pub id: Uuid,
    pub reporting_year: i32,
    pub period_type: PeriodType,          // NEW
    pub period_value: String,             // NEW
    pub status: SubmissionStatus,
    // ... existing fields
}
```

### 6.2 Validation Rules

```rust
impl CreateSubmissionRequest {
    pub fn validate(&self) -> AppResult<()> {
        match self.period_type {
            PeriodType::YEARLY => {
                // period_value should be a valid year (e.g., "2026")
                let year: i32 = self.period_value.parse()
                    .map_err(|| AppError::ValidationError("Invalid year".into()))?;
                if year < 2000 || year > 2100 {
                    return Err(AppError::ValidationError("Year out of range".into()));
                }
            }
            PeriodType::QUARTERLY => {
                // period_value should be Q1, Q2, Q3, or Q4
                if !["Q1", "Q2", "Q3", "Q4"].contains(&self.period_value.as_str()) {
                    return Err(AppError::ValidationError(
                        "Quarter must be Q1, Q2, Q3, or Q4".into()
                    ));
                }
            }
            PeriodType::MONTHLY => {
                // period_value should be 01-12
                let month: u32 = self.period_value.parse()
                    .map_err(|| AppError::ValidationError("Invalid month".into()))?;
                if month < 1 || month > 12 {
                    return Err(AppError::ValidationError(
                        "Month must be between 01 and 12".into()
                    ));
                }
            }
        }
        Ok(())
    }
}
```

### 6.3 Duplicate Check

```rust
pub async fn create_submission(
    // ...
) -> AppResult<impl IntoResponse> {
    // Check for duplicate submission
    let existing = state.submission_repo
        .find_by_cooperative_and_period(
            coop_id,
            period_type,
            reporting_year,
            period_value,
        )
        .await?;
    
    if existing.is_some() {
        return Err(AppError::Conflict(
            format!("Submission already exists for {} - {} - {}", 
                period_type, reporting_year, period_value)
        ));
    }
    // ... rest of handler
}
```

---

## 7. Frontend Changes

### 7.1 TypeScript Types

```typescript
type PeriodType = "YEARLY" | "QUARTERLY" | "MONTHLY";

interface CreateSubmissionRequest {
  reporting_year: number;
  period_type: PeriodType;
  period_value: string;
  submission_method: "upload" | "manual" | "questionnaire";
}

interface SubmissionResponse {
  id: string;
  reporting_year: number;
  period_type: PeriodType;
  period_value: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  // ...
}
```

### 7.2 Submission Creation Component

```typescript
// useSubmissionForm.ts
const useSubmissionForm = () => {
  const [periodType, setPeriodType] = useState<PeriodType>("YEARLY");
  const [reportingYear, setReportingYear] = useState(new Date().getFullYear());
  const [periodValue, setPeriodValue] = useState<string>("");

  const periodOptions = useMemo(() => {
    switch (periodType) {
      case "YEARLY":
        return [reportingYear.toString()];
      case "QUARTERLY":
        return ["Q1", "Q2", "Q3", "Q4"];
      case "MONTHLY":
        return [
          "01", "02", "03", "04", "05", "06",
          "07", "08", "09", "10", "11", "12"
        ];
    }
  }, [periodType, reportingYear]);

  // ...
};
```

### 7.3 Dynamic Grid Component

```typescript
interface FinancialGridProps {
  periodType: PeriodType;
  periodValue: string;
  data: Record<number, Record<number, number>>;
  onChange: (code: number, periodNum: number, value: number) => void;
}

const FinancialGrid: React.FC<FinancialGridProps> = ({ periodType, ... }) => {
  const columns = useMemo(() => {
    switch (periodType) {
      case "YEARLY":
        return [{ key: 1, label: reportingYear.toString() }];
      case "QUARTERLY":
        return [
          { key: 1, label: "Q1" },
          { key: 2, label: "Q2" },
          { key: 3, label: "Q3" },
          { key: 4, label: "Q4" },
        ];
      case "MONTHLY":
        return [
          { key: 1, label: "Jan" },
          { key: 2, label: "Feb" },
          // ... 12 months
        ];
    }
  }, [periodType]);

  return (
    <table>
      <thead>
        <tr>
          <th>Account</th>
          {columns.map(col => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* ... rows */}
      </tbody>
    </table>
  );
};
```

### 7.4 Submission List with Badges

```typescript
const getPeriodBadge = (submission: SubmissionResponse) => {
  const colors = {
    YEARLY: "bg-blue-100 text-blue-800",
    QUARTERLY: "bg-yellow-100 text-yellow-800",
    MONTHLY: "bg-purple-100 text-purple-800",
  };

  const labels = {
    YEARLY: `YEARLY - ${submission.period_value}`,
    QUARTERLY: `QUARTERLY - ${submission.period_value} ${submission.reporting_year}`,
    MONTHLY: `MONTHLY - ${getMonthName(submission.period_value)} ${submission.reporting_year}`,
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[submission.period_type]}`}>
      {labels[submission.period_type]}
    </span>
  );
};
```

---

## 8. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/cooperative/submissions` | Create submission with period type |
| GET | `/api/v1/cooperative/submissions` | List submissions (filter by period) |
| GET | `/api/v1/cooperative/submissions/{id}` | Get submission details |
| PATCH | `/api/v1/cooperative/submissions/{id}` | Update submission |

### Query Parameters for Filtering

```
GET /api/v1/cooperative/submissions?period_type=YEARLY&reporting_year=2026
GET /api/v1/cooperative/submissions?period_type=QUARTERLY&reporting_year=2026&period_value=Q2
```

---

## 9. Acceptance Criteria Checklist

- [ ] Cooperatives can select YEARLY, QUARTERLY, or MONTHLY period type
- [ ] Form validation dynamically changes based on selected period type
- [ ] Invalid period values are rejected (e.g., Q5, month 13)
- [ ] Database prevents duplicate submissions for same period combination
- [ ] Financial grid shows correct number of columns (1/4/12)
- [ ] Submission list displays period badges with correct colors
- [ ] Filters work on submission list (period type, year, period value)
- [ ] Existing submissions remain accessible after migration
- [ ] API consumers are not unexpectedly broken

---

## 10. Implementation Phases

### Phase 1: Backend Foundation
1. Add `period_type` enum to database
2. Add `period_value` column to submissions table
3. Create migration with backfill
4. Update DTOs and validation
5. Add unique constraint check

### Phase 2: Frontend Foundation
1. Regenerate OpenAPI client
2. Update submission types
3. Create period type selector component
4. Update submission creation form

### Phase 3: Dynamic Grid
1. Update FinancialExcelGrid for dynamic columns
2. Handle YEARLY (1 column), QUARTERLY (4 columns), MONTHLY (12 columns)

### Phase 4: Submission Management
1. Update submission list with period badges
2. Add filters for period type, year, period value
3. Add duplicate check on creation

### Phase 5: Testing & Polish
1. Test all period type combinations
2. Verify duplicate prevention
3. Test migration with existing data