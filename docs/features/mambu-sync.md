# Design: Mambu synchronisation (Ministry-triggered)

Status: DRAFT for approval. No code is written until this is approved.
Source of facts: the Mambu sandbox (read-only calls, 26 Oct 2026) and Mambu's public API v2 specification.

## 1. Goal

A Ministry admin presses **Sync with Mambu**. CoopData pulls the data of every linked SACCO from the central Mambu environment and stores it as one **monthly submission per SACCO**. After Ministry review the submissions feed the existing statistics, KPIs and reports unchanged.

SACCOs create nothing for Mambu-linked periods. Read-only: CoopData never writes to Mambu.

## 2. Decisions already taken

| # | Decision |
|---|---|
| 1 | Synced submissions wait for **Ministry review** before they count in statistics. |
| 2 | A sync covers **one month** (month end position). Frequency is monthly. |
| 3 | A Mambu **branch = one SACCO**. Linked by hand once on the Mambu Sync page. Non-SACCO branches (federation, central fund, foreign entities, demo) are simply not linked. |
| 4 | **Old periods are needed.** Ledger: any month through the accounting report. Lists: rebuilt from dated transactions (section 7). |
| 5 | **BLACKLISTED** members are excluded, together with their accounts and loans in the lists. |
| 6 | Member **urban or rural is not imported** (section 5.1 needs a schema decision). |
| 7 | **AGM attendance and voting default to false.** Leadership role stays empty. |

## 3. Flow

1. Ministry admin opens the Mambu Sync page and picks year and month.
2. `POST /api/v1/ministry/mambu/syncs` creates a sync run and returns its id. One run at a time.
3. A background job processes each linked SACCO: ledger report, members, savings, shares, fixed deposits, loans.
4. Each SACCO is processed independently. A failure never stops the others.
5. Data is mapped (section 5), validated (section 6) and written into a submission with `submission_method = mambu`, status "pending ministry review". Re-running the same month replaces the previous synced data of that submission.
6. The page shows a result table per SACCO: synced, flagged, failed, unmatched, with counts and reasons.
7. The Ministry reviews and approves. Only approved submissions count in statistics.
8. Every run is written to the audit log: who, month, per SACCO counts, outcome.

Existing period rules apply: one frequency and one method per cooperative per year. A SACCO that already has a non-Mambu submission for the month is skipped and reported, never overwritten.

## 4. Data model additions

- `cooperatives.mambu_branch_id` (nullable, unique): the link to a Mambu branch (for example `ES0006`).
- `mambu_sync_run`: id, started_by, year, month, status, started_at, finished_at.
- `mambu_sync_item`: run id, cooperative id, status, record counts, error summary.
- `mambu_account_mapping`: Mambu ledger code to CoopData account code, rollup, sign rule. Editable by the Ministry.
- `mambu_product_mapping`: Mambu deposit or loan product id to CoopData type (savings type, share, fixed, loan type). Editable.
- Enum additions: `SubmissionMethod::Mambu`, a system value for `created_by_role`.
- `member.urban_rural` (see 5.1).

## 5. Mapping

### 5.1 Members (per SACCO, at month end)
| CoopData | Mambu | Rule |
|---|---|---|
| member_id | client `id` | A code. Verify no personal data appears in ids. |
| join_date | `_ADL.dateJoined`, else `activationDate` | The custom field is often empty. |
| status | `state` and `_ADL.mcat` | ACTIVE: Active. EXITED or mcat Resigned: Exited. mcat Deceased: Deceased. **BLACKLISTED: excluded.** INACTIVE and PENDING_APPROVAL: to be agreed with Mambu. |
| exit_date | `_ADL.dateResignedDeceased`, else `closedDate` | Only when Exited or Deceased. |
| gender | `gender` | |
| age_group | `birthDate` | Computed at the reporting date. The birth date is never stored. |
| region | `_ADL.RG` (HHOHHO, MANZINI, SHISELWENI, LUBOMBO) | Fallback: the SACCO's region (branch address). Coverage is low in the sandbox sample. |
| urban_rural | not imported | `member.urban_rural` is not nullable today. Needs one of: make it nullable, or add an "Unknown" value. **Decision needed before building.** |
| agm_attendance, voting_exercised | none | false. `memberPresence` and the SGM / AGM field were empty in the sample. |
| leadership_role | none | Empty. |
| share_balance | share deposit accounts | Sum of balances of the share products at the date. |

