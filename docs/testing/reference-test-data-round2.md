# Reference Test Data — Round 2

> **Purpose:** test what round 1 could not: averages and consolidated totals with **several** cooperatives, **prior-year** comparison (growth), and a **quarterly** return. Round 1 data (`basic sacco` 2025, `multiP` 2025) stays as it is.
> **Formulas:** the app's own (`kpi_engine.rs`, `questionnaire_kpi/`), as cross-checked in round 1. Amounts in SZL (E).

Fill the **App shows** column during the cross-check: ✅ matches, ❌ differs (note the value).

---

## 0. Before entering the data

| # | What | Why |
|---|---|---|
| 1 | `Test Cooperative SACCO` needs **type SACCO, region Manzini, sector finance**. It belongs to **Test Apex**, so that apex sets them (allowed because it has no submission yet) | It is the third SACCO; the cooperative's own benchmarking only shows a national average with **3 or more** cooperatives |
| 2 | Logins (or the apex creating the submissions on their behalf) for `saccocoop`, `Test Cooperative SACCO`, `fsfsfa`, `testModification` | To enter the returns as drafts |
| 3 | Enter in this order: S1-2024, S2-2024Q4, then the 2025 returns | So the prior-year and quarterly returns exist before the 2025 cross-check |

**Returns in this round:**

| Key | Cooperative | Type | Region / sector | Year | Period | Method | Status |
|---|---|---|---|---|---|---|---|
| S1 | basic sacco | SACCO | Hhohho / finance | 2025 | Yearly | manual entry | round 1 (already approved) |
| S2 | saccocoop | SACCO | Hhohho / finance | 2025 | Yearly | manual entry | new |
| S3 | Test Cooperative SACCO | SACCO | Manzini / finance | 2025 | Yearly | manual entry | new |
| S1-2024 | basic sacco | SACCO | Hhohho / finance | 2024 | Yearly | manual entry | new — prior year of S1 |
| S2-2024Q4 | saccocoop | SACCO | Hhohho / finance | 2024 | Quarterly Q4 | manual entry | new — quarterly |
| M1 | multiP | multipurpose | Hhohho / agriculture | 2025 | Yearly | questionnaire | round 1 (already approved) |
| M2 | fsfsfa | multipurpose | Hhohho / transport | 2025 | Yearly | questionnaire | new |
| M3 | testModification | multipurpose | Manzini / manufacturing | 2025 | Yearly | questionnaire | new |

**What each return tests:** S2 = a healthy larger SACCO; S3 = a weak SACCO with a **net loss** and an **accumulated deficit** (negative 3301), PAR 30 above 10% (HIGH alert); S1-2024 = growth for basic sacco; S2-2024Q4 = a quarterly return (three monthly columns; balance sheet at December, income added over October–December); M2 = a second Hhohho cooperative (regional average needs it); M3 = a loss-making cooperative with negative retained earnings.

---

# Part A — SACCO financial statements

Typed as positive numbers, including provisions and depreciation, as the grid presents them. Negative numbers only where shown (S3 accumulated deficit and current loss).

## A.1 Inputs — yearly returns (Annual Total column)

| Code | Account | S2 saccocoop 2025 | S3 Test Cooperative SACCO 2025 | S1-2024 basic sacco 2024 |
|---|---|---:|---:|---:|
| 1101 | Cash on hand | 60,000 | 20,000 | 40,000 |
| 1102 | Cash at bank (current) | 300,000 | 90,000 | 150,000 |
| 1103 | Cash at bank (savings) | 450,000 | 110,000 | 280,000 |
| 1104 | Short-term investments | 400,000 | 60,000 | 200,000 |
| 1201 | Performing loan portfolio | 4,200,000 | 1,500,000 | 2,500,000 |
| 1202 | Loans in arrears 1-30 days | 150,000 | 90,000 | 100,000 |
| 1203 | Loans in arrears 31-60 days | 80,000 | 70,000 | 50,000 |
| 1204 | Loans in arrears 61-90 days | 30,000 | 50,000 | 30,000 |
| 1205 | Non-performing loans (91+) | 40,000 | 140,000 | 60,000 |
| 1251 | General loan loss provision | 45,000 | 20,000 | 27,000 |
| 1252 | Specific loan loss provision | 55,000 | 90,000 | 48,000 |
| 1301 | Accounts receivable | 50,000 | 25,000 | 30,000 |
| 1302 | Prepaid expenses | 15,000 | 5,000 | 10,000 |
| 1303 | Fixed assets (cost) | 600,000 | 260,000 | 400,000 |
| 1304 | Accumulated depreciation | 180,000 | 110,000 | 98,000 |
| 1305 | Intangible assets | 25,000 | 0 | 20,000 |
| 2101 | Voluntary savings | 2,400,000 | 900,000 | 1,500,000 |
| 2102 | Mandatory savings | 1,300,000 | 600,000 | 880,000 |
| 2103 | Fixed-term deposits | 600,000 | 150,000 | 380,000 |
| 2201 | Short-term borrowings | 100,000 | 120,000 | 60,000 |
| 2202 | Long-term borrowings | 300,000 | 180,000 | 220,000 |
| 2301 | Accounts payable | 40,000 | 25,000 | 25,000 |
| 2302 | Accrued expenses | 30,000 | 15,000 | 20,000 |
| 2303 | Deferred income | 20,000 | 10,000 | 8,000 |
| 3101 | Permanent share capital | 500,000 | 180,000 | 320,000 |
| 3102 | Withdrawable shares | 150,000 | 40,000 | 100,000 |
| 3201 | Statutory reserve | 250,000 | 30,000 | 120,000 |
| 3202 | General reserve | 80,000 | 10,000 | 30,000 |
| 3203 | Risk/capital adequacy reserve | 50,000 | 0 | 20,000 |
| 3301 | Accumulated surplus | 100,000 | -40,000 | -66,000 |
| 3302 | Current year surplus | 200,000 | -20,000 | 80,000 |
| 4101 | Interest income from loans | 820,000 | 300,000 | 500,000 |
| 4102 | Fees & commissions income | 70,000 | 25,000 | 40,000 |
| 4201 | Other operating income | 30,000 | 10,000 | 20,000 |
| 5101 | Interest expense on deposits | 210,000 | 95,000 | 130,000 |
| 5102 | Interest expense on borrowings | 35,000 | 30,000 | 25,000 |
| 5201 | Personnel costs | 250,000 | 120,000 | 165,000 |
| 5202 | Administrative expenses | 110,000 | 50,000 | 70,000 |
| 5203 | Governance expenses | 40,000 | 15,000 | 25,000 |
| 5204 | Depreciation & amortization | 45,000 | 20,000 | 35,000 |
| 5301 | Loan loss provision expense | 30,000 | 25,000 | 30,000 |

## A.2 Inputs — S2-2024Q4 (saccocoop, 2024 Quarterly, Q4)

Balance sheet: only **1201** and **2101** change between months (both by the same amount, so every month balances). Income and expenses: the **same amount every month**.

| Code | Account | October | November | December |
|---|---|---:|---:|---:|
| 1101 | Cash on hand | 50,000 | 50,000 | 50,000 |
| 1102 | Cash at bank (current) | 250,000 | 250,000 | 250,000 |
| 1103 | Cash at bank (savings) | 400,000 | 400,000 | 400,000 |
| 1104 | Short-term investments | 350,000 | 350,000 | 350,000 |
| 1201 | Performing loan portfolio | 3,680,000 | 3,740,000 | 3,800,000 |
| 1202 | Loans in arrears 1-30 days | 140,000 | 140,000 | 140,000 |
| 1203 | Loans in arrears 31-60 days | 70,000 | 70,000 | 70,000 |
| 1204 | Loans in arrears 61-90 days | 30,000 | 30,000 | 30,000 |
| 1205 | Non-performing loans (91+) | 35,000 | 35,000 | 35,000 |
| 1251 | General loan loss provision | 40,000 | 40,000 | 40,000 |
| 1252 | Specific loan loss provision | 45,000 | 45,000 | 45,000 |
| 1301 | Accounts receivable | 45,000 | 45,000 | 45,000 |
| 1302 | Prepaid expenses | 12,000 | 12,000 | 12,000 |
| 1303 | Fixed assets (cost) | 580,000 | 580,000 | 580,000 |
| 1304 | Accumulated depreciation | 150,000 | 150,000 | 150,000 |
| 1305 | Intangible assets | 25,000 | 25,000 | 25,000 |
| 2101 | Voluntary savings | 2,030,000 | 2,090,000 | 2,150,000 |
| 2102 | Mandatory savings | 1,200,000 | 1,200,000 | 1,200,000 |
| 2103 | Fixed-term deposits | 550,000 | 550,000 | 550,000 |
| 2201 | Short-term borrowings | 100,000 | 100,000 | 100,000 |
| 2202 | Long-term borrowings | 320,000 | 320,000 | 320,000 |
| 2301 | Accounts payable | 35,000 | 35,000 | 35,000 |
| 2302 | Accrued expenses | 25,000 | 25,000 | 25,000 |
| 2303 | Deferred income | 18,000 | 18,000 | 18,000 |
| 3101 | Permanent share capital | 460,000 | 460,000 | 460,000 |
| 3102 | Withdrawable shares | 140,000 | 140,000 | 140,000 |
| 3201 | Statutory reserve | 220,000 | 220,000 | 220,000 |
| 3202 | General reserve | 70,000 | 70,000 | 70,000 |
| 3203 | Risk/capital adequacy reserve | 45,000 | 45,000 | 45,000 |
| 3301 | Accumulated surplus | 49,000 | 49,000 | 49,000 |
| 3302 | Current year surplus | 170,000 | 170,000 | 170,000 |
| 4101 | Interest income from loans | 68,000 | 68,000 | 68,000 |
| 4102 | Fees & commissions income | 6,000 | 6,000 | 6,000 |
| 4201 | Other operating income | 2,500 | 2,500 | 2,500 |
| 5101 | Interest expense on deposits | 17,000 | 17,000 | 17,000 |
| 5102 | Interest expense on borrowings | 3,000 | 3,000 | 3,000 |
| 5201 | Personnel costs | 21,000 | 21,000 | 21,000 |
| 5202 | Administrative expenses | 9,000 | 9,000 | 9,000 |
| 5203 | Governance expenses | 3,500 | 3,500 | 3,500 |
| 5204 | Depreciation & amortization | 3,800 | 3,800 | 3,800 |
| 5301 | Loan loss provision expense | 2,500 | 2,500 | 2,500 |

