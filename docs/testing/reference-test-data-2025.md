# Reference Test Data — 2025 (Yearly)

> **Purpose:** controlled test data with known figures, to cross-check every number the app shows (dashboards, analytics, benchmarking, reports, exports).
> **Cooperatives:** `basic sacco` (SACCO, manual entry) and `multiP` (multipurpose, questionnaire). Both Hhohho.
> **Status:** entered as **drafts**; submitted and approved by the tester.

Expected values are calculated with the app's own formulas (`backend/src/services/kpi_engine.rs` for financial statements, `backend/src/services/questionnaire_kpi/` for questionnaires). Amounts in SZL (E).

Fill the **App shows** column during the cross-check: ✅ matches, ❌ differs (note the value).

---

## ⚠️ Known problems to expect

| # | Where | Problem | Effect in this test |
|---|---|---|---|
| P1 | SACCO manual entry | The grid shows total assets as liquid + loans − provisions + other (depreciation subtracted), but the wizard **saves** provisions and depreciation **added** (`ManualEntryWizard.tsx` 1300 / 1999 rollups) | Grid shows **4,198,500**; app KPIs use **4,661,500**. Every ratio based on total assets is off. **Confirmed, and worse:** with positive provisions/depreciation the wizard header shows “Period Ends Gap: 463,000” and **refuses to continue**, while the grid's own balance check passes. **Fixed:** every place now subtracts them (sign ignored); saved 1999 = 4,198,500 |
| P2 | Multipurpose questionnaire | Members are asked in **both** questionnaires under different keys, and the calculation **adds** them (`inputs.rs` `reg_m: sum [...]`) | Registered members **220** counted as **440**; indicators divided by registered members are halved. **Fixed:** member counts now take one answer, and the questionnaire analytics totals merge each submission's questionnaires first; all 16 indicators match the “Correct” column |
| P3 | SACCO reconciliation | The savings ledger (voluntary **and** mandatory accounts) is compared with **2101 voluntary savings only** | Savings row shows a variance even though the books are right. **Fixed:** voluntary is checked against 2101 and mandatory against 2102; all rows reconcile |
| P4 | Questionnaire templates | Test questions marked **required** (`try_question`, `members`, `dfd`, `capitalization`, `sfgsfsg`) | Answered with plausible text |
| P5 | Non-financial template | Required dropdown `annual_subscription_fee_e` (“New Section”) had **no options** | **Confirmed:** “Complete” was refused. Unblocked by adding options 100 / 200 in the template editor |
| P7 | SACCO manual entry | The review page read December for the balance sheet and months 1–12 for income, but a yearly return is typed in the Annual Total column (month 0) | Review showed **SZL 0.00** everywhere. **Fixed:** it shows 4,198,500 / 3,360,000 / 838,500 / income 630,000 / expenses 530,000 / surplus 100,000 |
| P8 | Benchmarking | With too few cooperatives the average is withheld, but the table compared against 0 ("+220", Healthy/Watch) | **Fixed:** "—" for average, variance and status |
| P9 | Submissions | "Filed on" was never recorded | **Fixed:** filing and review dates recorded; migration 61 restores old ones |
| P10 | Reports | "Apex organisation —" on every report | **Fixed:** apex name included |
| P11 | Reports | Report printed SUB-2025-CB675 instead of the reference SUB-2025-00002 | **Fixed** |
| P12 | Questionnaire report | "backed by actual bank funds at —", "— is distributed to members" | **Fixed:** says "not reported" |
| P13 | Apex benchmarking | One cooperative compared with an "average" of itself ("0.0% above") | **Fixed:** average withheld below 2 cooperatives |
| P14 | Analytics | Register averages shown as "Avg: $131500", loan chart "($K)" | **Fixed:** SZL |
| P15 | Analytics | "Inactive" savings accounts and "Decreasing" balances (the entry page's words) not counted | **Fixed:** dormant savings 5.0% (was 0.0%) |
| P16 | Analytics | Currency chip said "ZAR" | **Fixed:** SZL |
| P17 | Statement report | Report check counted provisions/depreciation as assets → false "inconsistency" in Annex A | **Fixed** |
| P18 | Statement report | Prior-year totals showed 0 instead of "—" | **Fixed** |
| P19 | Statement report | PDF generation fails when the AI narrative service errors (local AI key rejected, 401); the questionnaire report continues without AI text | **Fixed:** produced without the AI commentary; the local AI key still needs replacing to get the commentary back |
| P6 | Questionnaire form | The active template is cached in the browser for 5 minutes (and kept across reloads) | **Confirmed:** after the template change, the cooperative still saw the empty dropdown until the cache expired |

---

# Part 1 — SACCO (`basic sacco`, manual entry)

Period: **2025, Yearly**, accounting year: calendar. Figures typed in the **Annual Total** column, as positive numbers (provisions and depreciation too, as the grid presents them).

## 1.1 Financial statement — inputs

| Code | Account | Amount |
|---|---|---:|
| 1101 | Cash on hand | 45,000 |
| 1102 | Cash at bank (current) | 180,000 |
| 1103 | Cash at bank (savings) | 320,000 |
| 1104 | Short-term investments | 250,000 |
| 1201 | Performing loan portfolio | 2,850,000 |
| 1202 | Loans in arrears 1-30 days | 120,000 |
| 1203 | Loans in arrears 31-60 days | 65,000 |
| 1204 | Loans in arrears 61-90 days | 40,000 |
| 1205 | Non-performing loans (91+) | 75,000 |
| 1251 | General loan loss provision | 31,500 |
| 1252 | Specific loan loss provision | 60,000 |
| 1301 | Accounts receivable | 35,000 |
| 1302 | Prepaid expenses | 12,000 |
| 1303 | Fixed assets (cost) | 420,000 |
| 1304 | Accumulated depreciation | 140,000 |
| 1305 | Intangible assets | 18,000 |
| 2101 | Voluntary savings | 1,650,000 |
| 2102 | Mandatory savings | 980,000 |
| 2103 | Fixed-term deposits | 420,000 |
| 2201 | Short-term borrowings | 50,000 |
| 2202 | Long-term borrowings | 200,000 |
| 2301 | Accounts payable | 28,000 |
| 2302 | Accrued expenses | 22,000 |
| 2303 | Deferred income | 10,000 |
| 3101 | Permanent share capital | 350,000 |
| 3102 | Withdrawable shares | 120,000 |
| 3201 | Statutory reserve | 140,000 |
| 3202 | General reserve | 45,000 |
| 3203 | Risk/capital adequacy reserve | 30,000 |
| 3301 | Accumulated surplus | 53,500 |
| 3302 | Current year surplus | 100,000 |
| 4101 | Interest income from loans | 560,000 |
| 4102 | Fees & commissions income | 48,000 |
| 4201 | Other operating income | 22,000 |
| 5101 | Interest expense on deposits | 145,000 |
| 5102 | Interest expense on borrowings | 22,000 |
| 5201 | Personnel costs | 180,000 |
| 5202 | Administrative expenses | 75,000 |
| 5203 | Governance expenses | 28,000 |
| 5204 | Depreciation & amortization | 42,000 |
| 5301 | Loan loss provision expense | 38,000 |

**Totals the grid should display:**

| Total | Value |
|---|---:|
| Liquid assets (1100) | 795,000 |
| Loans & advances (1200) | 3,150,000 |
| Allowance for loan losses (1250) | 91,500 |
| Other assets (1300) | 345,000 |
| **Total assets (1999)** | 4,198,500 |
| Member deposits (2100) | 3,050,000 |
| Borrowings (2200) | 250,000 |
| Other liabilities (2300) | 60,000 |
| **Total liabilities (2999)** | 3,360,000 |
| **Total equity (3999)** | 838,500 |
| Total income (4999) | 630,000 |
| Total expenses (5999) | 530,000 |
| **Net surplus (6999)** | 100,000 |

Balance check: assets 4,198,500 = liabilities 3,360,000 + equity 838,500 ✅

## 1.2 Expected KPIs (dashboard, analytics, reports)

Correct values use total assets **4,198,500**. With **P1** fixed the app uses it too, so expect the “Correct” column; the “P1” column shows what the app would have shown before the fix.

| KPI | Formula | Correct | Before the P1 fix | App shows |
|---|---|---:|---:|---|
| Total assets | 1999 | SZL 4.2M | SZL 4.7M ⚠️  | ✅ |
| Gross loan portfolio | 1200 | SZL 3.1M | SZL 3.1M  | ✅ |
| Net loan portfolio | 1200 − provisions | SZL 3.1M | SZL 3.1M  | ✅ |
| Total member deposits | 2100 | SZL 3.0M | SZL 3.0M  | ✅ |
| Total equity | 3999 | SZL 838K | SZL 838K  | ✅ |
| Net surplus | income − expenses | SZL 100K | SZL 100K  | ✅ |
| PAR 30 | (1203+1204+1205)/1200 | 5.71% | 5.71%  | ✅ |
| PAR 90 = NPL ratio | 1205/1200 | 2.38% | 2.38%  | ✅ |
| Loan loss coverage | provisions/(1203+1204+1205) | 50.83% | 50.83%  | ✅ |
| ROA | net surplus/total assets | 2.38% | 2.15% ⚠️  | ✅ |
| ROE | net surplus/equity | 11.93% | 11.93%  | ✅ |
| Operating expense ratio | (5201..5204)/total assets | 7.74% | 6.97% ⚠️  | ✅ |
| Capital adequacy | equity/total assets | 19.97% | 17.99% ⚠️  | ✅ |
| Liquid funds ratio | liquid assets/total assets | 18.94% | 17.05% ⚠️  | ✅ |
| Operational self-sufficiency | income/expenses | 118.87% | 118.87%  | ✅ |
| Net interest margin | (fin. income − fin. expenses)/total assets | 10.50% | 9.46% ⚠️  | ✅ |
| Deposits to loans | 2100/1200 | 96.83% | 96.83%  | ✅ |

Dashboard boxes show: Total assets, Gross loans, Member deposits, Net surplus, NPL ratio (benchmark 2%), Capital adequacy (benchmark 10%). Loan quality chart: performing 94.3%, watch list 3.3%, non-performing 2.4%.

## 1.3 Members register (20)

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
| M018 | 2018-04-16 | Dormant | — | Male | 50+ | Hhohho | Rural | No | No | 16,000 |
| M019 | 2020-12-01 | Dormant | — | Female | 36-50 | Hhohho | Urban | No | No | 13,000 |
| M020 | 2017-02-22 | Exited | 2025-06-30 | Male | 50+ | Hhohho | Rural | No | No | 20,000 |

## 1.4 Savings accounts (20)

All: zero-balance flag No, emergency withdrawals No, withdrawal frequency Low. Rates are typed as percents (4.5 means 4.5%).

| Account | Member | Type | Opened | Status | Frequency | Last contribution | # contributions | Trend | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---|---:|---:|
| S001 | M001 | Voluntary | 2016-03-14 | Active | Monthly | 2025-12-28 | 12 | Increasing | 4.5 | 210,000 |
| S002 | M002 | Voluntary | 2016-03-14 | Active | Monthly | 2025-12-27 | 12 | Stable | 4.5 | 185,000 |
| S003 | M003 | Voluntary | 2017-06-02 | Active | Monthly | 2025-12-20 | 11 | Increasing | 4.5 | 160,000 |
| S004 | M004 | Voluntary | 2017-09-20 | Active | Weekly | 2025-12-29 | 48 | Increasing | 4.5 | 95,000 |
| S005 | M005 | Voluntary | 2018-01-11 | Active | Monthly | 2025-12-15 | 12 | Stable | 4.5 | 140,000 |
| S006 | M006 | Voluntary | 2018-05-30 | Active | Monthly | 2025-12-30 | 12 | Increasing | 4.5 | 175,000 |
| S007 | M008 | Voluntary | 2019-07-07 | Active | Monthly | 2025-12-22 | 10 | Stable | 4.5 | 120,000 |
| S008 | M010 | Voluntary | 2020-04-03 | Active | Monthly | 2025-12-18 | 12 | Increasing | 4.5 | 150,000 |
| S009 | M013 | Voluntary | 2021-06-15 | Active | Irregular | 2025-11-30 | 7 | Decreasing | 4.5 | 85,000 |
| S010 | M015 | Voluntary | 2022-09-12 | Active | Monthly | 2025-12-26 | 12 | Increasing | 4.5 | 135,000 |
| S011 | M016 | Voluntary | 2023-03-21 | Active | Weekly | 2025-12-29 | 50 | Increasing | 4.5 | 70,000 |
| S012 | M018 | Voluntary | 2018-04-16 | Inactive | Irregular | 2024-08-14 | 0 | Stable | 4.5 | 125,000 |
| S013 | M001 | Mandatory | 2016-03-14 | Active | Monthly | 2025-12-28 | 12 | Increasing | 6.0 | 150,000 |
| S014 | M002 | Mandatory | 2016-03-14 | Active | Monthly | 2025-12-27 | 12 | Increasing | 6.0 | 145,000 |
| S015 | M005 | Mandatory | 2018-01-11 | Active | Monthly | 2025-12-15 | 12 | Stable | 6.0 | 120,000 |
| S016 | M007 | Mandatory | 2019-02-18 | Active | Monthly | 2025-12-10 | 12 | Stable | 6.0 | 95,000 |
| S017 | M009 | Mandatory | 2019-11-25 | Active | Monthly | 2025-12-21 | 12 | Increasing | 6.0 | 110,000 |
| S018 | M011 | Mandatory | 2020-08-19 | Active | Monthly | 2025-12-19 | 12 | Stable | 6.0 | 130,000 |
| S019 | M012 | Mandatory | 2021-01-28 | Active | Monthly | 2025-12-24 | 12 | Increasing | 6.0 | 105,000 |
| S020 | M014 | Mandatory | 2022-02-09 | Active | Monthly | 2025-12-23 | 11 | Stable | 6.0 | 125,000 |

Voluntary total 1,650,000 (= 2101) · Mandatory total 980,000 (= 2102) · Ledger total 2,630,000

## 1.5 Loans (12)

All: restructured No, early settlement No, multiple loans No, large borrower No.

| Loan | Member | Product | Start | Maturity | Status | Borrower | Days past due | Missed | Amount | Balance | Rate % | Women | Youth | Rural |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|---|
| L001 | M001 | Business | 2024-03-01 | 2027-02-28 | Performing | Individual | 0 | 0 | 600,000 | 430,000 | 18 | Yes | No | No |
| L002 | M002 | Personal | 2024-07-15 | 2026-07-14 | Performing | Individual | 0 | 0 | 350,000 | 220,000 | 18 | No | No | No |
| L003 | M003 | Agriculture | 2025-02-10 | 2027-02-09 | Performing | Individual | 0 | 0 | 500,000 | 410,000 | 16 | Yes | No | Yes |
| L004 | M005 | Business | 2023-11-20 | 2026-11-19 | Performing | Individual | 0 | 0 | 700,000 | 380,000 | 18 | No | No | Yes |
| L005 | M006 | Education | 2025-01-05 | 2026-12-31 | Performing | Individual | 0 | 0 | 300,000 | 240,000 | 15 | Yes | No | Yes |
| L006 | M008 | Business | 2024-09-01 | 2027-08-31 | Performing | Individual | 0 | 0 | 650,000 | 520,000 | 18 | Yes | No | No |
| L007 | M010 | Personal | 2025-04-01 | 2027-03-31 | Performing | Individual | 0 | 0 | 400,000 | 350,000 | 18 | No | No | No |
| L008 | M015 | Agriculture | 2025-05-12 | 2027-05-11 | Performing | Group | 0 | 0 | 350,000 | 300,000 | 16 | No | No | Yes |
| L009 | M004 | Personal | 2024-10-01 | 2026-09-30 | Arrears | Individual | 1-30 | 1 | 180,000 | 120,000 | 18 | Yes | Yes | No |
| L010 | M009 | Agriculture | 2024-06-15 | 2026-06-14 | Arrears | Individual | 31-60 | 2 | 110,000 | 65,000 | 16 | Yes | Yes | Yes |
| L011 | M012 | Personal | 2024-02-01 | 2026-01-31 | Arrears | Individual | 61-90 | 3 | 90,000 | 40,000 | 18 | No | Yes | No |
| L012 | M017 | Business | 2023-08-10 | 2025-08-09 | Arrears | Individual | 91+ | 5 | 150,000 | 75,000 | 18 | No | No | No |

Loan book total 3,150,000 (= 1200) · by days past due: 0 → 2,850,000, 1-30 → 120,000, 31-60 → 65,000, 61-90 → 40,000, 91+ → 75,000

## 1.6 Fixed deposits (5)

All: early withdrawal No, rollover at maturity Yes, renewals 0, single depositor dependency No.

| FD | Member | Type | Start | Maturity | Status | Tenure | Rate % | Balance |
|---|---|---|---|---|---|---|---:|---:|
| FD001 | M001 | Premium | 2025-01-10 | 2026-01-09 | Active | ShortTerm | 7.0 | 120,000 |
| FD002 | M002 | Standard | 2024-07-01 | 2026-06-30 | Active | MediumTerm | 7.5 | 80,000 |
| FD003 | M006 | Standard | 2025-03-15 | 2026-03-14 | Active | ShortTerm | 7.0 | 60,000 |
| FD004 | M010 | Special | 2023-10-01 | 2026-09-30 | Active | LongTerm | 8.5 | 100,000 |
| FD005 | M015 | Standard | 2025-06-01 | 2026-05-31 | Active | ShortTerm | 7.0 | 60,000 |

Total 420,000 (= 2103)

## 1.7 Expected register figures

| Figure | Expected | App shows |
|---|---:|---|
| Members (all) | 20  | ✅ |
| Active members | 17  | ✅ |
| Female members | 11  | ✅ |
| Male members | 9  | ✅ |
| Members aged 18-35 | 6  | ✅ |
| Rural members | 9  | ✅ |
| Attended AGM | 13  | ✅ |
| Voted | 12  | ✅ |
| Share register total | 350,000  | ✅ |
| Savings accounts | 20  | ✅ |
| Savings ledger total | 2,630,000  | ✅ |
| Loans | 12  | ✅ |
| Loan book total | 3,150,000  | ✅ |
| Loans to women | 6  | ✅ |
| Youth borrowers | 3  | ✅ |
| Loans in arrears | 4  | ✅ |
| Fixed deposits | 5  | ✅ |
| Fixed deposits total | 420,000  | ✅ |

**Reconciliation card (register vs balance sheet):**

| Row | Register | Account | Expected |
|---|---:|---:|---|
| Member share capital | 350,000 | 3101 = 350,000 | match |
| Voluntary savings | 1,650,000 | 2101 = 1,650,000 | match (P3 fixed) |
| Mandatory savings | 980,000 | 2102 = 980,000 | match (P3 fixed) |
| Performing loan portfolio | 3,150,000 | 1200 = 3,150,000 | match |
| Fixed term deposits | 420,000 | 2103 = 420,000 | match |

---

## 1.8 Cross-check result (SACCO, 15 October 2026)

Dashboard, Analytics (cooperative and apex), Benchmarking (28 figures), submission detail (grid totals, reconciliation now fully reconciled), the statement report and the apex consolidated statements report all match. Problems found on the way: P14–P19.

# Part 2 — Multipurpose (`multiP`, questionnaire)

Period: **2025, Yearly**. Both questionnaires filled completely. Where both ask the same thing, the answers are identical.

## 2.1 Financial questionnaire — inputs

**General Information**

| Key | Question | Answer |
|---|---|---|
| `society_name` | Name of Society | multiP |
| `registration_no` | Registration No | MPC/HH/2016/045 |
| `reg_status` | Registration Status | Fully |
| `common_bond` | Common Bond | Smallholder farmers of Ntfonjeni area |
| `postal_address` | Postal Address | P.O. Box 214, Piggs Peak |
| `physical_address` | Physical Address | Ntfonjeni Community Centre, Hhohho |
| `email` | Email | info@multip.co.sz |
| `tel_cell` | Tel/Cell (Society) | +268 2437 1180 |
| `website` | Website | www.multip.co.sz |
| `office_status` | Society Office Is? | Owned |
| `region` | Region | Hhohho |
| `inkhundla` | Inkhundla | Ntfonjeni |
| `respondent_name` | Respondent Name | Sibusiso Dlamini |
| `respondent_position` | Position | Secretary / Manager |
| `respondent_tel` | Tel/Cell | +268 7612 3456 |
| `sfgsfsg` | sfgsfsg (required test question) | Not applicable |

**Training & Capacity**

| Key | Question | Answer |
|---|---|---|
| `members_trained_last_year` | Members Trained Last Year | 45 |
| `staff_trained_last_year` | Staff Trained Last Year | 3 |
| `training_sponsor` | Who Mainly Sponsored Training? | Apex |
| `training_quality` | Training Quality Rating | Good |
| `training_cost_proportion` | Training Cost Coverage (%) | 40 |

**Leadership & Management**

| Key | Question | Answer |
|---|---|---|
| `board_male` | Board – Male | 4 |
| `board_female` | Board – Female | 3 |
| `exec_male` | Executive – Male | 2 |
| `exec_female` | Executive – Female | 1 |
| `credit_committee_male` | Credit Committee – Male | 2 |
| `credit_committee_female` | Credit Committee – Female | 1 |
| `chairperson_education` | Chairperson Highest Education | Secondary |
| `manager_academic_level` | Manager Academic Level | Tertiary |
| `manager_coop_training` | Manager Cooperative Training | Certificate in Cooperative Management (2019) |

**SACCO Membership**

| Key | Question | Answer |
|---|---|---|
| `registered_members_male` | Registered – Male | 98 |
| `registered_members_female` | Registered – Female | 122 |
| `active_members_male` | Active – Male | 74 |
| `active_members_female` | Active – Female | 98 |
| `age_18_25_male` | Age 18-25 – Male | 8 |
| `age_18_25_female` | Age 18-25 – Female | 12 |
| `age_26_35_male` | Age 26-35 – Male | 20 |
| `age_26_35_female` | Age 26-35 – Female | 28 |
| `age_36_60_male` | Age 36-60 – Male | 52 |
| `age_36_60_female` | Age 36-60 – Female | 64 |
| `age_61plus_male` | Age 61+ – Male | 18 |
| `age_61plus_female` | Age 61+ – Female | 18 |
| `society_status` | Society Status | Active |

**Capitalization**

| Key | Question | Answer |
|---|---|---|
| `share_nominal_value` | Share Nominal Value (E) | 100 |
| `total_share_capital` | Total Share Capital (E) | 66,000 |
| `borrowed_funds_total` | Borrowed Funds – Total (E) | 50,000 |
| `donations_grants` | Donations/Grants (E) | 30,000 |
| `accumulated_statutory_reserves` | Accumulated Statutory Reserves (E) | 24,000 |
| `retained_earnings` | Retained Earnings (E) | 36,500 |

**Savings Portfolio**

| Key | Question | Answer |
|---|---|---|
| `savings_accounts_male` | Savings Accounts – Male | 70 |
| `savings_accounts_female` | Savings Accounts – Female | 91 |
| `savings_value_male` | Net Savings – Male (E) | 112,000 |
| `savings_value_female` | Net Savings – Female (E) | 148,500 |
| `bank_investment` | Money in Bank (E) | 80,000 |
| `share_investment` | Money in Shares (E) | 15,000 |
| `other_investments` | Other Investments (E) | 10,000 |

**Loan Portfolio**

| Key | Question | Answer |
|---|---|---|
| `loans_issued_male` | Loan Accounts Issued – Male | 38 |
| `loans_issued_female` | Loan Accounts Issued – Female | 52 |
| `outstanding_value_male` | Outstanding Loans – Male (E) | 96,000 |
| `outstanding_value_female` | Outstanding Loans – Female (E) | 124,000 |
| `delinquent_value_0_30` | Delinquent 0–30 Days (E) | 9,800 |
| `delinquent_value_31_365` | Delinquent 31–365 Days (E) | 12,500 |
| `written_off_loans` | Written-off Loans (E) | 2,500 |
| `avg_loan_term_months` | Average Loan Term (Months) | 12 |
| `avg_interest_rate` | Average Interest Rate (% per month) | 1.5 |
| `interest_rate_method` | Interest Rate Method | Declining balance |

**Financial Performance**

| Key | Question | Answer |
|---|---|---|
| `current_total_income` | Current Year Total Income (E) | 412,000 |
| `current_total_expenditure` | Current Year Total Expenditure (E) | 371,500 |
| `current_net_income` | Current Year Net Income (E) | 40,500 |
| `last_total_income` | Last Year Total Income (E) | 386,000 |
| `last_total_expenditure` | Last Year Total Expenditure (E) | 352,300 |
| `non_current_assets` | Non-Current Assets (E) | 185,000 |
| `total_current_assets` | Total Current Assets (E) | 401,500 |
| `current_liabilities` | Current Liabilities (E) | 339,500 |
| `total_equity` | Total Equity (E) | 197,000 |
| `challenges` | Main Challenges | Late loan repayments in the dry season; limited storage for harvested maize |
| `success_reasons` | Main Success Reasons | Strong member participation; bulk purchasing of seed and fertiliser |

**Loan Quality & Arrears**

| Key | Question | Answer |
|---|---|---|
| `loans_outstanding_count` | Loans Outstanding | 82 |
| `loans_in_arrears_count` | Loans in Arrears | 14 |
| `loans_awaiting_approval` | Loans Awaiting Approval | 6 |
| `female_borrowers_count` | Female Borrowers | 48 |
| `total_disbursed_active` | Total Disbursed on Active Loans (E) | 265,000 |
| `par_1_7_value` | Overdue 1–7 Days (E) | 4,200 |
| `par_8_30_value` | Overdue 8–30 Days (E) | 5,600 |
| `par_31_90_value` | Overdue 31–90 Days (E) | 7,500 |
| `par_91_180_value` | Overdue 91–180 Days (E) | 3,200 |
| `par_181_360_value` | Overdue 181–360 Days (E) | 1,800 |
| `par_over_360_value` | Overdue Over 360 Days (E) | 1,000 |
| `interest_in_suspense` | Interest in Suspense (E) | 1,900 |
| `interest_payable` | Interest Payable (E) | 2,400 |
| `total_overdrafts` | Total Overdrafts (E) | 0 |
| `number_of_groups` | Number of Member Groups | 9 |

**Liquidity & Cash**

| Key | Question | Answer |
|---|---|---|
| `cash_on_hand` | Cash on Hand (E) | 18,500 |
| `cash_at_bank_current` | Cash at Bank – Current (E) | 63,000 |

## 2.2 Non-financial questionnaire — inputs

**Membership Data**

| Key | Question | Answer |
|---|---|---|
| `society_status` | Society Status | Active |
| `total_registered_male` | Registered – Male | 98 |
| `total_registered_female` | Registered – Female | 122 |
| `total_active_male` | Active – Male | 74 |
| `total_active_female` | Active – Female | 98 |
| `age_18_25_male` | Age 18-25 – Male | 8 |
| `age_18_25_female` | Age 18-25 – Female | 12 |
| `age_26_35_male` | Age 26-35 – Male | 20 |
| `age_26_35_female` | Age 26-35 – Female | 28 |
| `age_36_60_male` | Age 36-60 – Male | 52 |
| `age_36_60_female` | Age 36-60 – Female | 64 |
| `age_61plus_male` | Age 61+ – Male | 18 |
| `age_61plus_female` | Age 61+ – Female | 18 |
| `joining_fee` | Joining Fee (E) | 50 |
| `annual_subscription_fee` | Annual Subscription Fee (E) | 120 |
| `try_question` | try question (required test question) | Members meet monthly at the community hall. |
| `members` | members… (required test question) | 220 |

**General Information**

| Key | Question | Answer |
|---|---|---|
| `society_name` | Name of Society | multiP |
| `registration_no` | Registration No | MPC/HH/2016/045 |
| `reg_status` | Registration Status | Fully |
| `common_bond` | Common Bond | Smallholder farmers of Ntfonjeni area |
| `postal_address` | Postal Address | P.O. Box 214, Piggs Peak |
| `physical_address` | Physical Address | Ntfonjeni Community Centre, Hhohho |
| `region` | Region | Hhohho |
| `office_status` | Society Office Is? | Owned |
| `affiliated_to` | Affiliated To | Hhohho Farmers Apex |
| `sub_sector` | Sub-Sector | Agriculture – maize and vegetables |
| `respondent_name` | Respondent Name | Sibusiso Dlamini |
| `respondent_position` | Position | Secretary / Manager |

**Leadership & Committees**

| Key | Question | Answer |
|---|---|---|
| `board_male` | Board – Male | 4 |
| `board_female` | Board – Female | 3 |
| `exec_male` | Executive – Male | 2 |
| `exec_female` | Executive – Female | 1 |
| `last_agm_date` | Date Last AGM Held | 2025-03-22 |
| `chairperson_education` | Chairperson Education | Secondary |
| `agm_attendance_male` | Last AGM Attendance – Male | 61 |
| `agm_attendance_female` | Last AGM Attendance – Female | 79 |

**Training & Capacity**

| Key | Question | Answer |
|---|---|---|
| `members_trained_last_year` | Members Trained Last Year | 45 |
| `leaders_trained_last_year` | Leaders Trained Last Year | 5 |
| `staff_trained_last_year` | Staff Trained Last Year | 3 |
| `training_sponsor` | Sponsor | Apex |
| `training_quality` | Training Quality | Good |
| `training_cost_proportion` | Training Cost Coverage (%) | 40 |
| `dfd` | dfd (required test question) | Practical field demonstrations |

**Capitalization**

| Key | Question | Answer |
|---|---|---|
| `share_nominal_value` | Share Nominal Value (E) | 100 |
| `total_share_capital` | Total Share Capital (E) | 66,000 |
| `borrowed_funds` | Borrowed Funds (E) | 50,000 |
| `donations_grants` | Donations/Grants (E) | 30,000 |
| `accumulated_book_reserves` | Accumulated Statutory Reserves (E) | 24,000 |
| `capitalization` | capitalization (required test question) | Member shares and retained surplus |

**Activity Performance**

| Key | Question | Answer |
|---|---|---|
| `main_activity_1` | Main Activity 1 | Maize production and marketing |
| `main_activity_1_income` | Activity 1 Income (E) | 248,000 |
| `main_activity_1_expenses` | Activity 1 Expenses (E) | 214,000 |
| `main_activity_2` | Main Activity 2 | Vegetable production |
| `main_activity_2_income` | Activity 2 Income (E) | 132,000 |
| `main_activity_2_expenses` | Activity 2 Expenses (E) | 117,500 |
| `creditors_outsiders` | Owed to Creditors – Outsiders (E) | 79,000 |
| `amount_owed_by_members` | Amount Owed by Members (E) | 220,000 |
| `number_of_competitors` | Number of Competitors | 3 |

**Financial Summary**

| Key | Question | Answer |
|---|---|---|
| `current_total_income` | Current Year Total Income (E) | 412,000 |
| `current_total_expenditure` | Current Year Total Expenditure (E) | 371,500 |
| `current_net_income` | Current Year Net Income (E) | 40,500 |
| `last_total_income` | Last Year Total Income (E) | 386,000 |
| `last_total_expenditure` | Last Year Total Expenditure (E) | 352,300 |
| `non_current_assets` | Non-Current Assets (E) | 185,000 |
| `total_current_assets` | Total Current Assets (E) | 401,500 |
| `total_liabilities` | Total Liabilities (E) | 389,500 |
| `total_equity` | Total Equity (E) | 197,000 |
| `challenges` | Main Challenges | Late loan repayments in the dry season; limited storage for harvested maize |
| `success_reasons` | Main Success Reasons | Strong member participation; bulk purchasing of seed and fertiliser |

**New Section**

| Key | Question | Answer |
|---|---|---|
| `annual_subscription_fee_e` | Annual Subscription Fee (E) – required dropdown | 200 (chosen by the tester after options 100 / 200 were added to the template; not used in any calculation) |

**Consistency of the answers:** total assets 586,500 = liabilities 389,500 + equity 197,000; equity = shares 66,000 + reserves 24,000 + retained 36,500 + donations 30,000 + current surplus 40,500; net income 40,500 = income 412,000 − expenditure 371,500; overdue buckets 0–30 = 9,800 (= delinquent 0–30), outstanding loans 220,000 (= amount owed by members).

## 2.3 Expected dashboard boxes (multipurpose)

| Box | Expected | Formula | App shows |
|---|---:|---|---|
| Total assets | SZL 586.5K | non-current + current assets | ✅ |
| Gross loans | SZL 220K | outstanding male + female | ✅ |
| Member deposits | SZL 260.5K | savings male + female | ✅ |
| Net surplus | SZL 40.5K | current net income | ✅ |
| Loans overdue > 30 days | 6.1% | overdue > 30 / loans | ✅ |
| Institutional capital | 15.4% | (retained + reserves + donations) / total assets | ✅ |

Loan quality chart: performing 93.9%, watch list 3.4%, non-performing 2.7%. No benchmarks.

## 2.4 Expected indicators (Basic Analytics, dashboard Key Indicators, reports)

Correct values use **220** registered members. **P2 is fixed:** the app now uses **220**, so the “Correct” column is what it should show (the “Expected in app today” column described the app before the fix).

| Indicator | Formula | Correct | Expected in app today (P2) | App shows |
|---|---|---:|---:|---|
| Active members (%) | active / registered | 78.18% | 78.18% | ✅ |
| Women members (%) | female registered / registered | 55.45% | 55.45% | ✅ |
| Youth members (%) | aged 18–35 / registered | 30.91% | 15.45% ⚠️ | ✅ |
| Female active members (%) | female active / active | 56.98% | 56.98% | ✅ |
| Board women (%) | female board / board | 42.86% | 42.86% | ✅ |
| AGM attendance (%) | AGM attendance / registered | 63.64% | 31.82% ⚠️ | ✅ |
| Member training coverage (%) | members trained / registered | 20.45% | 10.23% ⚠️ | ✅ |
| Leadership training coverage (%) | leaders trained / board | 71.43% | 71.43% | ✅ |
| Main activity operating margin (%) | (activity income − expenses) / income | 12.76% | 12.76% | ✅ |
| Total operating margin (%) | (income − expenditure) / income | 9.83% | 9.83% | ✅ |
| Savings account penetration (%) | savings accounts / registered | 73.18% | 36.59% ⚠️ | ✅ |
| Average savings per depositor | savings value / accounts | SZL 1,618.01 | SZL 1,618.01 | ✅ |
| Average savings – male | male value / male accounts | SZL 1,600.00 | SZL 1,600.00 | ✅ |
| Average savings – female | female value / female accounts | SZL 1,631.87 | SZL 1,631.87 | ✅ |
| PAR > 30 days | overdue > 30 days / outstanding loans | 6.14% | 6.14% | ✅ |
| Delinquent loan account rate (%) | loans in arrears / loans outstanding | 17.07% | 17.07% | ✅ |
| Staff training coverage | needs the staff table (not in the template) | not reported | not reported | ✅ not reported |
| Meetings held | question not in the template | not reported | not reported | ✅ not reported |
| Loan recovery rate | needs “recovered loans” (not in the template) | not reported | not reported | ✅ not reported |
| Monetary reserve coverage | needs “actual reserves in bank” (not in the template) | not reported | not reported | ✅ not reported |
| Member economic benefit ratio | needs “surplus distributed to members” (not in the template) | not reported | not reported | ✅ not reported |

Members: registered **220** (male 98, female 122), active **172**, aged 18–35 **68**, AGM attendance **140**. Savings accounts **161**, savings value **260,500**. Outstanding loans **220,000**, overdue > 30 days **13,500**, over 90 days **6,000**.

---

## 2.5 Cross-check result (multiP, 15 October 2026)

Dashboard boxes and loan quality chart (93.9 / 3.4 / 2.7), Key Indicators, Basic Analytics (cooperative and apex), Basic Benchmarking figures, the individual questionnaire report and the apex consolidated questionnaire report all match the tables above. Problems found on the way: P8–P13.

# Part 3 — Where to check

| Screen | Who | What to compare |
|---|---|---|
| Cooperative dashboard | each cooperative | 1.2 / 2.3 boxes, loan quality chart, 2.4 key indicators |
| Submission detail | cooperative, apex | grid totals (1.1), reconciliation card (1.7), questionnaire answers (2.1, 2.2) |
| Analytics / Basic Analytics | cooperative, apex, federation, ministry | 1.2 KPIs / 2.4 indicators |
| Benchmarking / Basic Benchmarking | all | own values = 1.2 / 2.4; averages need ≥ 3 cooperatives |
| Reports (individual PDF) | cooperative, apex | 1.1, 1.2, 1.7 / 2.1–2.4 |
| Consolidated reports (both editions) | apex and above | SACCO in the financial-statements edition, multiP in the questionnaire edition |