### 5.2 Savings and shares
- Account code: generated from the Mambu encoded key. **Never use the Mambu account id**, some contain member names or national ID numbers.
- Type: by product mapping (100 deposit products, types CURRENT_ACCOUNT, REGULAR_SAVINGS, SAVINGS_PLAN, FIXED_DEPOSIT) to Voluntary, Mandatory, Fixed or Share.
- Status: ACTIVE, DORMANT, CLOSED map directly. WITHDRAWN and LOCKED to be agreed.
- Balance at date, contribution frequency, balance trend, withdrawal frequency: from deposit transactions, which carry the balance after each transaction.
- Monthly contribution: custom field `monthlyContribution`.
- Emergency withdrawals: No by default. `Withdrawal Purpose` is free text and was empty in the sample.

### 5.3 Fixed deposits
- Sources: FIXED_DEPOSIT and SAVINGS_PLAN accounts.
- Maturity date: `maturityDate`. It is set only when an authorised user starts the maturity period, so if empty use the first deposit date plus the product's maturity period.
- Status: ACTIVE: Active. MATURED: Matured. WITHDRAWN or CLOSED: Withdrawn. Rolled over is not native.
- Early withdrawal: a withdrawal dated before the maturity date.

### 5.4 Loans
| CoopData | Mambu | Rule |
|---|---|---|
| loan type | product name, with the `Loan Purpose` field | Product mapping table. The purpose is almost always PERSONAL LOAN. |
| start date | `disbursementDetails.disbursementDate` | |
| maturity date | first repayment date plus (installments minus 1) periods | Or the last date in `/loans/{id}/schedule`. |
| status | `accountState` and sub state | ACTIVE: Performing. ACTIVE_IN_ARREARS: Arrears. CLOSED with RESCHEDULED or REFINANCED: Restructured. CLOSED with WRITTEN_OFF: Written off. Never disbursed loans are excluded. |
| outstanding | principal balance | At the reporting date. |
| days past due | `daysInArrears` | Current value. For past dates rebuilt from schedule and transactions. |
| annual interest rate | `interestRate` | Convert by the charge frequency (2.5 every month is 30 per year). |
| borrower type | `accountHolderType` | CLIENT: Individual. GROUP: Group. |

### 5.5 Ledger (financial statement)
- Source: Accounting Reports API. `POST /accounting/reports` with `startDate`, `endDate`, `branchId`, `currencyCode` SZL, `balanceTypes`; poll `GET /accounting/reports/{key}` until COMPLETE. One request per SACCO per month.
- Use DETAIL accounts only. Header accounts duplicate their children.
- Balance sheet lines: closing balance at month end.
- Income and expense lines: **net change** for the month. Closing balances are cumulative since the start.
- Net change is absolute. The sign comes from the account type and the debit and credit totals.
- Mambu ledger codes are not CoopData codes (Mambu 1101 is cash till, CoopData 1101 is cash on hand). Map explicitly through `mambu_account_mapping`. Unmapped accounts go to a visible "unmapped" line so the statement still balances.
- Verified in the sandbox: for one SACCO and month, assets equal liabilities plus equity plus income minus expenses.

## 6. Validation and review
- The existing checks apply: assets equal liabilities plus equity, unique codes, every account and loan belongs to a listed member, maturity not before start, Performing loans have 0 days past due.
- Records referencing an excluded (BLACKLISTED) member are excluded with a counted reason. Their ledger balances remain, so lists and ledger can differ. This is shown as a flag, not an error.
- Failures are flagged on the sync result and on the submission for the Ministry reviewer.