## A.3 Totals the grid should show

| Total | S2 | S3 | S1-2024 | S2-2024Q4 |
|---|---:|---:|---:|---:|
| Liquid assets (1100) | 1,210,000 | 280,000 | 670,000 | 1,050,000 |
| Gross loans (1200) | 4,500,000 | 1,850,000 | 2,740,000 | 4,075,000 |
| Allowance for loan losses (1250) | 100,000 | 110,000 | 75,000 | 85,000 |
| Other assets (1300) | 510,000 | 180,000 | 362,000 | 512,000 |
| **Total assets (1999)** | 6,120,000 | 2,200,000 | 3,697,000 | 5,552,000 |
| Member deposits (2100) | 4,300,000 | 1,650,000 | 2,760,000 | 3,900,000 |
| Borrowings (2200) | 400,000 | 300,000 | 280,000 | 420,000 |
| Other liabilities (2300) | 90,000 | 50,000 | 53,000 | 78,000 |
| **Total liabilities (2999)** | 4,790,000 | 2,000,000 | 3,093,000 | 4,398,000 |
| **Total equity (3999)** | 1,330,000 | 200,000 | 604,000 | 1,154,000 |
| Total income (4999) | 920,000 | 335,000 | 560,000 | 229,500 |
| Total expenses (5999) | 720,000 | 355,000 | 480,000 | 179,400 |
| **Net surplus (6999)** | 200,000 | -20,000 | 80,000 | 50,100 |

S2-2024Q4: balance sheet totals are **December**; income and expenses are **October + November + December**. October total assets 5,432,000, November 5,492,000.

## A.4 Expected KPIs per return

Ratios are **not annualised**: the quarterly ROA uses three months of surplus.

| KPI | S1 | S2 | S3 | S1-2024 | S2-2024Q4 | App shows |
|---|---:|---:|---:|---:|---:|---|
| Total assets | 4,198,500 | 6,120,000 | 2,200,000 | 3,697,000 | 5,552,000 | |
| Gross loan portfolio | 3,150,000 | 4,500,000 | 1,850,000 | 2,740,000 | 4,075,000 | |
| Net loan portfolio | 3,058,500 | 4,400,000 | 1,740,000 | 2,665,000 | 3,990,000 | |
| Total member deposits | 3,050,000 | 4,300,000 | 1,650,000 | 2,760,000 | 3,900,000 | |
| Total equity | 838,500 | 1,330,000 | 200,000 | 604,000 | 1,154,000 | |
| Net surplus | 100,000 | 200,000 | -20,000 | 80,000 | 50,100 | |
| PAR 30 (%) | 5.71% | 3.33% | 14.05% | 5.11% | 3.31% | |
| NPL ratio = PAR 90 (%) | 2.38% | 0.89% | 7.57% | 2.19% | 0.86% | |
| Loan loss coverage (%) | 50.83% | 66.67% | 42.31% | 53.57% | 62.96% | |
| ROA (%) | 2.38% | 3.27% | -0.91% | 2.16% | 0.90% | |
| ROE (%) | 11.93% | 15.04% | -10.00% | 13.25% | 4.34% | |
| Operating expense ratio (%) | 7.74% | 7.27% | 9.32% | 7.98% | 2.02% | |
| Capital adequacy (%) | 19.97% | 21.73% | 9.09% | 16.34% | 20.79% | |
| Liquid funds ratio (%) | 18.94% | 19.77% | 12.73% | 18.12% | 18.91% | |
| Operational self-sufficiency (%) | 118.87% | 127.78% | 94.37% | 116.67% | 127.93% | |
| Net interest margin (%) | 10.50% | 10.54% | 9.09% | 10.41% | 2.92% | |
| Deposits to loans (%) | 96.83% | 95.56% | 89.19% | 100.73% | 95.71% | |
| Institutional capital / assets (%) | 8.78% | 11.11% | -0.91% | 4.98% | 9.98% | |

S1 is round 1 (`basic sacco` 2025), repeated here for the averages below.

## A.5 Registers (must reconcile exactly)

### S2

**Members (12)** — shares total 500,000 (= 3101)

| ID | Joined | Status | Exit | Gender | Age | Region | Area | AGM | Voted | Shares |
|---|---|---|---|---|---|---|---|---|---|---:|
| CM001 | 2016-03-14 | Active | — | Female | 36-50 | Hhohho | Urban | Yes | Yes | 55,000 |
| CM002 | 2016-03-14 | Active | — | Male | 50+ | Hhohho | Urban | Yes | Yes | 55,000 |
| CM003 | 2017-06-02 | Active | — | Female | 36-50 | Hhohho | Rural | Yes | Yes | 48,000 |
| CM004 | 2017-09-20 | Active | — | Female | 18-35 | Hhohho | Urban | Yes | Yes | 33,000 |
| CM005 | 2018-01-11 | Active | — | Male | 36-50 | Hhohho | Rural | Yes | No | 44,000 |
| CM006 | 2018-05-30 | Active | — | Female | 50+ | Hhohho | Rural | Yes | Yes | 53,000 |
| CM007 | 2019-02-18 | Active | — | Male | 18-35 | Hhohho | Urban | No | No | 26,000 |
| CM008 | 2019-07-07 | Active | — | Female | 36-50 | Hhohho | Urban | Yes | Yes | 39,000 |
| CM009 | 2019-11-25 | Active | — | Female | 18-35 | Hhohho | Rural | Yes | Yes | 31,000 |
| CM010 | 2020-04-03 | Active | — | Male | 36-50 | Hhohho | Urban | Yes | Yes | 46,000 |
| CM011 | 2020-08-19 | Active | — | Female | 50+ | Hhohho | Rural | No | Yes | 42,000 |
| CM012 | 2021-01-28 | Active | — | Male | 18-35 | Hhohho | Urban | Yes | No | 28,000 |

**Savings accounts (12)** — voluntary 2,400,000 (= 2101), mandatory 1,300,000 (= 2102). Zero-balance No, emergency withdrawals No, withdrawal frequency Low.

| Account | Member | Type | Opened | Status | Frequency | Last contribution | # | Trend | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---|---:|---:|
| CS001 | CM001 | Voluntary | 2016-03-14 | Active | Monthly | 2025-12-28 | 12 | Increasing | 4.5 | 408,000 |
| CS002 | CM002 | Voluntary | 2016-03-14 | Active | Monthly | 2025-12-27 | 12 | Stable | 4.5 | 360,000 |
| CS003 | CM003 | Voluntary | 2017-06-02 | Active | Monthly | 2025-12-20 | 11 | Increasing | 4.5 | 311,000 |
| CS004 | CM004 | Voluntary | 2017-09-20 | Active | Weekly | 2025-12-29 | 48 | Increasing | 4.5 | 185,000 |
| CS005 | CM005 | Voluntary | 2018-01-11 | Active | Monthly | 2025-12-15 | 12 | Stable | 4.5 | 272,000 |
| CS006 | CM006 | Voluntary | 2018-05-30 | Active | Monthly | 2025-12-30 | 12 | Increasing | 4.5 | 340,000 |
| CS007 | CM007 | Voluntary | 2019-07-07 | Active | Monthly | 2025-12-22 | 10 | Stable | 4.5 | 233,000 |
| CS008 | CM008 | Voluntary | 2020-04-03 | Active | Monthly | 2025-12-18 | 12 | Increasing | 4.5 | 291,000 |
| CS009 | CM009 | Mandatory | 2016-03-14 | Active | Monthly | 2025-12-28 | 12 | Increasing | 6.0 | 382,000 |
| CS010 | CM010 | Mandatory | 2016-03-14 | Active | Monthly | 2025-12-27 | 12 | Increasing | 6.0 | 370,000 |
| CS011 | CM011 | Mandatory | 2018-01-11 | Active | Monthly | 2025-12-15 | 12 | Stable | 6.0 | 306,000 |
| CS012 | CM012 | Mandatory | 2019-02-18 | Active | Monthly | 2025-12-10 | 12 | Stable | 6.0 | 242,000 |

