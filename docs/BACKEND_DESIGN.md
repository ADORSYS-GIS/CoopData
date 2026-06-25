# CoopData Backend Architecture & Database Schema Design

> **Document Version**: 1.0  
> **Date**: 2026-06-22  
> **Status**: Design Phase  
> **Project**: Nexus Coop Insight — Eswatini National Cooperative Management Platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack Decisions](#3-technology-stack-decisions)
4. [API Design](#4-api-design)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Database Schema](#6-database-schema)
7. [Data Flow & Processing](#7-data-flow--processing)
8. [Migration Strategy](#8-migration-strategy)
9. [Security Considerations](#9-security-considerations)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Decision Log & Reasoning](#11-decision-log--reasoning)

---

## 1. Executive Summary

CoopData is a national cooperative management platform for Eswatini's Ministry of Commerce, Industry & Trade (MCIT) and DGRV. The frontend is built with TanStack Start (React + Vite + Nitro) and currently operates entirely on client-side mock data. This document designs the backend API and database schema to replace mock data with a persistent, multi-tenant, role-based system.

**Key Requirements**:

- 4 user roles: Ministry, Federation, Cooperative Manager, Regional Officer
- Financial data collection following the ADORSYS Chart of Accounts (1000–6999)
- 50+ KPI calculations (financial, membership, savings, loan, fixed deposit)
- Compliance scoring with weighted components
- Benchmarking across regions, sectors, and national averages
- Submission workflow (draft → submitted → validated → approved)
- Report generation (CSV, PDF, Excel)

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (TanStack Start)                  │
│  React 19 · TanStack Router · shadcn/ui · Recharts           │
│  TanStack Query for server state · Zod for client validation  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Hono on Nitro)                  │
│  Auth middleware · Role guards · Request validation           │
│  TanStack Start server functions (createServerFn)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
┌──────────────────┐ ┌──────────┐ ┌──────────────────┐
│   PostgreSQL      │ │  Redis    │ │  Object Storage  │
│   (Primary DB)   │ │ (Cache)  │ │  (Reports/Docs)  │
└──────────────────┘ └──────────┘ └──────────────────┘
```

### 2.2 Why This Architecture

**Reasoning**: The frontend already uses TanStack Start with Nitro as the server runtime. Rather than introducing a separate backend service (which would require CORS, separate deployment, and API gateway management), we extend the existing Nitro server with Hono-based API routes. This gives us:

1. **Type safety end-to-end** — shared TypeScript types between client and server
2. **Zero CORS issues** — same origin
3. **Simplified deployment** — single deployable unit
4. **Server functions** — TanStack Start's `createServerFn` pattern for type-safe RPC
5. **Nitro's built-in database support** — native PostgreSQL driver support

---

## 3. Technology Stack Decisions

| Layer             | Technology               | Reasoning                                                                                                                                                                                            |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Framework** | Hono (on Nitro)          | Lightweight, type-safe, works with TanStack Start's Nitro runtime. Hono provides middleware, validation, and OpenAPI spec generation.                                                                |
| **Database**      | PostgreSQL 16            | ACID compliance for financial data, JSONB for flexible metadata, excellent support for complex queries (window functions, CTEs for KPI calculations), row-level security for multi-tenant isolation. |
| **ORM**           | Drizzle ORM              | TypeScript-first, lightweight, excellent migration support, SQL-like query builder, works natively with Nitro. Better type inference than Prisma for our use case.                                   |
| **Validation**    | Zod (shared)             | Already in the project's dependencies. Shared schemas between client and server eliminate duplication.                                                                                               |
| **Auth**          | Better Auth              | Modern, framework-agnostic, supports multi-tenant roles, session management, and works with Hono middleware. Lighter than Auth.js for our 4-role system.                                             |
| **Cache**         | Redis (via Nitro)        | Session storage, KPI result caching (computed financial ratios are expensive), rate limiting.                                                                                                        |
| **File Storage**  | S3-compatible (MinIO/R2) | Report PDFs, Excel exports, uploaded documents.                                                                                                                                                      |
| **Migrations**    | Drizzle Kit              | Declarative schema definitions, automatic migration generation, supports seeding.                                                                                                                    |

### 3.1 Why Not Alternatives

| Alternative         | Why Rejected                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Express/Fastify** | Separate server needed; breaks TanStack Start's unified model                                                              |
| **Prisma**          | Heavier runtime, generated client adds bundle size, less control over complex SQL                                          |
| **Supabase**        | Vendor lock-in, less control over schema, RLS policies add complexity                                                      |
| **MongoDB**         | Financial data requires ACID transactions and relational integrity; document model doesn't fit Chart of Accounts structure |
| **tRPC**            | Good but Hono provides more middleware ecosystem and OpenAPI generation                                                    |

---

## 4. API Design

### 4.1 API Structure

All API routes are mounted under `/api/v1/` and use TanStack Start's `createServerFn` for type-safe client calls, with Hono routes for external/REST access.

```
/api/v1/
├── auth/
│   ├── POST   /login
│   ├── POST   /logout
│   ├── POST   /refresh
│   └── GET    /me
│
├── users/
│   ├── GET    /                    # Ministry only — list all users
│   ├── GET    /:id                 # Own profile or Ministry
│   ├── POST   /                    # Ministry only — create user
│   ├── PATCH  /:id                 # Own profile or Ministry
│   └── DELETE /:id                 # Ministry only
│
├── cooperatives/
│   ├── GET    /                    # List (scoped by role)
│   ├── GET    /:id                 # Detail (scoped by role)
│   ├── POST   /                    # Ministry/Regional Officer
│   ├── PATCH  /:id                 # Ministry/Cooperative Manager (own)
│   └── GET    /:id/kpis            # Computed KPIs for a cooperative
│
├── submissions/
│   ├── GET    /                    # List (scoped by role)
│   ├── GET    /:id                 # Detail
│   ├── POST   /                    # Create new submission
│   ├── PATCH  /:id                 # Update draft
│   ├── POST   /:id/submit         # Submit for validation
│   ├── POST   /:id/validate       # Federation/Ministry validate
│   └── POST   /:id/reject         # Reject with reason
│
├── financial-statements/
│   ├── GET    /:coopId/latest      # Latest balance sheet
│   ├── GET    /:coopId/history    # Historical balance sheets
│   ├── POST   /                    # Create (linked to submission)
│   └── PUT    /:id                 # Update draft
│
├── members/
│   ├── GET    /:coopId             # List members of cooperative
│   ├── POST   /:coopId            # Add member
│   ├── PATCH  /:memberId          # Update member
│   └── DELETE /:memberId          # Soft delete (mark exited)
│
├── savings-accounts/
│   ├── GET    /:coopId             # List savings accounts
│   ├── POST   /                    # Create
│   └── PATCH  /:id                 # Update
│
├── loans/
│   ├── GET    /:coopId             # List loans
│   ├── POST   /                    # Create
│   └── PATCH  /:id                 # Update
│
├── fixed-deposits/
│   ├── GET    /:coopId             # List fixed deposits
│   ├── POST   /                    # Create
│   └── PATCH  /:id                 # Update
│
├── kpis/
│   ├── GET    /:coopId/financial          # Financial KPIs
│   ├── GET    /:coopId/membership         # Membership KPIs
│   ├── GET    /:coopId/savings            # Savings KPIs
│   ├── GET    /:coopId/loans              # Loan KPIs
│   ├── GET    /:coopId/fixed-deposits     # Fixed deposit KPIs
│   └── GET    /:coopId/compliance         # Compliance score
│
├── benchmarks/
│   ├── GET    /regional/:region    # Regional averages
│   ├── GET    /sector/:sector      # Sector averages
│   └── GET    /national           # National averages
│
├── reports/
│   ├── POST   /generate            # Generate report (async)
│   ├── GET    /:id                 # Download report
│   └── GET    /list/:coopId        # List reports for cooperative
│
└── dashboard/
    ├── GET    /summary             # National summary (Ministry)
    ├── GET    /regional/:region    # Regional summary (Federation)
    └── GET    /cooperative/:id     # Cooperative summary (Manager)
```

### 4.2 Role-Based Access Matrix

| Endpoint                          | Ministry | Federation | Cooperative | Regional Officer |
| --------------------------------- | -------- | ---------- | ----------- | ---------------- |
| `GET /users`                      | ✅ All   | ❌         | ❌          | ❌               |
| `GET /cooperatives`               | ✅ All   | ✅ Region  | ✅ Own      | ✅ Assigned      |
| `POST /cooperatives`              | ✅       | ❌         | ❌          | ✅               |
| `GET /submissions`                | ✅ All   | ✅ Region  | ✅ Own      | ✅ Assigned      |
| `POST /submissions`               | ✅       | ❌         | ✅ Own      | ✅               |
| `POST /:id/validate`              | ✅       | ✅ Region  | ❌          | ❌               |
| `GET /kpis`                       | ✅ All   | ✅ Region  | ✅ Own      | ✅ Assigned      |
| `GET /dashboard/summary`          | ✅       | ❌         | ❌          | ❌               |
| `GET /dashboard/regional/:region` | ✅       | ✅ Own     | ❌          | ❌               |

### 4.3 Server Function Pattern

Using TanStack Start's `createServerFn` for type-safe client calls:

```typescript
// src/lib/api/financial-statements.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../db";
import { balanceSheets } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const getLatestBalanceSheet = createServerFn({ method: "GET" })
  .validator(z.object({ cooperativeId: z.string() }))
  .handler(async ({ data }) => {
    const result = await db
      .select()
      .from(balanceSheets)
      .where(eq(balanceSheets.cooperativeId, data.cooperativeId))
      .orderBy(desc(balanceSheets.reportingPeriod))
      .limit(1);
    return result[0] ?? null;
  });
```

---

## 5. Authentication & Authorization

### 5.1 Auth Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Login Form  │────▶│  Better Auth      │────▶│  PostgreSQL  │
│  (Client)    │     │  (Session Mgmt)   │     │  (Users +    │
│              │◀────│  + JWT + Refresh  │◀────│   Sessions)  │
└──────────────┘     └──────────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Role Guard   │
                     │  Middleware   │
                     │  (Hono)      │
                     └──────────────┘
```

### 5.2 User Model

```typescript
interface AuthUser {
  id: string; // UUID
  email: string; // Unique
  passwordHash: string; // bcrypt
  name: string;
  role: "ministry" | "federation" | "cooperative" | "regional_officer";
  region: "Hhohho" | "Manzini" | "Shiselweni" | "Lubombo" | "National";
  cooperativeId: string | null; // Set for cooperative managers
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.3 Session Management

- **Access tokens**: JWT, 15-minute expiry
- **Refresh tokens**: Stored in httpOnly cookie, 7-day expiry
- **Session storage**: Redis (fast lookup, auto-expiry)
- **Role enforcement**: Middleware on every request, role extracted from JWT claims

### 5.4 Multi-Tenancy Strategy

**Row-Level Security via application-level filtering**:

- Every query includes a `WHERE` clause that scopes data to the user's role:
  - **Ministry**: No filter (sees all)
  - **Federation**: `WHERE cooperative.region = user.region`
  - **Cooperative**: `WHERE cooperative.id = user.cooperativeId`
  - **Regional Officer**: `WHERE cooperative.id IN (assigned_cooperatives)`

We use application-level filtering rather than PostgreSQL RLS because:

1. Simpler to debug and test
2. Works with Drizzle ORM's query builder
3. Role logic is complex (Federation sees region, not just own coop)
4. Easier to extend with new roles

---

## 6. Database Schema

### 6.1 Entity-Relationship Overview

```
users ─────────────────┐
  │                     │
  │ (cooperativeId)     │ (submittedBy)
  │                     │
  ▼                     ▼
cooperatives ◄────── submissions ──────────► financial_statements
  │                     │                          │
  │                     │                          │
  │                     │                          ▼
  │                     │               balance_sheet_line_items
  │                     │
  ├──── members         │
  ├──── savings_accounts│
  ├──── loans           │
  ├──── fixed_deposits  │
  │                     │
  ▼                     ▼
regions            compliance_scores
  │                     │
  └──── benchmark_data │
                        │
                        ▼
                  audit_logs
```

### 6.2 Complete Schema (Drizzle ORM Definitions)

```typescript
// src/lib/db/schema.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  date,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const roleEnum = pgEnum("role", [
  "ministry",
  "federation",
  "cooperative",
  "regional_officer",
]);

export const regionEnum = pgEnum("region", [
  "Hhohho",
  "Manzini",
  "Shiselweni",
  "Lubombo",
  "National",
]);

export const sectorEnum = pgEnum("sector", [
  "Agriculture",
  "Finance",
  "Housing",
  "Transport",
  "Manufacturing",
  "Services",
  "Other",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "submitted",
  "under_review",
  "validated",
  "rejected",
  "resubmit",
]);

export const memberStatusEnum = pgEnum("member_status", ["Active", "Dormant", "Exited"]);

export const genderEnum = pgEnum("gender", ["Male", "Female", "Other"]);

export const ageGroupEnum = pgEnum("age_group", ["<18", "18-35", "36-50", "50+"]);

export const urbanRuralEnum = pgEnum("urban_rural", ["Urban", "Rural"]);

export const accountTypeEnum = pgEnum("account_type", ["Voluntary", "Mandatory", "Fixed"]);

export const loanStatusEnum = pgEnum("loan_status", [
  "Performing",
  "Arrears",
  "Restructured",
  "Written Off",
]);

export const repaymentRegularityEnum = pgEnum("repayment_regularity", [
  "Regular",
  "Irregular",
  "Default",
]);

export const daysPastDueCategoryEnum = pgEnum("days_past_due_category", [
  "0",
  "1-30",
  "31-60",
  "61-90",
  "91+",
]);

export const depositTypeEnum = pgEnum("deposit_type", ["Short-term", "Medium-term", "Long-term"]);

export const tenureCategoryEnum = pgEnum("tenure_category", [
  "<3m",
  "3-6m",
  "6-12m",
  "1-3y",
  ">3y",
]);

export const fdStatusEnum = pgEnum("fd_status", ["Active", "Matured", "Withdrawn", "Rolled Over"]);

export const contributionFrequencyEnum = pgEnum("contribution_frequency", [
  "Weekly",
  "Monthly",
  "Quarterly",
  "Irregular",
]);

export const balanceTrendEnum = pgEnum("balance_trend", ["Increasing", "Stable", "Decreasing"]);

export const withdrawalFrequencyEnum = pgEnum("withdrawal_frequency", ["Low", "Medium", "High"]);

export const complianceStatusEnum = pgEnum("compliance_status", ["green", "amber", "red"]);

export const cooperativeStatusEnum = pgEnum("cooperative_status", [
  "Active",
  "Inactive",
  "Suspended",
]);

export const complianceVerificationEnum = pgEnum("compliance_verification", [
  "Verified",
  "Pending",
  "Non-Compliant",
  "Under Review",
]);

export const accountingYearEnum = pgEnum("accounting_year", ["calendar", "fiscal"]);

export const currencyEnum = pgEnum("currency", ["SZL", "USD"]);

export const reportFormatEnum = pgEnum("report_format", ["PDF", "CSV", "XLSX"]);

export const reportCategoryEnum = pgEnum("report_category", [
  "National",
  "Regional",
  "Sector",
  "Financial",
  "Compliance",
  "Gender",
]);

// ============================================================================
// CORE TABLES
// ============================================================================

// --- REGIONS (Reference) ---
export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 2 }).notNull().unique(), // HH, MN, SH, LB
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- USERS ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: roleEnum("role").notNull(),
  region: regionEnum("region").notNull().default("National"),
  cooperativeId: uuid("cooperative_id"), // FK set for cooperative managers
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- COOPERATIVES ---
export const cooperatives = pgTable("cooperatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  regNo: varchar("reg_no", { length: 20 }).notNull().unique(), // e.g. COP-2018-04921
  name: varchar("name", { length: 255 }).notNull(),
  sector: sectorEnum("sector").notNull(),
  region: regionEnum("region").notNull(),
  memberCount: integer("member_count").notNull().default(0),
  portfolio: numeric("portfolio", { precision: 15, scale: 2 }).notNull().default("0"),
  compliance: complianceVerificationEnum("compliance").notNull().default("Pending"),
  status: cooperativeStatusEnum("status").notNull().default("Active"),
  registeredOn: date("registered_on").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- SUBMISSIONS ---
export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: varchar("reference", { length: 20 }).notNull().unique(), // SUB-2025-09082
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  type: varchar("type", { length: 100 }).notNull(), // "Q3 Financial Audit", "Membership Roster Update", etc.
  submittedBy: uuid("submitted_by")
    .notNull()
    .references(() => users.id),
  submittedOn: timestamp("submitted_on", { withTimezone: true }).defaultNow().notNull(),
  status: submissionStatusEnum("status").notNull().default("draft"),
  priority: varchar("priority", { length: 20 }).notNull().default("Routine"), // Routine, Quarterly, Annual, Urgent
  reviewedBy: uuid("reviewed_by"), // FK to users (validator)
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// FINANCIAL DATA TABLES
// ============================================================================

// --- FINANCIAL STATEMENTS (Header) ---
export const financialStatements = pgTable("financial_statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => submissions.id),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  reportingPeriod: varchar("reporting_period", { length: 7 }).notNull(), // "2024-12"
  submissionDate: date("submission_date").notNull(),
  currency: currencyEnum("currency").notNull().default("SZL"),
  accountingYear: accountingYearEnum("accounting_year").notNull().default("calendar"),
  isValidated: boolean("is_validated").notNull().default(false),
  validationErrors: jsonb("validation_errors").$type<ValidationError[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- BALANCE SHEET LINE ITEMS ---
// Each row is one account code value, enabling flexible chart of accounts
export const balanceSheetLineItems = pgTable("balance_sheet_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  financialStatementId: uuid("financial_statement_id")
    .notNull()
    .references(() => financialStatements.id),
  accountCode: integer("account_code").notNull(), // e.g. 1101, 1201, 2101
  accountName: varchar("account_name", { length: 255 }).notNull(), // e.g. "Cash on Hand"
  accountCategory: varchar("account_category", { length: 50 }).notNull(), // "assets", "liabilities", "equity", "income", "expenses"
  accountSubcategory: varchar("account_subcategory", { length: 100 }).notNull(), // "liquid_assets", "loan_portfolio", etc.
  value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- INDEX for fast lookups ---
// CREATE INDEX idx_bsli_statement_category ON balance_sheet_line_items(financial_statement_id, account_category);
// CREATE INDEX idx_bsli_code ON balance_sheet_line_items(account_code);

// ============================================================================
// NON-FINANCIAL DATA TABLES
// ============================================================================

// --- MEMBERS ---
export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  memberId: varchar("member_id", { length: 20 }).notNull(), // Display ID like "M001"
  joinDate: date("join_date").notNull(),
  status: memberStatusEnum("status").notNull().default("Active"),
  exitDate: date("exit_date"),
  gender: genderEnum("gender").notNull(),
  ageGroup: ageGroupEnum("age_group").notNull(),
  region: regionEnum("region").notNull(),
  urbanRural: urbanRuralEnum("urban_rural").notNull(),
  agmAttendance: boolean("agm_attendance").notNull().default(false),
  leadershipRole: varchar("leadership_role", { length: 100 }),
  votingExercised: boolean("voting_exercised").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- SAVINGS ACCOUNTS ---
export const savingsAccounts = pgTable("savings_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  savingsAccountId: varchar("savings_account_id", { length: 20 }).notNull(), // Display ID
  accountType: accountTypeEnum("account_type").notNull(),
  accountOpeningDate: date("account_opening_date").notNull(),
  accountStatus: varchar("account_status", { length: 20 }).notNull().default("Active"), // Active, Dormant, Closed
  contributionFrequency: contributionFrequencyEnum("contribution_frequency").notNull(),
  lastContributionDate: date("last_contribution_date").notNull(),
  numberOfContributions: integer("number_of_contributions").notNull().default(0),
  balanceTrend: balanceTrendEnum("balance_trend").notNull(),
  zeroBalanceFlag: boolean("zero_balance_flag").notNull().default(false),
  withdrawalFrequencyCategory: withdrawalFrequencyEnum("withdrawal_frequency_category").notNull(),
  emergencyWithdrawalsFlag: boolean("emergency_withdrawals_flag").notNull().default(false),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- LOANS ---
export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  loanId: varchar("loan_id", { length: 20 }).notNull(), // Display ID
  loanProductType: varchar("loan_product_type", { length: 100 }).notNull(),
  loanStartDate: date("loan_start_date").notNull(),
  loanMaturityDate: date("loan_maturity_date").notNull(),
  loanStatus: loanStatusEnum("loan_status").notNull(),
  borrowerType: varchar("borrower_type", { length: 50 }).notNull(),
  youthBorrowerFlag: boolean("youth_borrower_flag").notNull().default(false),
  womenBorrowerFlag: boolean("women_borrower_flag").notNull().default(false),
  ruralBorrowerFlag: boolean("rural_borrower_flag").notNull().default(false),
  repaymentRegularity: repaymentRegularityEnum("repayment_regularity").notNull(),
  daysPastDueCategory: daysPastDueCategoryEnum("days_past_due_category").notNull().default("0"),
  missedInstallmentsCount: integer("missed_installments_count").notNull().default(0),
  restructuredLoanFlag: boolean("restructured_loan_flag").notNull().default(false),
  numberOfRestructurings: integer("number_of_restructurings").notNull().default(0),
  earlySettlementFlag: boolean("early_settlement_flag").notNull().default(false),
  multipleLoansFlag: boolean("multiple_loans_flag").notNull().default(false),
  largeBorrowerFlag: boolean("large_borrower_flag").notNull().default(false),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull(),
  loanAmount: numeric("loan_amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- FIXED DEPOSITS ---
export const fixedDeposits = pgTable("fixed_deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  fixedDepositId: varchar("fixed_deposit_id", { length: 20 }).notNull(), // Display ID
  depositType: depositTypeEnum("deposit_type").notNull(),
  startDate: date("start_date").notNull(),
  maturityDate: date("maturity_date").notNull(),
  status: fdStatusEnum("status").notNull(),
  tenureCategory: tenureCategoryEnum("tenure_category").notNull(),
  originalTenureSelected: varchar("original_tenure_selected", { length: 50 }).notNull(),
  earlyWithdrawalFlag: boolean("early_withdrawal_flag").notNull().default(false),
  rolloverAtMaturityFlag: boolean("rollover_at_maturity_flag").notNull().default(false),
  numberOfRenewals: integer("number_of_renewals").notNull().default(0),
  changeInTenureAtRenewal: boolean("change_in_tenure_at_renewal").notNull().default(false),
  singleDepositorDependencyFlag: boolean("single_depositor_dependency_flag")
    .notNull()
    .default(false),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// KPI & COMPLIANCE TABLES
// ============================================================================

// --- COMPUTED KPIs (Materialized for Performance) ---
export const computedKpis = pgTable("computed_kpis", {
  id: uuid("id").primaryKey().defaultRandom(),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  reportingPeriod: varchar("reporting_period", { length: 7 }).notNull(), // "2024-12"
  kpiCategory: varchar("kpi_category", { length: 50 }).notNull(), // "financial", "membership", "savings", "loans", "fixed_deposits"
  kpiName: varchar("kpi_name", { length: 100 }).notNull(), // e.g. "par30", "roa", "totalMembers"
  value: numeric("value", { precision: 15, scale: 4 }).notNull(),
  formatted: varchar("formatted", { length: 50 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(), // "percent", "currency", "ratio", "number"
  status: varchar("status", { length: 10 }), // "green", "amber", "red"
  benchmark: numeric("benchmark", { precision: 15, scale: 4 }),
  description: text("description"),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- COMPLIANCE SCORES ---
export const complianceScores = pgTable("compliance_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id),
  reportingPeriod: varchar("reporting_period", { length: 7 }).notNull(),
  overallScore: numeric("overall_score", { precision: 5, scale: 1 }).notNull(), // 0-100
  status: complianceStatusEnum("status").notNull(), // green, amber, red
  timelySubmissionScore: numeric("timely_submission_score", { precision: 5, scale: 1 }).notNull(), // 0-100
  dataQualityScore: numeric("data_quality_score", { precision: 5, scale: 1 }).notNull(), // 0-100
  financialRatiosScore: numeric("financial_ratios_score", { precision: 5, scale: 1 }).notNull(), // 0-100
  documentationScore: numeric("documentation_score", { precision: 5, scale: 1 }).notNull(), // 0-100
  summary: text("summary"),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- BENCHMARK DATA ---
export const benchmarkData = pgTable("benchmark_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  region: regionEnum("region"),
  sector: sectorEnum("sector"),
  kpiName: varchar("kpi_name", { length: 100 }).notNull(),
  reportingPeriod: varchar("reporting_period", { length: 7 }).notNull(),
  regionalAverage: numeric("regional_average", { precision: 15, scale: 4 }),
  sectorAverage: numeric("sector_average", { precision: 15, scale: 4 }),
  nationalAverage: numeric("national_average", { precision: 15, scale: 4 }),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// REPORTS & AUDIT
// ============================================================================

// --- REPORTS ---
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  cooperativeId: uuid("cooperative_id").references(() => cooperatives.id),
  title: varchar("title", { length: 255 }).notNull(),
  category: reportCategoryEnum("category").notNull(),
  format: reportFormatEnum("format").notNull(),
  filePath: text("file_path"), // S3/MinIO path
  fileSize: varchar("file_size", { length: 20 }), // "4.2 MB"
  generatedBy: uuid("generated_by")
    .notNull()
    .references(() => users.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- AUDIT LOG ---
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(), // "create", "update", "delete", "validate", "submit"
  entityType: varchar("entity_type", { length: 50 }).notNull(), // "submission", "cooperative", "member", etc.
  entityId: uuid("entity_id").notNull(),
  changes: jsonb("changes"), // Before/after diff
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- INTEGRATION LOGS ---
export const integrationLogs = pgTable("integration_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  integrationName: varchar("integration_name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(), // "Connected", "Degraded", "Idle", "Error"
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  recordsProcessed: varchar("records_processed", { length: 50 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [users.cooperativeId],
    references: [cooperatives.id],
  }),
  submissions: many(submissions),
  auditLogs: many(auditLogs),
  reports: many(reports),
}));

export const cooperativesRelations = relations(cooperatives, ({ many }) => ({
  submissions: many(submissions),
  members: many(members),
  savingsAccounts: many(savingsAccounts),
  loans: many(loans),
  fixedDeposits: many(fixedDeposits),
  financialStatements: many(financialStatements),
  computedKpis: many(computedKpis),
  complianceScores: many(complianceScores),
  reports: many(reports),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [submissions.cooperativeId],
    references: [cooperatives.id],
  }),
  submittedByUser: one(users, {
    fields: [submissions.submittedBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [submissions.reviewedBy],
    references: [users.id],
  }),
  financialStatement: one(financialStatements, {
    fields: [submissions.id],
    references: [financialStatements.submissionId],
  }),
}));

export const financialStatementsRelations = relations(financialStatements, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [financialStatements.submissionId],
    references: [submissions.id],
  }),
  cooperative: one(cooperatives, {
    fields: [financialStatements.cooperativeId],
    references: [cooperatives.id],
  }),
  lineItems: many(balanceSheetLineItems),
}));

export const balanceSheetLineItemsRelations = relations(balanceSheetLineItems, ({ one }) => ({
  financialStatement: one(financialStatements, {
    fields: [balanceSheetLineItems.financialStatementId],
    references: [financialStatements.id],
  }),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [members.cooperativeId],
    references: [cooperatives.id],
  }),
  savingsAccounts: many(savingsAccounts),
  loans: many(loans),
  fixedDeposits: many(fixedDeposits),
}));

export const savingsAccountsRelations = relations(savingsAccounts, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [savingsAccounts.cooperativeId],
    references: [cooperatives.id],
  }),
  member: one(members, {
    fields: [savingsAccounts.memberId],
    references: [members.id],
  }),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [loans.cooperativeId],
    references: [cooperatives.id],
  }),
  member: one(members, {
    fields: [loans.memberId],
    references: [members.id],
  }),
}));