## 7. Past periods
- Ledger: any month, from the accounting report.
- Members: active at date if activated on or before it and not closed before it.
- Savings: the balance after the last transaction on or before the date.
- Loans: balance and arrears at the date rebuilt from the schedule and dated transactions.
- Build this as a separate "as at" step and validate against a few SACCOs before trusting years of history.

## 8. Privacy
- Allow-list of fields only, never a block-list. Custom fields hold national ID numbers, bank accounts and nominee names.
- Do not store names, ID numbers, phone numbers, addresses or birth dates.
- Do not log request or response bodies. Do not import transaction notes (free text with names).
- Codes are generated, stable across months, and not reversible.

## 9. Operations
- Config from environment variables: `MAMBU_BASE_URL` and a read-only credential (`MAMBU_USERNAME` and `MAMBU_PASSWORD`, or `MAMBU_API_KEY`). Placeholders in `.env.example` only.
- Always filter by branch. Sizes for one SACCO in the sandbox: 2,814 clients, 9,685 deposits, 3,631 loans. Whole institution: 18,029 clients, 457,256 deposits, 455,519 loans.
- Long timeouts. The journal search and the bulk `/installments` call timed out or returned 500 in the sandbox. Do not use `/installments`; use per-loan schedules.
- Retries with delay, and a low concurrency. No published rate limits (fair use policy only).
- Tests use recorded sandbox responses with personal data removed. CI never calls Mambu.

## 10. Open questions for Mambu
1. Grant read access to the deposit balance summary and to the configuration reads (client roles, group role names). Both returned 403.
2. Registration number and tax number as custom fields on branches.
3. Member region coverage, and urban or rural, if wanted later.
4. Meaning and history of the meeting attendance fields. Is voting recorded anywhere?
5. How INACTIVE, PENDING_APPROVAL, LOCKED and WITHDRAWN accounts and clients should be treated.
6. Why `/installments` returns 500 and the journal search times out.
7. API rate limits and the maximum report date range.
8. A written-off and a restructured loan example per SACCO, and fixed deposit rollover handling.
9. Sign-off on the ledger account mapping (661 accounts to the 42 CoopData lines) and the product mappings.

## 11. Out of scope
- Writing to Mambu.
- Non-SACCO cooperatives.
- Automatic creation of cooperatives from Mambu branches.

## 12. Implementation notes (branch `feat/mambu-sync`, not committed)

- Backend: migration `64_mambu_sync.sql`; entities and `MambuRepository`; `services/mambu/{client,models,mapper,sync}.rs`; ministry endpoints under `/api/v1/ministry/mambu/*`; config `MAMBU_*`.
- Members, savings, loans and fixed deposits are persisted by the same code as the upload path: it moved to `services/nf_persist.rs` and is called by both.
- Synced submissions: `submission_method = 'mambu'`, `created_by_role = 'ministry'`, status `in_review`, tier `ministry`. The existing Ministry review approves them. After writing, the sync runs the abnormality detector on the statement and computes the KPIs, like a normal submission.
- **Ledger.** Two accounting reports per SACCO: the month (income and expense lines are the movement of the month) and 1 January to the month end (balance sheet closing balances). Mambu never closes its income and expense accounts, so equity is completed with two computed lines: accumulated surplus (3301, earnings up to 31 December of the previous year) and current year surplus (3302, earnings of the year to the month end). Checked on the real ES0006 report of September 2026: assets 20,205,474.26 equal liabilities 15,404,982.14 plus equity 4,800,492.12, gap 0.00.
- **Member region** comes from the Mambu custom field, then the Mambu branch address, then the CoopData cooperative's own `region`. In the sandbox the ES0006 branch address has no region, so set the cooperative's region in CoopData.
- `member.urban_rural` gets the value `Unknown` for every Mambu member.
- Deposit classification uses product-name rules unless `mambu_product_mappings` has a row. Fixed deposits without a Mambu maturity date use the product's maturity period, else 12 months. Loan type uses the loan purpose and product name.
- Members who left with no exit date, deposits not in service, closed accounts without a closing date, and loans closed before the month are left out.
- Not implemented: lists as at a past date (they use the Mambu state at sync time; the run warns `LISTS_AS_AT_SYNC_TIME`); missed installments, balance trend, withdrawal frequency and emergency withdrawals use neutral defaults; no UI for product mappings (API only).
- A run still `running` after 3 hours is treated as lost and no longer blocks a new sync.
- Tests: 27 mapper and client unit tests; an ignored end-to-end test against a real Postgres (`tests/mambu_sync_e2e.rs`); an ignored test that maps the recorded sandbox responses (`tests/mambu_samples_check.rs`, `MAMBU_SAMPLES=~/mambu-samples`); 10 frontend tests.