**Loans (9)** — total 4,500,000 (= 1200); balance by days past due equals 1201–1205. Restructured / early settlement / multiple / large borrower: No.

| Loan | Member | Product | Start | Maturity | Status | Borrower | DPD | Missed | Amount | Balance | Rate % | Women | Youth | Rural |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|---|
| CL001 | CM001 | Business | 2024-03-01 | 2027-02-28 | Performing | Individual | 0 | 0 | 1,075,000 | 1,075,000 | 18 | Yes | No | No |
| CL002 | CM003 | Personal | 2024-07-15 | 2026-07-14 | Performing | Individual | 0 | 0 | 550,000 | 550,000 | 18 | No | No | No |
| CL003 | CM005 | Agriculture | 2025-02-10 | 2027-02-09 | Performing | Individual | 0 | 0 | 1,025,000 | 1,025,000 | 16 | Yes | No | Yes |
| CL004 | CM007 | Business | 2023-11-20 | 2026-11-19 | Performing | Individual | 0 | 0 | 950,000 | 950,000 | 18 | No | No | Yes |
| CL005 | CM009 | Education | 2025-01-05 | 2026-12-31 | Performing | Individual | 0 | 0 | 600,000 | 600,000 | 15 | Yes | No | Yes |
| CL006 | CM011 | Personal | 2024-10-01 | 2026-09-30 | Arrears | Individual | 1-30 | 1 | 180,000 | 150,000 | 18 | Yes | Yes | No |
| CL007 | CM001 | Agriculture | 2024-06-15 | 2026-06-14 | Arrears | Individual | 31-60 | 2 | 110,000 | 80,000 | 16 | Yes | Yes | Yes |
| CL008 | CM003 | Personal | 2024-02-01 | 2026-01-31 | Arrears | Individual | 61-90 | 3 | 90,000 | 30,000 | 18 | No | Yes | No |
| CL009 | CM005 | Business | 2023-08-10 | 2025-08-09 | Arrears | Individual | 91+ | 5 | 150,000 | 40,000 | 18 | No | No | No |

**Fixed deposits (3)** — total 600,000 (= 2103). Early withdrawal No, rollover Yes, renewals 0.

| FD | Member | Type | Start | Maturity | Status | Tenure | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---:|
| CFD001 | CM001 | Premium | 2025-01-10 | 2026-01-09 | Active | ShortTerm | 7.0 | 277,000 |
| CFD002 | CM004 | Standard | 2024-07-01 | 2026-06-30 | Active | MediumTerm | 7.5 | 185,000 |
| CFD003 | CM007 | Standard | 2025-03-15 | 2026-03-14 | Active | ShortTerm | 7.0 | 138,000 |

Expected: members 12, active 12, women 7, aged 18-35 4, AGM 10, loans in arrears 4. Reconciliation: all 5 rows **Reconciled**.

### S3

**Members (10)** — shares total 180,000 (= 3101)

| ID | Joined | Status | Exit | Gender | Age | Region | Area | AGM | Voted | Shares |
|---|---|---|---|---|---|---|---|---|---|---:|
| TM001 | 2016-03-14 | Active | — | Female | 36-50 | Manzini | Urban | Yes | Yes | 23,000 |
| TM002 | 2016-03-14 | Active | — | Male | 50+ | Manzini | Urban | Yes | Yes | 23,000 |
| TM003 | 2017-06-02 | Active | — | Female | 36-50 | Manzini | Rural | Yes | Yes | 20,000 |
| TM004 | 2017-09-20 | Active | — | Female | 18-35 | Manzini | Urban | Yes | Yes | 14,000 |
| TM005 | 2018-01-11 | Active | — | Male | 36-50 | Manzini | Rural | Yes | No | 18,000 |
| TM006 | 2018-05-30 | Active | — | Female | 50+ | Manzini | Rural | Yes | Yes | 22,000 |
| TM007 | 2019-02-18 | Active | — | Male | 18-35 | Manzini | Urban | No | No | 11,000 |
| TM008 | 2019-07-07 | Active | — | Female | 36-50 | Manzini | Urban | Yes | Yes | 17,000 |
| TM009 | 2019-11-25 | Active | — | Female | 18-35 | Manzini | Rural | Yes | Yes | 13,000 |
| TM010 | 2020-04-03 | Active | — | Male | 36-50 | Manzini | Urban | Yes | Yes | 19,000 |

**Savings accounts (10)** — voluntary 900,000 (= 2101), mandatory 600,000 (= 2102). Zero-balance No, emergency withdrawals No, withdrawal frequency Low.

| Account | Member | Type | Opened | Status | Frequency | Last contribution | # | Trend | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---|---:|---:|
| TS001 | TM001 | Voluntary | 2016-03-14 | Active | Monthly | 2025-12-28 | 12 | Increasing | 4.5 | 196,000 |
| TS002 | TM002 | Voluntary | 2016-03-14 | Active | Monthly | 2025-12-27 | 12 | Stable | 4.5 | 173,000 |
| TS003 | TM003 | Voluntary | 2017-06-02 | Active | Monthly | 2025-12-20 | 11 | Increasing | 4.5 | 149,000 |
| TS004 | TM004 | Voluntary | 2017-09-20 | Active | Weekly | 2025-12-29 | 48 | Increasing | 4.5 | 89,000 |
| TS005 | TM005 | Voluntary | 2018-01-11 | Active | Monthly | 2025-12-15 | 12 | Stable | 4.5 | 131,000 |
| TS006 | TM006 | Voluntary | 2018-05-30 | Active | Monthly | 2025-12-30 | 12 | Increasing | 4.5 | 162,000 |
| TS007 | TM007 | Mandatory | 2016-03-14 | Active | Monthly | 2025-12-28 | 12 | Increasing | 6.0 | 176,000 |
| TS008 | TM008 | Mandatory | 2016-03-14 | Active | Monthly | 2025-12-27 | 12 | Increasing | 6.0 | 171,000 |
| TS009 | TM009 | Mandatory | 2018-01-11 | Active | Monthly | 2025-12-15 | 12 | Stable | 6.0 | 141,000 |
| TS010 | TM010 | Mandatory | 2019-02-18 | Active | Monthly | 2025-12-10 | 12 | Stable | 6.0 | 112,000 |

**Loans (6)** — total 1,850,000 (= 1200); balance by days past due equals 1201–1205. Restructured / early settlement / multiple / large borrower: No.

| Loan | Member | Product | Start | Maturity | Status | Borrower | DPD | Missed | Amount | Balance | Rate % | Women | Youth | Rural |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|---|
| TL001 | TM001 | Business | 2024-03-01 | 2027-02-28 | Performing | Individual | 0 | 0 | 992,000 | 992,000 | 18 | Yes | No | No |
| TL002 | TM003 | Personal | 2024-07-15 | 2026-07-14 | Performing | Individual | 0 | 0 | 508,000 | 508,000 | 18 | No | No | No |
| TL003 | TM005 | Personal | 2024-10-01 | 2026-09-30 | Arrears | Individual | 1-30 | 1 | 180,000 | 90,000 | 18 | Yes | Yes | No |
| TL004 | TM007 | Agriculture | 2024-06-15 | 2026-06-14 | Arrears | Individual | 31-60 | 2 | 110,000 | 70,000 | 16 | Yes | Yes | Yes |
| TL005 | TM009 | Personal | 2024-02-01 | 2026-01-31 | Arrears | Individual | 61-90 | 3 | 90,000 | 50,000 | 18 | No | Yes | No |
| TL006 | TM001 | Business | 2023-08-10 | 2025-08-09 | Arrears | Individual | 91+ | 5 | 150,000 | 140,000 | 18 | No | No | No |

**Fixed deposits (2)** — total 150,000 (= 2103). Early withdrawal No, rollover Yes, renewals 0.