export const fixedDepositsRelations = relations(fixedDeposits, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [fixedDeposits.cooperativeId],
    references: [cooperatives.id],
  }),
  member: one(members, {
    fields: [fixedDeposits.memberId],
    references: [members.id],
  }),
}));

export const computedKpisRelations = relations(computedKpis, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [computedKpis.cooperativeId],
    references: [cooperatives.id],
  }),
}));

export const complianceScoresRelations = relations(complianceScores, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [complianceScores.cooperativeId],
    references: [cooperatives.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [reports.cooperativeId],
    references: [cooperatives.id],
  }),
  generatedByUser: one(users, {
    fields: [reports.generatedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
```

### 6.3 Key Schema Design Decisions

#### Decision 1: EAV vs Normalized for Financial Data

**Chosen: Normalized with `balance_sheet_line_items` (semi-EAV)**

The Chart of Accounts has 41+ individual fields that map to account codes. Rather than creating a column per account code (which would require schema migrations for every new account code), we use a `balance_sheet_line_items` table with one row per account code per financial statement. This gives us:

- **Flexibility**: New account codes can be added without schema changes
- **Queryability**: Easy to aggregate by category or subcategory
- **Validation**: Account codes are constrained by the application layer
- **Performance**: Indexed lookups by `financial_statement_id` + `account_category`

The `financial_statements` table holds the header (cooperative, period, currency), while `balance_sheet_line_items` holds the individual values.

**Why not full EAV?** Full EAV would lose type safety. We use a hybrid: the header is fully normalized, and the line items use a structured EAV pattern with known account codes.

#### Decision 2: Numeric vs Integer for Monetary Values

**Chosen: `numeric(15, 2)`**

Financial data requires exact decimal precision. PostgreSQL's `numeric` type avoids floating-point rounding errors. 15 digits accommodates values up to 999,999,999,999,999.99 (trillions in SZL/USD), which is more than sufficient for Eswatini cooperative data.

#### Decision 3: UUID vs Auto-Increment IDs

**Chosen: UUID**

- Prevents enumeration attacks (can't guess other IDs)
- Enables client-side ID generation for offline-first patterns
- Works well with distributed systems
- PostgreSQL's `gen_random_uuid()` is efficient

#### Decision 4: Soft Deletes for Members

Members use a `status` enum ("Active", "Dormant", "Exited") rather than hard deletes. This preserves historical data needed for KPI calculations (exit rate, dormancy rate) and audit trails.

#### Decision 5: Computed KPIs as Materialized Table

Rather than computing KPIs on every request, we store computed results in `computed_kpis`. This is updated:

- On submission validation
- On scheduled batch computation (nightly)
- On-demand when data changes

This avoids expensive real-time calculations across multiple tables for dashboard views.

### 6.4 Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_cooperative ON users(cooperative_id);

CREATE INDEX idx_cooperatives_region ON cooperatives(region);
CREATE INDEX idx_cooperatives_sector ON cooperatives(sector);
CREATE INDEX idx_cooperatives_status ON cooperatives(status);
CREATE INDEX idx_cooperatives_compliance ON cooperatives(compliance);

CREATE INDEX idx_submissions_cooperative ON submissions(cooperative_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_submitted_by ON submissions(submitted_by);
CREATE INDEX idx_submissions_date ON submissions(submitted_on);

CREATE INDEX idx_financial_statements_cooperative ON financial_statements(cooperative_id);
CREATE INDEX idx_financial_statements_period ON financial_statements(reporting_period);
CREATE INDEX idx_financial_statements_coop_period ON financial_statements(cooperative_id, reporting_period);

CREATE INDEX idx_bsli_statement ON balance_sheet_line_items(financial_statement_id);
CREATE INDEX idx_bsli_category ON balance_sheet_line_items(account_category);
CREATE INDEX idx_bsli_code ON balance_sheet_line_items(account_code);
CREATE INDEX idx_bsli_statement_category ON balance_sheet_line_items(financial_statement_id, account_category);

CREATE INDEX idx_members_cooperative ON members(cooperative_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_cooperative_status ON members(cooperative_id, status);

CREATE INDEX idx_savings_cooperative ON savings_accounts(cooperative_id);
CREATE INDEX idx_savings_member ON savings_accounts(member_id);
CREATE INDEX idx_savings_status ON savings_accounts(account_status);

CREATE INDEX idx_loans_cooperative ON loans(cooperative_id);
CREATE INDEX idx_loans_member ON loans(member_id);
CREATE INDEX idx_loans_status ON loans(loan_status);
CREATE INDEX idx_loans_cooperative_status ON loans(cooperative_id, loan_status);

CREATE INDEX idx_fixed_deposits_cooperative ON fixed_deposits(cooperative_id);
CREATE INDEX idx_fixed_deposits_member ON fixed_deposits(member_id);

CREATE INDEX idx_computed_kpis_coop_period ON computed_kpis(cooperative_id, reporting_period);
CREATE INDEX idx_computed_kpis_category ON computed_kpis(kpi_category);
CREATE INDEX idx_computed_kpis_name ON computed_kpis(kpi_name);

CREATE INDEX idx_compliance_coop_period ON compliance_scores(cooperative_id, reporting_period);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);

CREATE INDEX idx_benchmark_region ON benchmark_data(region);
CREATE INDEX idx_benchmark_sector ON benchmark_data(sector);
CREATE INDEX idx_benchmark_kpi ON benchmark_data(kpi_name);
```

---

## 7. Data Flow & Processing

### 7.1 Submission Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐
│  Draft   │───▶│ Submitted │───▶│ Under Review │───▶│ Validated │───▶│ Approved │
│ (local)  │    │ (pending) │    │ (Federation)  │    │ (Ministry)│    │ (final)  │
└──────────┘    └──────────┘    └──────────────┘    └───────────┘    └──────────┘
                      │                   │                   │
                      │                   │                   │
                      ▼                   ▼                   ▼
                  ┌──────────┐    ┌──────────────┐    ┌──────────────┐
                  │ Rejected  │    │ Resubmit     │    │ KPI Compute  │
                  │ (errors)  │    │ (fix issues) │    │ (triggered)  │
                  └──────────┘    └──────────────┘    └──────────────┘
```

### 7.2 KPI Computation Pipeline

```
Financial Statement Submitted
         │
         ▼
┌─────────────────────┐
│ Validate Balance     │
│ Sheet (Assets =     │
│ Liabilities + Equity│
└─────────┬───────────┘
          │ Valid
          ▼
┌─────────────────────┐
│ Compute Financial   │
│ KPIs (50+ ratios)  │
│ Store in           │
│ computed_kpis table │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Compute Compliance  │
│ Score (weighted)    │
│ Store in           │
│ compliance_scores   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Update Benchmark    │
│ Averages (regional,│
│ sector, national)  │
└─────────────────────┘
```

### 7.3 Caching Strategy

| Data              | Cache Duration | Invalidation          |
| ----------------- | -------------- | --------------------- |
| Dashboard summary | 5 minutes      | On new submission     |
| KPI results       | 15 minutes     | On data change        |
| Cooperative list  | 30 minutes     | On cooperative update |
| Benchmark data    | 1 hour         | On nightly batch      |
| User session      | Until expiry   | On logout             |

---

## 8. Migration Strategy

### 8.1 From Mock Data to Database

The migration from client-side mock data to a persistent database follows these phases:

**Phase 1: Schema & Seed**

1. Create Drizzle schema definitions
2. Generate initial migration
3. Seed database with existing mock data (10 cooperatives, 5 members, 4 savings accounts, 4 loans, 2 fixed deposits, 2 balance sheets)
4. Create 4 default users (one per role)

**Phase 2: API Layer**

1. Replace mock data imports with TanStack Query hooks calling server functions
2. Implement CRUD endpoints for all entities
3. Add authentication middleware
4. Add role-based access guards

**Phase 3: Real-Time Features**

1. Add WebSocket notifications for submission status changes
2. Implement optimistic updates for form submissions
3. Add background KPI computation workers

### 8.2 Seed Data Mapping

| Mock Data                 | Database Table                                      | Notes                                  |
| ------------------------- | --------------------------------------------------- | -------------------------------------- |
| `COOPERATIVES`            | `cooperatives`                                      | Direct mapping, UUID IDs               |
| `USERS`                   | `users`                                             | Add password hashes, map roles         |
| `SUBMISSIONS`             | `submissions`                                       | Map cooperativeId to UUID              |
| `SAMPLE_BALANCE_SHEETS`   | `financial_statements` + `balance_sheet_line_items` | Flatten nested objects into line items |
| `SAMPLE_MEMBERS`          | `members`                                           | Map cooperativeId                      |
| `SAMPLE_SAVINGS_ACCOUNTS` | `savings_accounts`                                  | Map memberId                           |
| `SAMPLE_LOANS`            | `loans`                                             | Map memberId                           |
| `SAMPLE_FIXED_DEPOSITS`   | `fixed_deposits`                                    | Map memberId                           |
| `REGIONS`                 | `regions`                                           | Seed 4 regions                         |
| `KPI` (dashboard)         | `computed_kpis`                                     | Pre-compute from balance sheets        |

---

## 9. Security Considerations

### 9.1 Data Protection

- **Password hashing**: bcrypt with cost factor 12
- **PII encryption**: Member names, IDs encrypted at rest using pgcrypto
- **Financial data**: All monetary values stored as `numeric` (no floating-point)
- **API keys**: Stored in environment variables, never in code
- **CORS**: Same-origin only (unified TanStack Start deployment)

### 9.2 Input Validation

- **Server-side**: Zod schemas shared between client and server
- **SQL injection**: Drizzle ORM parameterized queries
- **XSS**: React's built-in escaping + CSP headers
- **CSRF**: Same-site cookies + token validation

### 9.3 Rate Limiting

- Login: 5 attempts per minute per IP
- API: 100 requests per minute per user
- Report generation: 10 per hour per user

### 9.4 Audit Trail

Every mutation is logged in `audit_logs` with:

- Who (userId)
- What (action, entityType, entityId)
- When (timestamp)
- Changes (JSON diff of before/after)
- Where (IP address, user agent)

---

## 10. Deployment Architecture

### 10.1 Recommended Stack

```
┌─────────────────────────────────────────────────┐
│              Cloudflare Workers / Vercel          │
│              (TanStack Start + Nitro)             │
│              ┌─────────────────────────┐          │
│              │   Hono API Routes       │          │
│              │   Server Functions      │          │
│              │   Auth Middleware        │          │
│              └────────────┬────────────┘          │
└───────────────────────────┼─────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Neon PG  │ │  Upstash │ │ Cloudflare│
        │(Postgres)│ │ (Redis)  │ │    R2    │
        └──────────┘ └──────────┘ └──────────┘
```

### 10.2 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/coopdata

# Auth
BETTER_AUTH_SECRET=<random-secret>
BETTER_AUTH_URL=https://coopdata.sz

# Redis
REDIS_URL=redis://user:pass@host:6379

# Object Storage
S3_ENDPOINT=https://...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=coopdata-reports

# App
NODE_ENV=production
VITE_APP_URL=https://coopdata.sz
```

---

## 11. Decision Log & Reasoning

### D1: Why Hono on Nitro instead of separate Express backend?

**Context**: The frontend uses TanStack Start with Nitro as the server runtime.

**Decision**: Use Hono as the API framework within Nitro, not a separate Express server.

**Reasoning**:

1. TanStack Start's architecture is designed for unified client+server deployment
2. `createServerFn` provides type-safe RPC without manual API definition
3. Separate backend would require CORS configuration, separate deployment pipeline, and API versioning
4. Hono is 3x faster than Express, has built-in OpenAPI support, and works as Nitro middleware
5. Single deployment reduces operational complexity for the MCIT team

### D2: Why Drizzle ORM instead of Prisma?

**Context**: Need a TypeScript ORM for PostgreSQL.

**Decision**: Drizzle ORM.

**Reasoning**:

1. **Type inference**: Drizzle infers types from schema definitions without code generation
2. **Bundle size**: Drizzle is ~30KB vs Prisma's ~8MB query engine
3. **SQL-like API**: Complex financial queries (window functions, CTEs) are easier to write
4. **Migration control**: Drizzle Kit generates migrations from schema changes, not the other way around
5. **Performance**: No query engine overhead, direct SQL execution
6. **Nitro compatibility**: Drizzle works natively with Nitro's database drivers

### D3: Why EAV pattern for balance sheet line items?

**Context**: The Chart of Accounts has 41+ individual fields.

**Decision**: Use `balance_sheet_line_items` table with `account_code`, `account_category`, `account_subcategory`, and `value` columns.

**Reasoning**:

1. **Extensibility**: New account codes (e.g., if DGRV adds codes in the 7000 range) require no schema migration
2. **Queryability**: Indexed by category and subcategory for fast aggregation
3. **Validation**: Application layer validates against `ACCOUNT_CODES` constant
4. **Historical**: Each financial statement has its own set of line items, enabling period-over-period comparison
5. **Trade-off**: Slightly more complex queries (need JOINs), but the flexibility gain outweighs this for a system that must adapt to regulatory changes

### D4: Why application-level multi-tenancy instead of PostgreSQL RLS?

**Context**: Data must be scoped by user role (Ministry sees all, Federation sees region, etc.).

**Decision**: Application-level WHERE clause filtering in Drizzle queries.

**Reasoning**:

1. **Complexity**: Our role logic is nuanced (Federation sees their region, Cooperative sees only their own data). PostgreSQL RLS policies would be complex to write and maintain.
2. **Debuggability**: Application-level filtering is transparent and easy to trace.
3. **ORM compatibility**: Drizzle doesn't have built-in RLS support; we'd need raw SQL for session variables.
4. **Testability**: Easier to unit test role-based access in application code.
5. **Future flexibility**: If we need to add new roles or change access patterns, application code is easier to modify.

### D5: Why Better Auth instead of Auth.js/NextAuth?

**Context**: Need authentication for 4 roles with session management.

**Decision**: Better Auth.

**Reasoning**:

1. **Framework agnostic**: Works with Hono/Nitro, not tied to Next.js
2. **Lightweight**: Smaller footprint than Auth.js
3. **Multi-tenant**: Built-in support for role-based access with custom claims
4. **Session management**: JWT + refresh tokens with Redis session store
5. **Database-agnostic**: Works with Drizzle out of the box

### D6: Why `numeric(15, 2)` for monetary values?

**Context**: Financial data requires exact precision.

**Decision**: PostgreSQL `numeric(15, 2)`.

**Reasoning**:

1. **No floating-point errors**: `numeric` is exact decimal, unlike `float`/`double`
2. **Sufficient range**: 15 digits handles values up to 999 trillion in SZL
3. **Consistent with frontend**: The frontend uses `number` type; the API layer converts between `numeric` strings and JavaScript numbers
4. **Standard practice**: Financial systems universally use fixed-precision decimals

### D7: Why store computed KPIs instead of computing on demand?

**Context**: KPI calculations involve multiple table joins and aggregations.

**Decision**: Materialize KPIs in `computed_kpis` table, update on data change.

**Reasoning**:

1. **Performance**: Dashboard loads require 50+ KPI values. Computing on demand would require 10+ complex queries per page load.
2. **Consistency**: All users see the same computed values for a given period.
3. **Historical tracking**: Stored KPIs enable trend analysis without recomputing historical data.
4. **Invalidation**: KPIs are recomputed when a submission is validated, ensuring data integrity.
5. **Batch processing**: Nightly batch can recompute all KPIs for dashboards, avoiding cold-start latency.

---

## Appendix A: Validation Error Types

```typescript
interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationWarning {
  field: string;
  message: string;
}
```

## Appendix B: Chart of Accounts Reference

| Code Range | Category        | Subcategories                                                                                   |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------- |
| 1000-1999  | Assets          | Liquid Assets (1100), Loans & Advances (1200), Loan Loss Provisions (1250), Other Assets (1300) |
| 2000-2999  | Liabilities     | Member Deposits (2100), Borrowings (2200), Other Liabilities (2300)                             |
| 3000-3999  | Equity          | Member Shares (3100), Reserves (3200), Retained Earnings (3300)                                 |
| 4000-4999  | Income          | Financial Income (4100), Other Income (4200)                                                    |
| 5000-5999  | Expenses        | Financial Expenses (5100), Operating Expenses (5200), Credit Loss (5300)                        |
| 6000-6999  | Surplus/Deficit | Net Surplus/Deficit (6999)                                                                      |

## Appendix C: KPI Reference

### Financial KPIs (22 indicators)

- Size & Market: totalAssets, grossLoanPortfolio, netLoanPortfolio, totalMemberDeposits, totalEquity
- Portfolio Quality: par30, par60, par90, nplRatio, loanLossCoverage
- Profitability: roa, roe, financialRevenueRatio, financialExpenseRatio, operatingExpenseRatio, costOfFunds, yieldOnPortfolio, netInterestMargin, operationalSelfSufficiency
- Liquidity & Solvency: currentRatio, cashRatio, capitalAdequacyRatio, debtToEquity, liquidFundsRatio, depositsToLoans, savingsToAssets, voluntarySavingsRatio

### Membership KPIs (11 indicators)

- totalMembers, membershipGrowthRate, dormancyRate, exitRate, activeMembersRatio, agmParticipationRate, womenMembersPercent, youthMembersPercent, ruralMembersPercent, womenInGovernancePercent, youthInGovernancePercent

### Savings KPIs (10 indicators)

- savingsPenetration, activeSaversRatio, regularSaversRatio, dormantSavingsAccountsPercent, zeroBalanceAccountsPercent, stableBalanceRatio, highWithdrawalFrequencyPercent, emergencyWithdrawalIncidence, averageInterestRate, accountConcentration

### Loan KPIs (10 indicators)

- creditPenetration, onTimeRepaymentRatio, loansInArrearsPercent, restructuredLoansRatio, womenBorrowersPercent, youthBorrowersPercent, ruralBorrowersPercent, averageLoanSize, loansPerMember, averageInterestRate

### Fixed Deposit KPIs (5 indicators)

- fdPenetration, longTermFdRatio, fdRolloverRate, earlyWithdrawalRate, concentrationRisk

### Compliance Score (4 components)

- Timely Submission (30%), Data Quality (25%), Financial Ratios (25%), Documentation (20%)

---

_End of Document_