## 13. Who links and who syncs

**Linking.** The common key is the Mambu branch ID (for example `ES0006`). The apex enters it when it creates the cooperative (optional field "Mambu branch ID"), or later on the cooperative detail page. The apex types the ID and confirms the branch name; it never sees the list of Mambu branches, so it cannot discover the SACCOs of other apexes. A branch can be linked to one cooperative only. The Ministry can still link any cooperative in the "SACCO links" tab.

**Syncing.** Same engine, three levels:

| Level | Endpoint | Covers | Result |
|---|---|---|---|
| Cooperative | `POST /api/v1/cooperative/mambu/syncs` | own SACCO (taken from the token) | draft, tier cooperative: the SACCO checks and submits |
| Apex | `POST /api/v1/apex/mambu/syncs` | linked cooperatives of the apex | draft, tier apex |
| Ministry | `POST /api/v1/ministry/mambu/syncs` | all linked SACCOs | `in_review`, tier ministry |

Guards: at most 3 runs at the same time; one running sync per SACCO; cooperative and apex cannot re-sync the same SACCO within 5 minutes (the Ministry is exempt). A sync replaces only its own earlier draft. Cooperative and apex never replace a submitted, in-review or approved submission; the Ministry also replaces its own `in_review` result. The Ledger mapping stays Ministry-only.

## 14. Ledger mapping

The default mapping (migration 65) follows the balance sheet of Mambu. Every account under a header (1100 cash, 2000 gross loan portfolio, 5000 savings, 6500 shares, ...) goes to the CoopData account of that header; about 100 accounts have their own row where they belong elsewhere (call accounts 1103, investments 1104, inventories 1306, accumulated depreciation 1304 with sign -1, loan loss provision 1251, fixed savings 2103, accruals 2302, fee income 4102, bad debts 5301, ...). A new Mambu account is mapped automatically through its header. An account with no mapping and no header mapping goes to the default account of its type (1301, 2301, 3202, 4201, 5202) and is reported as `LEDGER_UNMAPPED`.

Checked on the real sample of ES0006: assets 20,205,474.26 = liabilities 15,404,982.14 + equity 4,800,492.12, gap 0.00, 0 unmapped.

## 15. What Mambu's accounting report gets right (checked on the sandbox, ES0006)

Probed with `scripts/mambu-year-probe.sh`, `mambu-sign-probe.sh` and `mambu-range-probe.sh` (read only, totals only).

- A report whose start date is on or after 1 April 2026 (and single days from 31 March 2026) uses natural signs (credit accounts positive), balances to 0.00 and matches the Mambu balance sheet screen to the cent.
- A report starting on 1 March 2026 or earlier uses signed values (credit accounts negative) and does not balance under either style (gaps of 2.7M to 8.5M on assets of 16M to 25M, from 2022 to 2026). The currency filter is not the cause.
- Mambu's own "Current Earnings" line is all income minus all expenses since the beginning. It is not split into accumulated and current year.

Consequences in the sync:

1. The balance sheet comes from the month report only (first day to last day of the month).
2. The sign style of every report is detected from the accounting equation. A report that balances in neither style is not used: the ledger stays empty and the item is flagged `LEDGER_DOES_NOT_BALANCE`.
3. The year-to-date report is only used to split the earnings, and only when it balances and agrees with the month report on every closing total. Otherwise all earnings sit in the accumulated surplus line and the item carries `SURPLUS_NOT_SPLIT`.
4. Importing past years from the ledger is not reliable on this sandbox. It has to be re-checked on the real Mambu before it is built.