| FD | Member | Type | Start | Maturity | Status | Tenure | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---:|
| TFD001 | TM001 | Premium | 2025-01-10 | 2026-01-09 | Active | ShortTerm | 7.0 | 90,000 |
| TFD002 | TM004 | Standard | 2024-07-01 | 2026-06-30 | Active | MediumTerm | 7.5 | 60,000 |

Expected: members 10, active 10, women 6, aged 18-35 3, AGM 9, loans in arrears 4. Reconciliation: all 5 rows **Reconciled**.

### S1-2024

**Members (18)** — shares total 320,000 (= 3101)

| ID | Joined | Status | Exit | Gender | Age | Region | Area | AGM | Voted | Shares |
|---|---|---|---|---|---|---|---|---|---|---:|
| M001 | 2016-03-14 | Active | — | Female | 36-50 | Hhohho | Urban | Yes | Yes | 25,000 |
| M002 | 2016-03-14 | Active | — | Male | 50+ | Hhohho | Urban | Yes | Yes | 25,000 |
| M003 | 2017-06-02 | Active | — | Female | 36-50 | Hhohho | Rural | Yes | Yes | 22,000 |
| M004 | 2017-09-20 | Active | — | Female | 18-35 | Hhohho | Urban | Yes | Yes | 15,000 |
| M005 | 2018-01-11 | Active | — | Male | 36-50 | Hhohho | Rural | Yes | No | 20,000 |
| M006 | 2018-05-30 | Active | — | Female | 50+ | Hhohho | Rural | Yes | Yes | 24,000 |
| M007 | 2019-02-18 | Active | — | Male | 18-35 | Hhohho | Urban | No | No | 12,000 |
| M008 | 2019-07-07 | Active | — | Female | 36-50 | Hhohho | Urban | Yes | Yes | 18,000 |
| M009 | 2019-11-25 | Active | — | Female | 18-35 | Hhohho | Rural | Yes | Yes | 14,000 |
| M010 | 2020-04-03 | Active | — | Male | 36-50 | Hhohho | Urban | Yes | Yes | 21,000 |
| M011 | 2020-08-19 | Active | — | Female | 50+ | Hhohho | Rural | No | Yes | 19,000 |
| M012 | 2021-01-28 | Active | — | Male | 18-35 | Hhohho | Urban | Yes | No | 13,000 |
| M013 | 2021-06-15 | Active | — | Female | 36-50 | Hhohho | Urban | Yes | Yes | 17,000 |
| M014 | 2022-02-09 | Active | — | Female | 18-35 | Hhohho | Rural | No | No | 11,000 |
| M015 | 2022-09-12 | Active | — | Male | 50+ | Hhohho | Rural | Yes | Yes | 23,000 |
| M016 | 2023-03-21 | Active | — | Female | 18-35 | Hhohho | Urban | Yes | Yes | 10,000 |
| M017 | 2023-10-05 | Active | — | Male | 36-50 | Hhohho | Urban | No | No | 12,000 |
| M018 | 2018-04-16 | Dormant | — | Male | 50+ | Hhohho | Rural | No | No | 19,000 |

**Savings accounts (18)** — voluntary 1,500,000 (= 2101), mandatory 880,000 (= 2102). Zero-balance No, emergency withdrawals No, withdrawal frequency Low.

| Account | Member | Type | Opened | Status | Frequency | Last contribution | # | Trend | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---|---:|---:|
| S001 | M001 | Voluntary | 2016-03-14 | Active | Monthly | 2024-12-28 | 12 | Increasing | 4.5 | 207,000 |
| S002 | M002 | Voluntary | 2016-03-14 | Active | Monthly | 2024-12-27 | 12 | Stable | 4.5 | 182,000 |
| S003 | M003 | Voluntary | 2017-06-02 | Active | Monthly | 2024-12-20 | 11 | Increasing | 4.5 | 157,000 |
| S004 | M004 | Voluntary | 2017-09-20 | Active | Weekly | 2024-12-29 | 48 | Increasing | 4.5 | 93,000 |
| S005 | M005 | Voluntary | 2018-01-11 | Active | Monthly | 2024-12-15 | 12 | Stable | 4.5 | 138,000 |
| S006 | M006 | Voluntary | 2018-05-30 | Active | Monthly | 2024-12-30 | 12 | Increasing | 4.5 | 172,000 |
| S007 | M007 | Voluntary | 2019-07-07 | Active | Monthly | 2024-12-22 | 10 | Stable | 4.5 | 118,000 |
| S008 | M008 | Voluntary | 2020-04-03 | Active | Monthly | 2024-12-18 | 12 | Increasing | 4.5 | 148,000 |
| S009 | M009 | Voluntary | 2021-06-15 | Active | Irregular | 2024-11-30 | 7 | Decreasing | 4.5 | 84,000 |
| S010 | M010 | Voluntary | 2022-09-12 | Active | Monthly | 2024-12-26 | 12 | Increasing | 4.5 | 133,000 |
| S011 | M011 | Voluntary | 2023-03-21 | Active | Weekly | 2024-12-29 | 50 | Increasing | 4.5 | 68,000 |
| S012 | M012 | Mandatory | 2016-03-14 | Active | Monthly | 2024-12-28 | 12 | Increasing | 6.0 | 154,000 |
| S013 | M013 | Mandatory | 2016-03-14 | Active | Monthly | 2024-12-27 | 12 | Increasing | 6.0 | 149,000 |
| S014 | M014 | Mandatory | 2018-01-11 | Active | Monthly | 2024-12-15 | 12 | Stable | 6.0 | 124,000 |
| S015 | M015 | Mandatory | 2019-02-18 | Active | Monthly | 2024-12-10 | 12 | Stable | 6.0 | 98,000 |
| S016 | M016 | Mandatory | 2019-11-25 | Active | Monthly | 2024-12-21 | 12 | Increasing | 6.0 | 113,000 |
| S017 | M017 | Mandatory | 2020-08-19 | Active | Monthly | 2024-12-19 | 12 | Stable | 6.0 | 134,000 |
| S018 | M018 | Mandatory | 2021-01-28 | Active | Monthly | 2024-12-24 | 12 | Increasing | 6.0 | 108,000 |

**Loans (11)** — total 2,740,000 (= 1200); balance by days past due equals 1201–1205. Restructured / early settlement / multiple / large borrower: No.

| Loan | Member | Product | Start | Maturity | Status | Borrower | DPD | Missed | Amount | Balance | Rate % | Women | Youth | Rural |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|---|
| L001 | M001 | Business | 2024-03-01 | 2027-02-28 | Performing | Individual | 0 | 0 | 600,000 | 422,000 | 18 | Yes | No | No |
| L002 | M003 | Personal | 2024-07-15 | 2026-07-14 | Performing | Individual | 0 | 0 | 350,000 | 216,000 | 18 | No | No | No |
| L003 | M005 | Agriculture | 2024-02-10 | 2027-02-09 | Performing | Individual | 0 | 0 | 500,000 | 402,000 | 16 | Yes | No | Yes |
| L004 | M007 | Business | 2023-11-20 | 2026-11-19 | Performing | Individual | 0 | 0 | 700,000 | 373,000 | 18 | No | No | Yes |
| L005 | M009 | Education | 2024-01-05 | 2026-12-31 | Performing | Individual | 0 | 0 | 300,000 | 235,000 | 15 | Yes | No | Yes |
| L006 | M011 | Business | 2024-09-01 | 2027-08-31 | Performing | Individual | 0 | 0 | 650,000 | 510,000 | 18 | Yes | No | No |
| L007 | M013 | Personal | 2024-04-01 | 2027-03-31 | Performing | Individual | 0 | 0 | 400,000 | 342,000 | 18 | No | No | No |
| L008 | M015 | Personal | 2024-10-01 | 2026-09-30 | Arrears | Individual | 1-30 | 1 | 180,000 | 100,000 | 18 | Yes | Yes | No |
| L009 | M017 | Agriculture | 2024-06-15 | 2026-06-14 | Arrears | Individual | 31-60 | 2 | 110,000 | 50,000 | 16 | Yes | Yes | Yes |
| L010 | M001 | Personal | 2024-02-01 | 2026-01-31 | Arrears | Individual | 61-90 | 3 | 90,000 | 30,000 | 18 | No | Yes | No |
| L011 | M003 | Business | 2023-08-10 | 2025-08-09 | Arrears | Individual | 91+ | 5 | 150,000 | 60,000 | 18 | No | No | No |

**Fixed deposits (5)** — total 380,000 (= 2103). Early withdrawal No, rollover Yes, renewals 0.

| FD | Member | Type | Start | Maturity | Status | Tenure | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---:|
| FD001 | M001 | Premium | 2024-01-10 | 2026-01-09 | Active | ShortTerm | 7.0 | 109,000 |
| FD002 | M004 | Standard | 2024-07-01 | 2026-06-30 | Active | MediumTerm | 7.5 | 72,000 |
| FD003 | M007 | Standard | 2024-03-15 | 2026-03-14 | Active | ShortTerm | 7.0 | 54,000 |
| FD004 | M010 | Special | 2023-10-01 | 2026-09-30 | Active | LongTerm | 8.5 | 90,000 |
| FD005 | M013 | Standard | 2024-06-01 | 2026-05-31 | Active | ShortTerm | 7.0 | 55,000 |

Expected: members 18, active 17, women 10, aged 18-35 6, AGM 13, loans in arrears 4. Reconciliation: all 5 rows **Reconciled**.

### S2-2024Q4

**Members (12)** — shares total 460,000 (= 3101)

| ID | Joined | Status | Exit | Gender | Age | Region | Area | AGM | Voted | Shares |
|---|---|---|---|---|---|---|---|---|---|---:|
| CM001 | 2016-03-14 | Active | — | Female | 36-50 | Hhohho | Urban | Yes | Yes | 50,000 |
| CM002 | 2016-03-14 | Active | — | Male | 50+ | Hhohho | Urban | Yes | Yes | 50,000 |
| CM003 | 2017-06-02 | Active | — | Female | 36-50 | Hhohho | Rural | Yes | Yes | 44,000 |
| CM004 | 2017-09-20 | Active | — | Female | 18-35 | Hhohho | Urban | Yes | Yes | 30,000 |
| CM005 | 2018-01-11 | Active | — | Male | 36-50 | Hhohho | Rural | Yes | No | 40,000 |
| CM006 | 2018-05-30 | Active | — | Female | 50+ | Hhohho | Rural | Yes | Yes | 48,000 |
| CM007 | 2019-02-18 | Active | — | Male | 18-35 | Hhohho | Urban | No | No | 24,000 |
| CM008 | 2019-07-07 | Active | — | Female | 36-50 | Hhohho | Urban | Yes | Yes | 36,000 |
| CM009 | 2019-11-25 | Active | — | Female | 18-35 | Hhohho | Rural | Yes | Yes | 28,000 |
| CM010 | 2020-04-03 | Active | — | Male | 36-50 | Hhohho | Urban | Yes | Yes | 42,000 |
| CM011 | 2020-08-19 | Active | — | Female | 50+ | Hhohho | Rural | No | Yes | 38,000 |
| CM012 | 2021-01-28 | Active | — | Male | 18-35 | Hhohho | Urban | Yes | No | 30,000 |

**Savings accounts (12)** — voluntary 2,150,000 (= 2101), mandatory 1,200,000 (= 2102). Zero-balance No, emergency withdrawals No, withdrawal frequency Low.

| Account | Member | Type | Opened | Status | Frequency | Last contribution | # | Trend | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---|---:|---:|
| CS001 | CM001 | Voluntary | 2016-03-14 | Active | Monthly | 2024-12-28 | 12 | Increasing | 4.5 | 366,000 |
| CS002 | CM002 | Voluntary | 2016-03-14 | Active | Monthly | 2024-12-27 | 12 | Stable | 4.5 | 322,000 |
| CS003 | CM003 | Voluntary | 2017-06-02 | Active | Monthly | 2024-12-20 | 11 | Increasing | 4.5 | 279,000 |
| CS004 | CM004 | Voluntary | 2017-09-20 | Active | Weekly | 2024-12-29 | 48 | Increasing | 4.5 | 165,000 |
| CS005 | CM005 | Voluntary | 2018-01-11 | Active | Monthly | 2024-12-15 | 12 | Stable | 4.5 | 244,000 |
| CS006 | CM006 | Voluntary | 2018-05-30 | Active | Monthly | 2024-12-30 | 12 | Increasing | 4.5 | 305,000 |
| CS007 | CM007 | Voluntary | 2019-07-07 | Active | Monthly | 2024-12-22 | 10 | Stable | 4.5 | 209,000 |
| CS008 | CM008 | Voluntary | 2020-04-03 | Active | Monthly | 2024-12-18 | 12 | Increasing | 4.5 | 260,000 |
| CS009 | CM009 | Mandatory | 2016-03-14 | Active | Monthly | 2024-12-28 | 12 | Increasing | 6.0 | 353,000 |
| CS010 | CM010 | Mandatory | 2016-03-14 | Active | Monthly | 2024-12-27 | 12 | Increasing | 6.0 | 341,000 |
| CS011 | CM011 | Mandatory | 2018-01-11 | Active | Monthly | 2024-12-15 | 12 | Stable | 6.0 | 282,000 |
| CS012 | CM012 | Mandatory | 2019-02-18 | Active | Monthly | 2024-12-10 | 12 | Stable | 6.0 | 224,000 |

**Loans (9)** — total 4,075,000 (= 1200); balance by days past due equals 1201–1205. Restructured / early settlement / multiple / large borrower: No.

| Loan | Member | Product | Start | Maturity | Status | Borrower | DPD | Missed | Amount | Balance | Rate % | Women | Youth | Rural |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|---|
| CL001 | CM001 | Business | 2024-03-01 | 2027-02-28 | Performing | Individual | 0 | 0 | 973,000 | 973,000 | 18 | Yes | No | No |
| CL002 | CM003 | Personal | 2024-07-15 | 2026-07-14 | Performing | Individual | 0 | 0 | 498,000 | 498,000 | 18 | No | No | No |
| CL003 | CM005 | Agriculture | 2024-02-10 | 2027-02-09 | Performing | Individual | 0 | 0 | 927,000 | 927,000 | 16 | Yes | No | Yes |
| CL004 | CM007 | Business | 2023-11-20 | 2026-11-19 | Performing | Individual | 0 | 0 | 860,000 | 860,000 | 18 | No | No | Yes |
| CL005 | CM009 | Education | 2024-01-05 | 2026-12-31 | Performing | Individual | 0 | 0 | 542,000 | 542,000 | 15 | Yes | No | Yes |
| CL006 | CM011 | Personal | 2024-10-01 | 2026-09-30 | Arrears | Individual | 1-30 | 1 | 180,000 | 140,000 | 18 | Yes | Yes | No |
| CL007 | CM001 | Agriculture | 2024-06-15 | 2026-06-14 | Arrears | Individual | 31-60 | 2 | 110,000 | 70,000 | 16 | Yes | Yes | Yes |
| CL008 | CM003 | Personal | 2024-02-01 | 2026-01-31 | Arrears | Individual | 61-90 | 3 | 90,000 | 30,000 | 18 | No | Yes | No |
| CL009 | CM005 | Business | 2023-08-10 | 2025-08-09 | Arrears | Individual | 91+ | 5 | 150,000 | 35,000 | 18 | No | No | No |

**Fixed deposits (3)** — total 550,000 (= 2103). Early withdrawal No, rollover Yes, renewals 0.

| FD | Member | Type | Start | Maturity | Status | Tenure | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---:|
| CFD001 | CM001 | Premium | 2024-01-10 | 2026-01-09 | Active | ShortTerm | 7.0 | 254,000 |
| CFD002 | CM004 | Standard | 2024-07-01 | 2026-06-30 | Active | MediumTerm | 7.5 | 169,000 |
| CFD003 | CM007 | Standard | 2024-03-15 | 2026-03-14 | Active | ShortTerm | 7.0 | 127,000 |

Expected: members 12, active 12, women 7, aged 18-35 4, AGM 10, loans in arrears 4. Reconciliation: all 5 rows **Reconciled**.

---

# Part B — SACCO averages, consolidation and growth (2025)

## B.1 Benchmarking averages

Averages are **simple averages of each cooperative's value**. Who sees which average:

| Average | Cooperatives | Cooperative's own view (needs ≥ 3) | Apex view (needs ≥ 2) |
|---|---|---|---|
| National | own view: all SACCOs (S1, S2, S3); apex view: the apex's own (S1, S2) | shown | shown (S1, S2 only) |
| Hhohho | S1, S2 | **withheld** ("not enough") | shown |
| Manzini | S3 | withheld | — (not under this apex) |
| Sector finance | own view: S1, S2, S3 | shown | shown (S1, S2 only) |

`apex` supervises basic sacco (S1), saccocoop (S2), multiP, fsfsfa and testModification. `Test Cooperative SACCO` (S3) is under **Test Apex**, so the apex's averages and reports cover S1 and S2 only.

| KPI | S1 | S2 | S3 | **National average, own view (S1–S3)** | **Apex national = Hhohho average (S1, S2)** | App shows |
|---|---:|---:|---:|---:|---:|---|
| Total assets | 4,198,500 | 6,120,000 | 2,200,000 | 4,172,833 | 5,159,250 | |
| Gross loan portfolio | 3,150,000 | 4,500,000 | 1,850,000 | 3,166,667 | 3,825,000 | |
| Net loan portfolio | 3,058,500 | 4,400,000 | 1,740,000 | 3,066,167 | 3,729,250 | |
| Total member deposits | 3,050,000 | 4,300,000 | 1,650,000 | 3,000,000 | 3,675,000 | |
| Total equity | 838,500 | 1,330,000 | 200,000 | 789,500 | 1,084,250 | |
| Net surplus | 100,000 | 200,000 | -20,000 | 93,333 | 150,000 | |
| PAR 30 (%) | 5.71% | 3.33% | 14.05% | 7.70% | 4.52% | |
| NPL ratio = PAR 90 (%) | 2.38% | 0.89% | 7.57% | 3.61% | 1.63% | |
| Loan loss coverage (%) | 50.83% | 66.67% | 42.31% | 53.27% | 58.75% | |
| ROA (%) | 2.38% | 3.27% | -0.91% | 1.58% | 2.82% | |
| ROE (%) | 11.93% | 15.04% | -10.00% | 5.65% | 13.48% | |
| Operating expense ratio (%) | 7.74% | 7.27% | 9.32% | 8.11% | 7.51% | |
| Capital adequacy (%) | 19.97% | 21.73% | 9.09% | 16.93% | 20.85% | |
| Liquid funds ratio (%) | 18.94% | 19.77% | 12.73% | 17.14% | 19.35% | |
| Operational self-sufficiency (%) | 118.87% | 127.78% | 94.37% | 113.67% | 123.32% | |
| Net interest margin (%) | 10.50% | 10.54% | 9.09% | 10.04% | 10.52% | |
| Deposits to loans (%) | 96.83% | 95.56% | 89.19% | 93.86% | 96.19% | |
| Institutional capital / assets (%) | 8.78% | 11.11% | -0.91% | 6.33% | 9.94% | |

## B.2 Apex consolidated statements report (2025)

Covers the apex's SACCOs **S1 and S2**. Filing: **2 of 5** cooperatives filed statements (multiP, fsfsfa and testModification file questionnaires and are counted as not filed; see the open question on filing counts). Test Apex's consolidated report covers S3 alone.

| Metric | Sum of S1 + S2 | App shows |
|---|---:|---|
| Total assets | 10,318,500 | |
| Gross loan portfolio | 7,650,000 | |
| Member deposits | 7,350,000 | |
| Total equity | 2,168,500 | |
| Net surplus / (loss) | 300,000 | |
| Total members | 32 | |

| Indicator | Average of ratios | Aggregate (ratio of sums) | App shows |
|---|---:|---:|---|
| PAR > 30 days | 4.52% | 4.31% | |
| Capital adequacy | 20.85% | 21.02% | |
| Return on assets | 2.82% | 2.91% | |
| Return on equity | 13.48% | 13.83% | |
| Operating expense ratio | 7.51% | 7.46% | |
| Loan-loss coverage | 58.75% | 58.03% | |

## B.3 Growth — basic sacco 2025 vs 2024

| Measure | 2024 | 2025 | Change | Change % | App shows |
|---|---:|---:|---:|---:|---|
| Total assets | 3,697,000 | 4,198,500 | 501,500 | 13.57% | |
| Gross loans | 2,740,000 | 3,150,000 | 410,000 | 14.96% | |
| Member deposits (2100) | 2,760,000 | 3,050,000 | 290,000 | 10.51% | |
| Total equity | 604,000 | 838,500 | 234,500 | 38.82% | |
| Net surplus | 80,000 | 100,000 | 20,000 | 25.00% | |

The statement report's FY 2024 column and the scorecard's prior-year column should now show the 2024 values from A.4 instead of “—”.

---

# Part C — Multipurpose questionnaires (2025, yearly)

Only the answers that **differ from multiP** are listed; every other question gets multiP's answer (round 1, parts 2.1 and 2.2). Questions asked in both questionnaires get the **same** answer in both. Test questions marked required (`try_question`, `members`, `dfd`, `capitalization`, `sfgsfsg`) and the `annual_subscription_fee_e` dropdown: same answers as round 1.

## M2 — fsfsfa (Hhohho, transport)

**Financial questionnaire**

| Key | Answer |
|---|---|
| `society_name` | fsfsfa |
| `registration_no` | MPC/HH/2018/112 |
| `common_bond` | Minibus owners and drivers of Mbabane |
| `postal_address` | P.O. Box 1180, Mbabane |
| `physical_address` | Msunduza Taxi Rank Office, Mbabane |
| `email` | office@fsfsfa.co.sz |
| `tel_cell` | +268 2404 5521 |
| `website` | — |
| `office_status` | Rented |
| `inkhundla` | Mbabane East |
| `respondent_name` | Thabo Mamba |
| `respondent_tel` | +268 7688 2210 |
| `members_trained_last_year` | 30 |
| `staff_trained_last_year` | 2 |
| `training_sponsor` | Others |
| `training_quality` | Fair |
| `training_cost_proportion` | 0 |
| `board_male` | 5 |
| `board_female` | 2 |
| `chairperson_education` | Tertiary |
| `manager_academic_level` | Secondary |
| `manager_coop_training` | Short course in cooperative governance (2022) |
| `registered_members_male` | 80 |
| `registered_members_female` | 60 |
| `active_members_male` | 62 |
| `active_members_female` | 48 |
| `age_18_25_male` | 6 |
| `age_18_25_female` | 5 |
| `age_26_35_male` | 18 |
| `age_26_35_female` | 14 |
| `age_36_60_male` | 44 |
| `age_36_60_female` | 33 |
| `age_61plus_male` | 12 |
| `age_61plus_female` | 8 |
| `share_nominal_value` | 200 |
| `total_share_capital` | 84,000 |
| `borrowed_funds_total` | 120,000 |
| `donations_grants` | 10,000 |
| `accumulated_statutory_reserves` | 30,000 |
| `retained_earnings` | 42,000 |
| `savings_accounts_male` | 50 |
| `savings_accounts_female` | 40 |
| `savings_value_male` | 95,000 |
| `savings_value_female` | 70,000 |
| `bank_investment` | 40,000 |
| `share_investment` | 8,000 |
| `other_investments` | 5,000 |
| `loans_issued_male` | 30 |
| `loans_issued_female` | 20 |
| `outstanding_value_male` | 110,000 |
| `outstanding_value_female` | 70,000 |
| `delinquent_value_0_30` | 7,000 |
| `delinquent_value_31_365` | 19,000 |
| `written_off_loans` | 4,000 |
| `avg_loan_term_months` | 18 |
| `avg_interest_rate` | 1.2 |
| `current_total_income` | 520,000 |
| `current_total_expenditure` | 488,000 |
| `current_net_income` | 32,000 |
| `last_total_income` | 470,000 |
| `last_total_expenditure` | 450,000 |
| `non_current_assets` | 420,000 |
| `total_current_assets` | 230,000 |
| `current_liabilities` | 332,000 |
| `total_equity` | 198,000 |
| `challenges` | Fuel price increases; ageing minibus fleet |
| `success_reasons` | Reliable commuter routes; members pool vehicle maintenance |
| `loans_outstanding_count` | 60 |
| `loans_in_arrears_count` | 12 |
| `loans_awaiting_approval` | 4 |
| `female_borrowers_count` | 18 |
| `total_disbursed_active` | 230,000 |
| `par_1_7_value` | 3,000 |
| `par_8_30_value` | 4,000 |
| `par_31_90_value` | 9,000 |
| `par_91_180_value` | 6,000 |
| `par_181_360_value` | 4,000 |
| `par_over_360_value` | 2,000 |
| `interest_in_suspense` | 2,600 |
| `interest_payable` | 1,800 |
| `number_of_groups` | 5 |
| `cash_on_hand` | 12,000 |
| `cash_at_bank_current` | 48,000 |

**Non-financial questionnaire**

| Key | Answer |
|---|---|
| `total_registered_male` | 80 |
| `total_registered_female` | 60 |
| `total_active_male` | 62 |
| `total_active_female` | 48 |
| `age_18_25_male` | 6 |
| `age_18_25_female` | 5 |
| `age_26_35_male` | 18 |
| `age_26_35_female` | 14 |
| `age_36_60_male` | 44 |
| `age_36_60_female` | 33 |
| `age_61plus_male` | 12 |
| `age_61plus_female` | 8 |
| `joining_fee` | 100 |
| `annual_subscription_fee` | 240 |
| `members` | 140 |
| `society_name` | fsfsfa |
| `registration_no` | MPC/HH/2018/112 |
| `common_bond` | Minibus owners and drivers of Mbabane |
| `postal_address` | P.O. Box 1180, Mbabane |
| `physical_address` | Msunduza Taxi Rank Office, Mbabane |
| `office_status` | Rented |
| `affiliated_to` | Hhohho Transport Apex |
| `sub_sector` | Transport – commuter minibuses and haulage |
| `respondent_name` | Thabo Mamba |
| `board_male` | 5 |
| `board_female` | 2 |
| `last_agm_date` | 2025-04-12 |
| `chairperson_education` | Tertiary |
| `agm_attendance_male` | 50 |
| `agm_attendance_female` | 38 |
| `members_trained_last_year` | 30 |
| `leaders_trained_last_year` | 4 |
| `staff_trained_last_year` | 2 |
| `training_sponsor` | Others |
| `training_quality` | Fair |
| `training_cost_proportion` | 0 |
| `share_nominal_value` | 200 |
| `total_share_capital` | 84,000 |
| `borrowed_funds` | 120,000 |
| `donations_grants` | 10,000 |
| `accumulated_book_reserves` | 30,000 |
| `main_activity_1` | Passenger transport |
| `main_activity_1_income` | 380,000 |
| `main_activity_1_expenses` | 352,000 |
| `main_activity_2` | Goods haulage |
| `main_activity_2_income` | 120,000 |
| `main_activity_2_expenses` | 116,000 |
| `creditors_outsiders` | 42,000 |
| `amount_owed_by_members` | 180,000 |
| `number_of_competitors` | 4 |
| `current_total_income` | 520,000 |
| `current_total_expenditure` | 488,000 |
| `current_net_income` | 32,000 |
| `last_total_income` | 470,000 |
| `last_total_expenditure` | 450,000 |
| `non_current_assets` | 420,000 |
| `total_current_assets` | 230,000 |
| `total_liabilities` | 452,000 |
| `total_equity` | 198,000 |
| `challenges` | Fuel price increases; ageing minibus fleet |
| `success_reasons` | Reliable commuter routes; members pool vehicle maintenance |

Consistency: total assets 650,000 = liabilities 452,000 + equity 198,000; equity = shares + reserves + retained + donations + current surplus; outstanding loans 180,000 = amount owed by members.

## M3 — testModification (Manzini, manufacturing)

**Financial questionnaire**

| Key | Answer |
|---|---|
| `society_name` | testModification |
| `registration_no` | MPC/MZ/2019/078 |
| `common_bond` | Carpenters and welders of Manzini |
| `postal_address` | P.O. Box 77, Manzini |
| `physical_address` | Matsapha Industrial Site, Plot 14 |
| `email` | info@testmod.co.sz |
| `tel_cell` | +268 2518 6033 |
| `website` | — |
| `office_status` | Rented |
| `region` | Manzini |
| `inkhundla` | Manzini North |
| `respondent_name` | Nomsa Shongwe |
| `respondent_tel` | +268 7602 9918 |
| `members_trained_last_year` | 12 |
| `staff_trained_last_year` | 1 |
| `training_sponsor` | The Government |
| `training_quality` | Poor |
| `training_cost_proportion` | 10 |
| `board_male` | 3 |
| `board_female` | 4 |
| `exec_male` | 1 |
| `exec_female` | 2 |
| `credit_committee_male` | 1 |
| `credit_committee_female` | 2 |
| `chairperson_education` | Primary |
| `manager_academic_level` | Secondary |
| `manager_coop_training` | None |
| `registered_members_male` | 40 |
| `registered_members_female` | 50 |
| `active_members_male` | 22 |
| `active_members_female` | 32 |
| `age_18_25_male` | 3 |
| `age_18_25_female` | 6 |
| `age_26_35_male` | 8 |
| `age_26_35_female` | 12 |
| `age_36_60_male` | 21 |
| `age_36_60_female` | 24 |
| `age_61plus_male` | 8 |
| `age_61plus_female` | 8 |
| `share_nominal_value` | 50 |
| `total_share_capital` | 27,000 |
| `borrowed_funds_total` | 80,000 |
| `donations_grants` | 45,000 |
| `accumulated_statutory_reserves` | 6,000 |
| `retained_earnings` | -8,000 |
| `savings_accounts_male` | 25 |
| `savings_accounts_female` | 35 |
| `savings_value_male` | 30,000 |
| `savings_value_female` | 48,000 |
| `bank_investment` | 15,000 |
| `share_investment` | 0 |
| `other_investments` | 0 |
| `loans_issued_male` | 15 |
| `loans_issued_female` | 22 |
| `outstanding_value_male` | 40,000 |
| `outstanding_value_female` | 55,000 |
| `delinquent_value_0_30` | 5,500 |
| `delinquent_value_31_365` | 13,500 |
| `written_off_loans` | 6,000 |
| `avg_loan_term_months` | 9 |
| `avg_interest_rate` | 2.0 |
| `current_total_income` | 210,000 |
| `current_total_expenditure` | 224,000 |
| `current_net_income` | -14,000 |
| `last_total_income` | 230,000 |
| `last_total_expenditure` | 221,000 |
| `non_current_assets` | 150,000 |
| `total_current_assets` | 98,000 |
| `current_liabilities` | 112,000 |
| `total_equity` | 56,000 |
| `challenges` | Cheap imported furniture; irregular electricity supply |
| `success_reasons` | Skilled carpenters; contracts with two local schools |
| `loans_outstanding_count` | 37 |
| `loans_in_arrears_count` | 11 |
| `loans_awaiting_approval` | 3 |
| `female_borrowers_count` | 22 |
| `total_disbursed_active` | 120,000 |
| `par_1_7_value` | 2,000 |
| `par_8_30_value` | 3,500 |
| `par_31_90_value` | 6,500 |
| `par_91_180_value` | 4,000 |
| `par_181_360_value` | 3,000 |
| `par_over_360_value` | 2,500 |
| `interest_in_suspense` | 1,700 |
| `interest_payable` | 900 |
| `number_of_groups` | 3 |
| `cash_on_hand` | 6,000 |
| `cash_at_bank_current` | 21,000 |

**Non-financial questionnaire**

| Key | Answer |
|---|---|
| `total_registered_male` | 40 |
| `total_registered_female` | 50 |
| `total_active_male` | 22 |
| `total_active_female` | 32 |
| `age_18_25_male` | 3 |
| `age_18_25_female` | 6 |
| `age_26_35_male` | 8 |
| `age_26_35_female` | 12 |
| `age_36_60_male` | 21 |
| `age_36_60_female` | 24 |
| `age_61plus_male` | 8 |
| `age_61plus_female` | 8 |
| `joining_fee` | 30 |
| `annual_subscription_fee` | 60 |
| `members` | 90 |
| `society_name` | testModification |
| `registration_no` | MPC/MZ/2019/078 |
| `common_bond` | Carpenters and welders of Manzini |
| `postal_address` | P.O. Box 77, Manzini |
| `physical_address` | Matsapha Industrial Site, Plot 14 |
| `region` | Manzini |
| `office_status` | Rented |
| `affiliated_to` | Manzini Artisans Apex |
| `sub_sector` | Manufacturing – furniture and welding |
| `respondent_name` | Nomsa Shongwe |
| `board_male` | 3 |
| `board_female` | 4 |
| `exec_male` | 1 |
| `exec_female` | 2 |
| `last_agm_date` | 2025-06-07 |
| `chairperson_education` | Primary |
| `agm_attendance_male` | 18 |
| `agm_attendance_female` | 27 |
| `members_trained_last_year` | 12 |
| `leaders_trained_last_year` | 2 |
| `staff_trained_last_year` | 1 |
| `training_sponsor` | The Government |
| `training_quality` | Poor |
| `training_cost_proportion` | 10 |
| `share_nominal_value` | 50 |
| `total_share_capital` | 27,000 |
| `borrowed_funds` | 80,000 |
| `donations_grants` | 45,000 |
| `accumulated_book_reserves` | 6,000 |
| `main_activity_1` | Furniture making |
| `main_activity_1_income` | 150,000 |
| `main_activity_1_expenses` | 158,000 |
| `main_activity_2` | Welding services |
| `main_activity_2_income` | 50,000 |
| `main_activity_2_expenses` | 52,000 |
| `creditors_outsiders` | 31,000 |
| `amount_owed_by_members` | 95,000 |
| `number_of_competitors` | 6 |
| `current_total_income` | 210,000 |
| `current_total_expenditure` | 224,000 |
| `current_net_income` | -14,000 |
| `last_total_income` | 230,000 |
| `last_total_expenditure` | 221,000 |
| `non_current_assets` | 150,000 |
| `total_current_assets` | 98,000 |
| `total_liabilities` | 192,000 |
| `total_equity` | 56,000 |
| `challenges` | Cheap imported furniture; irregular electricity supply |
| `success_reasons` | Skilled carpenters; contracts with two local schools |

Consistency: total assets 248,000 = liabilities 192,000 + equity 56,000; equity = shares + reserves + retained + donations + current surplus; outstanding loans 95,000 = amount owed by members.

## C.1 Expected dashboard boxes

| Box | M1 multiP | M2 fsfsfa | M3 testModification | App shows |
|---|---:|---:|---:|---|
| Total assets | 586,500 | 650,000 | 248,000 | |
| Gross loans | 220,000 | 180,000 | 95,000 | |
| Member deposits | 260,500 | 165,000 | 78,000 | |
| Net surplus | 40,500 | 32,000 | -14,000 | |
| Loans overdue > 30 days (%) | 6.14% | 11.67% | 16.84% | |
| Institutional capital (%) | 15.43% | 12.62% | 17.34% | |

## C.2 Expected indicators

| Indicator | M1 | M2 | M3 | **Apex consolidated (sums)** | App shows |
|---|---:|---:|---:|---:|---|
| Active members (%) | 78.18% | 78.57% | 60.00% | 74.67% | |
| Women members (%) | 55.45% | 42.86% | 55.56% | 51.56% | |
| Youth members 18-35 (%) | 30.91% | 30.71% | 32.22% | 31.11% | |
| Female active members (%) | 56.98% | 43.64% | 59.26% | 52.98% | |
| Women on board (%) | 42.86% | 28.57% | 57.14% | 42.86% | |
| AGM attendance (%) | 63.64% | 62.86% | 50.00% | 60.67% | |
| Member training coverage (%) | 20.45% | 21.43% | 13.33% | 19.33% | |
| Leadership training coverage (%) | 71.43% | 57.14% | 28.57% | 52.38% | |
| Main activity operating margin (%) | 12.76% | 6.40% | -5.00% | 6.53% | |
| Total operating margin (%) | 9.83% | 6.15% | -6.67% | 5.12% | |
| Savings account penetration (%) | 73.18% | 64.29% | 66.67% | 69.11% | |
| Average savings per depositor (SZL) | SZL 1,618.01 | SZL 1,833.33 | SZL 1,300.00 | SZL 1,618.97 | |
| Average savings per male depositor (SZL) | SZL 1,600.00 | SZL 1,900.00 | SZL 1,200.00 | SZL 1,634.48 | |
| Average savings per female depositor (SZL) | SZL 1,631.87 | SZL 1,750.00 | SZL 1,371.43 | SZL 1,605.42 | |
| PAR > 30 days (%) | 6.14% | 11.67% | 16.84% | 10.20% | |
| Delinquent loan account rate (%) | 17.07% | 20.00% | 29.73% | 20.67% | |

The consolidated column (apex Basic Analytics and the consolidated questionnaire report) **adds the figures of the three cooperatives first, then computes each ratio** — it is not an average of the three ratios.

Consolidated totals: registered members 450, active 336, savings value 503,500, outstanding loans 495,000, overdue > 30 days 50,500.

## C.3 Basic Benchmarking averages

| Average | Cooperatives | Cooperative's own view (≥ 3) | Apex view (≥ 2) |
|---|---|---|---|
| National | M1, M2, M3 | shown | shown |
| Hhohho | M1, M2 | **withheld** | shown |
| Sector | one each | withheld | withheld |

| Metric | M1 | M2 | M3 | **National average** | **Hhohho average (M1, M2)** | App shows |
|---|---:|---:|---:|---:|---:|---|
| Registered members | 220 | 140 | 90 | 150.00 | 180.00 | |
| Active members | 172 | 110 | 54 | 112.00 | 141.00 | |
| Male members | 98 | 80 | 40 | 72.67 | 89.00 | |
| Female members | 122 | 60 | 50 | 77.33 | 91.00 | |
| Members aged 18-25 | 20 | 11 | 9 | 13.33 | 15.50 | |
| Members aged 26-35 | 48 | 32 | 20 | 33.33 | 40.00 | |
| Members aged 36-60 | 116 | 77 | 45 | 79.33 | 96.50 | |
| Members aged 61+ | 36 | 20 | 16 | 24.00 | 28.00 | |
| Share capital | 66,000 | 84,000 | 27,000 | 59,000.00 | 75,000.00 | |
| Borrowed funds | 50,000 | 120,000 | 80,000 | 83,333.33 | 85,000.00 | |
| Savings value | 260,500 | 165,000 | 78,000 | 167,833.33 | 212,750.00 | |
| Outstanding loans | 220,000 | 180,000 | 95,000 | 165,000.00 | 200,000.00 | |
| Total income | 412,000 | 520,000 | 210,000 | 380,666.67 | 466,000.00 | |
| Total expenditure | 371,500 | 488,000 | 224,000 | 361,166.67 | 429,750.00 | |
| Net income | 40,500 | 32,000 | -14,000 | 19,500.00 | 36,250.00 | |

---

# Part D — Where to check

| Screen | Who | Compare with |
|---|---|---|
| Cooperative dashboards | each new cooperative | A.4 / C.1 |
| Submission detail: grid, reconciliation | each new SACCO return | A.3, A.5 |
| Submission detail: monthly columns | S2-2024Q4 | A.2 (October, November, December) |
| Analytics (own) | each SACCO | A.4 |
| Basic Analytics (own) | each multipurpose | C.2 |
| Analytics / Basic Analytics (apex) | apex | B.2 / C.2 consolidated column |
| Benchmarking (own) | a SACCO | B.1 national shown, Hhohho withheld |
| Benchmarking (apex) | apex | B.1 national and Hhohho both shown |
| Basic Benchmarking | a multipurpose cooperative, apex | C.3 |
| Statement report | basic sacco 2025 | B.3 prior-year column and growth |
| Consolidated reports (both editions) | apex | B.2 / C.2 consolidated column |

---

# Part E — Cross-check result (16 October 2026)

All five returns were submitted and approved. S3 (Test Cooperative SACCO) was not entered: it is under Test Apex, whose login was not available.

| Check | Result |
|---|---|
| Stored KPIs of S1, S2, S1-2024, S2-2024Q4 (17 each, A.4) | ✅ 68 / 68 match, including the quarterly return (balance sheet at December, flows added over the quarter, not annualised) |
| Questionnaire indicators of M1, M2, M3 and the apex consolidated view (C.2) | ✅ 16 × 4 match; dashboard balance boxes (C.1) match |
| Basic Benchmarking, cooperative's view (C.3) | ✅ national average shown, all 15 values match; Hhohho and sector withheld |
| Benchmarking, cooperative's view (B.1) | ✅ national average withheld — only 2 SACCOs reported (S3 missing) |
| Benchmarking, apex view (B.1) | ✅ average of S1 and S2 matches (assets 5.16M, PAR 4.52%, capital 20.85%, coverage 58.75%) |
| Analytics, apex view | ✅ 2 SACCOs, 32 members, assets 10.3M, equity/assets 21.0% |
| basic sacco 2025 report: prior-year column and growth (B.3) | ✅ assets +13.6%, loans +15.0%, savings +10.5%, equity +38.8%, surplus +25.0%; 2024 ratios match A.4 |
| Apex consolidated statements report (B.2) | ✅ sums and both kinds of ratio match |
| Apex consolidated questionnaire report (C.2) | ✅ all indicators match the consolidated column |

**Problems found and fixed:** consolidated reports showed 0 active borrowers (read a figure name that is never stored); submissions approved by the apex on submit had no review date; the review page called a quarter's totals "Annual (12-Mo Sum)".

**Open questions (no change made):**

| # | Where | Question |
|---|---|---|
| Q1 | Apex consolidated statements report | The "prior year" adds basic sacco's **full 2024** to saccocoop's **2024 Q4 only**, so prior-year surplus is 80,000 + 50,100 = 130,100 and surplus "grows" +130.6%. Should a quarterly return count as a prior year, or only yearly returns? |
| Q2 | Benchmarking table | The status chip shows the legend text ("10–20% — WATCH") rather than the size of the gap: a −2.2% gap reads "10–20% — WATCH". Negative money variances are not shortened ("SZL -960750.00") |
| Q3 | Filing counts | Each consolidated edition counts the other method's cooperatives as "not filed" (statements report: 2 of 5; questionnaire report: 3 of 5) |

---

# Part F — Open for discussion: comparing different periods

Found while cross-checking; **not changed yet**, to be agreed first.

- The manual-entry page lets the user change frequency, period, calendar/fiscal year and start month after the submission is created, and saving overwrites the submission's period without the "one frequency per year" check.
- "Prior year" in a cooperative's report takes any submission of the previous year (a quarter, a draft or a rejected one); the apex consolidated report uses full-year returns for the current year but any period for the prior year (the +130.6% surplus in Q1 above).
- Yearly analytics, benchmarking and averages left on "Latest available" can mix a quarter's income with other cooperatives' full year; trend charts can put yearly and quarterly points on one line; fiscal-year cooperatives close their books on a different date.

Balance-sheet figures (as at a date) can be compared across frequencies when the dates match; income-based figures (surplus, ROA, ROE, cost and margin ratios) only between periods of the same length.
