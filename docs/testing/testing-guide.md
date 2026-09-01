
# CoopData Testing Guide

This guide documents and verifies **all features currently implemented in CoopData** on a deployed environment.

It is written to follow the **platform flow — from the lowest level to the top**. The whole system works because of a strict hierarchy:

```
Ministry  →  Federation  →  Apex  →  Cooperative
  (top)                                    (bottom)
```

> **Why the order matters:** You can only get *data* once a **Cooperative** exists, and you can only get *data* once a **Cooperative** can submit. You can only get **reports** and **analytics** once submissions have been created, reviewed and **approved** up the chain. So this guide advances level by level:
>
> 1. **Build the hierarchy** (create Federation → Apex → Cooperative + users)
> 2. **A cooperative submits data** (via one of 3 methods, depending on digitalization)
> 3. **The 4-tier review** approves it up the chain
> 4. **Approval unlocks reports & AI narratives**
> 5. **Approved data feeds analytics**
>
> Follow it top-to-bottom and let each feature unlock the next.

The platform enforces strict Role-Based Access Control (RBAC) and a hierarchical user tree. To test the different roles in parallel, open different browser tabs, separate browser profiles, or private (incognito) windows. This lets you stay logged in under different accounts simultaneously without logging out repeatedly.

---

## 🔑 Prerequisites: Access & Credentials



| Role | Deployed username | Purpose |
|------|-------------------|---------|
| Ministry Admin | `admin@ministry.gov` / `Ministry@Admin2026!` | Top level — platform super-admin |
| Federation Admin | `fed-admin@testfed.org` | Manages apexes within a federation |
| Apex Admin | `john.doe@testfed.org` | Manages cooperatives within an apex |
| Cooperative Submitter | *(invited)* | Submits cooperative data |

- **Ministry Admin** sees: **Federations**, **Users**, **Reports**, **Analytics**, **Basic Analytics**, **Benchmarking**, **Custom KPIs**, **Settings**, **Audit**, **Questionnaire Templates**.
- **Federation Admin** sees its federation's **Apexes**, **Users**, **Reports**, **Analytics**, **Basic Analytics**, **Benchmarking**.
- **Apex Admin** sees its apex's **Cooperatives**, **Users**, **Reports**, **Analytics**, **Basic Analytics**, **Benchmarking**.
- **Cooperative** sees **Submissions**, **Reports**, **Analytics**.
- Lower levels **cannot** see or reach higher-level pages (role-based route guards return an *Unauthorized* page).

---

# Part 1: Building the Hierarchy (Bottom-Up Provisioning)

The platform is a cascade: **Ministry creates Federations → Federation Admins create Apexes → Apex Admins create Cooperatives**. Each level also manages and invites its own users. There is nothing to do until the hierarchy exists — so this is where every test run starts.

## 1.1 Ministry Admin Login & Dashboard

1. Open the app and click **Sign In**; log in as **Ministry Admin**.
2. **Verify:**
   - You land on the **Ministry Dashboard** (`/app/dashboard`).
   - The sidebar shows **Federations**, **Users**, **System Settings**, **Reports**, **Analytics**, **Basic Analytics**, **Benchmarking**, **Custom KPIs**, **Audit**.
   - There are **no** cooperative assessment or submission links visible at this level.
   - The dashboard shows national oversight: total cooperatives, total submissions, pending/approved reviews, and a recent submissions table.

## 1.2 Ministry Creates a Federation

1. Go to **Federations** (`/app/federations`).
2. Click **Register Federation**, enter name (e.g. `Test Federation`) and domain (e.g. `testfed.org`).
3. Click **Register** and **verify** it appears in the table.

## 1.3 Ministry Invites a Federation Admin

1. Go to **Invitations** under the Menu Bar (`/app/invitations`).
2. Use the **federation drop-down** to choose which federation you want to invite an admin for, then click **New Invitation**.
3. Fill in:
   - **Email:** `fed-admin@testfed.org`
   - **First Name:** `Fed`
   - **Last Name:** `Admin`
4. Click **Send Invitation**.
5. **Verify** the invitation appears under the **Invitations** dashboard with a **Pending** status.

> **Invitation Flow:** Every lower-level user below the Ministry is **invited by their parent level**. The recipient receives an invite, then registers/sets a password. This is the same mechanic at every level (Federation invites Apex Admin, Apex invites Cooperative users).

## 1.4 Federation Admin Creates an Apex

1. Log in as **Federation Admin** (`fed-admin@testfed.org`).
2. Go to **Apexes** (`/app/apexes`) and click **Register Apex**. Create one (e.g. `Agriculture Apex`).
3. Click **Invite User** on the apex row and invite an Apex Admin: `john.doe@testfed.org` (Role: `apex`).
4. **Verify** the apex appears and the invite is sent.

## 1.5 Apex Admin Creates a Cooperative

1. Log in as **Apex Admin** (`john.doe@testfed.org`).
2. Go to **Cooperatives** (`/app/cooperatives`) and click **Register Cooperative**. Create one (e.g. `Fruit Growers Coop`).
   - The cooperative profile form captures details including **sector**, **tier/type**, and status.
3. Register a **cooperative user / submitter** (the person who will enter data).
4. Manage the cooperative's **members** (`/app/cooperative-members/{id}`): add, edit, remove, resend verification.

### 1.6 Cooperative Digitalization Level → Submission Method

Each cooperative carries a **tier** that reflects **how digitalized it is**, and that determines which data-entry method it should use:

| Cooperative tier | Digitalization | Submission method |
|------------------|----------------|-------------------|
| **Basic** | Low / non-digitalized | **Questionnaire** *(forced)* |
| **Standard / Advanced** | Digitalized | **Upload** (AI) or **Manual entry** |
 

---

# Part 2: Data Submission — The 3 Methods

Once a cooperative + its user exist, the cooperative can begin a **submission** and enter data. Data is entered through **one of three submission methods**. The **first two methods (Upload & Manual) serve digitalized cooperatives** and collect **full, detailed** financial + non-financial records. The **third method (Questionnaire) serves low-digitalized cooperatives** and collects a **simplified** set of structured answers.

## 2.1 Starting a Submission & Choosing a Method

1. Log in as the **Cooperative Submitter**.
2. Go to **Submissions** (`/app/submissions`) and create a new submission.
3. Open the submission. If no method is chosen, a **Submission Method** modal appears with three cards:
   - **Upload** — AI-powered extraction from a financial statement file.
   - **Manual Entry** — type data into structured grids/wizard.
   - **Questionnaire** — answer a ministry-defined structured questionnaire.
4. Pick the method ).

## 2.2 Method 1 — AI-Powered Financial Statement Upload *(digitalized)*

1. On the submission, choose **Upload**.
2. Click **Upload /PDF, image** and drop in a financial statement file (PDF, scanned PNG/JPG/TIFF,).
3. **Verify:**
   - A progress indicator appears: *"Uploading..."* then *"Extracting values (polling AI job)..."*
   - The AI extraction job runs through preprocessing → extracting → mapping → succeeded.
4. Once complete, you are redirected to the **Financial Statement Editor** screen.

### Correcting Extracted Values

1. Rows show confidence: **Green** = high confidence, **Amber/Red** = low confidence or flagged.
2. Click **Edit** next to any value, correct it, and save.
3. **Verify** the value is saved and the abnormality/validation panel reflects the changes.
4. When satisfied, **validate/confirm** the statement.

> Non-financial data for digitalized cooperatives is entered separately (see **Part 3**). The financial and non-financial parts must both be marked **Ready** before the cooperative can submit.

## 2.3 Method 2 — Manual Entry *(semi-digitalized)*

The **Manual Entry** wizard is for cooperatives that don't have machine-readable statements but have staff who type data in.

1. On the submission, choose **Manual Entry**.
2. The wizard runs two sub-flows (driven by a `step`):
   - **Financial** (`step=financial`): a 12-month **Financial Grid** per chart-of-accounts code, with auto-computed roll-up/total codes (1100, 1999, 2999, 3999, …).
   - **Non-financial** (`step=members`): **Members**, **Savings**, **Loans**, **Fixed Deposits**, **Farm Cooperative** steps, then a **Review Summary**.
3. Enter data in each step.
4. **Verify** the totals roll up correctly and the non-financial registers persist.

## 2.4 Method 3 — Questionnaire *(low-digitalized / forced for Basic tier)*

For low-digitalization cooperatives, the Ministry defines a **questionnaire template**, and the cooperative simply **answers** it.

### Ministry defines the template (top-down)

1. Log in as **Ministry Admin** → **Questionnaire Templates** (`/app/questionnaire-templates`).
2. Open the **Template Editor** and manage **sections**, **fields**, and multi-language **translations** per field.
3. Activate the desired template (a template is active per type: `financial` or `non_financial`).

### Cooperative answers the questionnaire (bottom-up)

1. Log in as the **Cooperative Submitter**, open the submission, choose **Questionnaire** (or it is forced for `basic` tier).
2. Pick a type (`financial` or `non_financial`) and answer the ministry-defined template questions.
3. Save the answers.

> A questionnaire-based submission has a single `questionnaire` section instead of the full section set. In the **Basic Analytics** tab (Part 7) the questionnaire answers are **aggregated** to report on non-digitalized cooperatives.

---

# Part 3: Non-Financial Data Pipeline

Cooperatives upload **non-financial** datasets (membership, savings, loans, and farm cooperative data) using an Excel template.

1. Log in as a **Cooperative Submitter** with the *Upload* method.
2. Go to **Data Collection** → open the **Non-Financial** tab.
3. Click **Upload Excel File**.
4. Upload a workbook containing sheets: **NF MSHIP**, **NF SAVINGS**, **NF LOANS**, **NF FD** (fixed deposits), and **NF FARM**.
5. **Verify Rules Engine & Validations:**
   - On error, an alert shows the **sheet name** and **row number**.
   - If validation succeeds, a table grid appears with all the **parsed data loaded** (editable).
6. Verify members, savings, loans, fixed deposits, and farm-coop datasets are editable grids.

---

# Part 4: Submission & the 4-Tier Review State Machine

Once a cooperative has entered its data, the submission travels **up the hierarchy** for approval. Each level can approve or send it back down.

## 4.1 Submitting as a Cooperative

1. In the **Data Collection** overview page, verify both the **Financial** and **Non-Financial** (or **Questionnaire**) sections are marked **Ready**.
2. **Verify** the **Submit Assessment** button becomes active **only** when all required sections are **Ready**.
3. Click **Submit Assessment**.
4. **Verify** the status changes to **Submitted** (it now moves to the Apex for review).

## 4.2 The Review Cascade (Apex → Federation → Ministry)

| Stage | Who approves | From state | To state | Return sends back to |
|-------|--------------|-----------|---------|------------|
| Submit | Cooperative | Draft | Submitted | — |
| 1st review | **Apex Admin** | Submitted | In Review | Cooperative |
| 2nd review | **Federation Admin** | In Review | In Review | Apex |
| Final review | **Ministry Admin** | In Review | **Approved** | — |

### Apex Review

1. Log in as the **Apex Admin** for the cooperative's parent apex.
2. Navigate to **Submissions / Reviews** and click the cooperative's submission.
3. **Verify** the **Action Panel** shows **Approve** and **Return to Cooperative**.
4. Click **Return to Cooperative**, add a comment (e.g. *"Please check Loan loss provisions"*), and submit.
5. **Verify** the state updates to **Returned to Cooperative** (the cooperative must fix and re-submit).
6. Re-submit, then click **Approve**.
7. **Verify** the submission advances to the Federation.

### Federation & Ministry Review

1. Log in as **Federation Admin** and approve the submission (it advances to the Ministry).
2. Log in as **Ministry Admin** and open the submission.
3. **Verify** you can **Approve** or **Reject**.
4. Click **Approve**.

> ✅ **Approval by the Ministry is the moment everything unlocks.** Only *approved* submissions:
> - generate **PDF reports** with **AI narratives** (Part 5),
> - feed **Analytics**, **Benchmarks**, and **Rankings** (Part 6–8).

---

# Part 5: Reports & AI-Generated Narratives

Reports exist **only for approved submissions** — this is why they come after the full hierarchy and review chain are in place. There are **4 report tiers**, mirroring the hierarchy.

| Report tier | Level | Print route |
|-------------|-------|-------------|
| **Cooperative report** | Single cooperative | `/print/cooperative/{id}` |
| **Apex report** | Consolidated group of coops | `/print/apex/{id}` |
| **Federation report** | Consolidated apexes | `/print/federation/{id}` |
| **Ministry report** | National overview | `/print/ministry` |

## 5.1 Generating a Report

1. Log in as any role that manages approved data (e.g. Ministry Admin, Apex Admin).
2. Go to **Reports** (`/app/reports`).
3. Find the approved submission / tier and click **Export PDF** (or **Regenerate & Export**).
4. **Verify** the PDF is generated (via the Gotenberg rendering service) and downloads/stores.

## 5.2 What's Inside Each Report

### Cooperative Report (6 sections)
- **Cover page** — branded cover, cooperative name, year, submission reference
- **Executive Summary** — financial highlights + key ratios with stoplight badges
- **Non-Financial** — membership demographics (pie chart) + data columns
- **Financial Position** — balance sheet + income statement with year-over-year comparison
- **Portfolio Quality** — portfolio-quality pie chart + loan classification table
- **Benchmark Comparison** — quartile benchmark table (P25 / P50 / P75 vs national average)

### Consolidated Reports (Apex / Federation / Ministry)
- **Cover** — tier label, entity, year, cooperative counts
- **Dashboard** — KPI summary tables + comparison charts
- **Cooperative Detail** — per-cooperative health / compliance table + risk-status bar chart
- **Risk Watch** — portfolio quality, risk indicators
- *Federation/Ministry only:* **Sector Breakdown**, **Apex Comparison**, **PEARLS Analysis**, **Apex Distribution**, **Social Impact**

## 5.3 AI-Generated Narratives

Approved reports are enriched with **natural-language AI narratives** (driven by Google Gemini). Each report section gets a plain-language insight block that explains the numbers.

1. Open/trigger an approved **Cooperative, Apex, Federation, or Ministry** report.
2. **Verify** each report section includes an **AI Insight box** narrating that section (executive summary, financial position, portfolio quality, non-financial, benchmark comparison, risk distribution, sector breakdown, apex comparison, PEARLS analysis).
3. If narratives are absent, the section still renders with fallback placeholder text (the report is never blocked).
4. **Regenerate:** From **Reports**, use **Regenerate & Export** (or the generate endpoint on the narrative API) to re-run AI narrative generation.


---

# Part 6: Analytics (Main / Advanced)

After submissions are **approved**, their numbers flow into the **Analytics** dashboards. There are **two analytics surfaces** that mirror the two submission worlds:

| Surface | Serves | Based on | Route |
|---------|--------|----------|-------|
| **Analytics** (main) | **Digitalized** cooperatives | Full financial statements + NF ledgers → KPI engine | `/app/analytics` |
| **Basic Analytics** | **Non-digitalized / low-digitalized** cooperatives | Questionnaire answers | `/app/basic-analytics` |

> The distinction is decided by **digitalization**: if a cooperative can supply a full statement it appears in the main KPI analytics; if it can only fill a questionnaire it appears in Basic Analytics.

## 6.1 Main Analytics (KPI Dashboards)

Each role sees analytics **drilled down to its own level** of the hierarchy (Ministry sees the nation, down through Federation, Apex, to a single Cooperative).

1. Log in as a role, go to **Analytics** (`/app/analytics`) and pick a **reporting year**.
2. **Verify** the role dashboard loads:
   - **Ministry**: national macro view, regional distribution, compliance distribution, non-financial consolidation, rankings.
   - **Federation**: regional distribution, OER leaderboard, compliance traffic-light, apex distribution.
   - **Apex**: cooperative performance, risk-vs-return scatter (ROA vs NPL), compliance charts.
   - **Cooperative**: "My Analytics" — KPI scorecard, compliance gauges, trend charts, portfolio, gender participation, savings/loans/deposits, dormancy leaderboard, agricultural resilience radar.
3. **Verify KPIs** are shown with **green/amber/red** thresholds (assets, loan portfolio gross/net, member deposits, equity, net surplus, PAR30/PAR90, NPL ratio, loan-loss coverage, ROA, ROE, operating-expense ratio, capital-adequacy ratio, liquid-funds ratio, OSS, net-interest margin, deposits-to-loans).
4. Use the **filter bar** (year / federation / apex / cooperative / region / sector as allowed by your role) and **verify** the data drills down.

### Advanced Supervisory Tabs

On the main Analytics page, supervisor roles (ministry / federation / apex — **not** cooperative directly) get extra tabs when no single cooperative is selected:
- **Cooperative Rankings** — rank cooperatives by principal account (total assets, gross loans, member deposits, equity, etc.) by month/year.
- **Portfolio Classification** — loan classification by arrears buckets (productive / consumption / housing / microcredit).
- **Income Statement** — comparative income statement across cooperatives.
- **Financial Indicators** — computed financial ratios grouped by category.

## 6.2 Basic Analytics (Questionnaire-Based)

This tab reports on the **low-digitalized cooperatives** that submit via the questionnaire.

1. Go to **Basic Analytics** (`/app/basic-analytics`).
2. **Verify** a scope summary showing reporting cooperatives vs total.
3. **Verify** the stat cards: reporting rate, consolidated membership, total share capital, total savings value, outstanding loans, net surplus.
4. **Verify** member demographics (gender + age), financial balances, region pie + sector bar charts, and the detailed reporting-cooperatives table.

---

# Part 7: Benchmarking & Custom KPIs *(supervisor / ministry)*

## 7.1 Benchmarking

Benchmarking compares each cooperative's KPIs against **sector** and **national** averages and **percentiles** (P25 / P50 / P75).

1. Log in as **Ministry** (or Federation/Apex) Admin → **Benchmarking** (`/app/benchmarking`).
2. Pick a **reporting year** and cooperative.
3. **Verify** per-KPI comparison against sector average, national average, and quartile percentiles, with positive/warning/critical deviations flagged.

## 7.2 Custom KPIs (Ministry only)

The Ministry can define **formula-based KPIs** from the indicator catalog and live national data.

1. Log in as **Ministry Admin** → **Custom KPIs** (`/app/custom-kpis`).
2. **Create** a KPI, define its formula from the catalog, save it.
3. **Verify** the custom KPI is computed from live data and inspect its breakdown.
4. Custom KPIs surface in the **Analytics** dashboards and reports.

---

# Part 8: High-Stakes Deletion Security

Deleting an entity (Federation, Apex, or Cooperative) is a **destructive, cascading** action. It is protected by a multi-step confirmation + a single-use verification token.

> **Deletion cascades down the hierarchy:** deleting a Federation deletes its Apexes, their Cooperatives, and every associated user account. Each level (Ministry→Federation, Federation→Apex, Apex→Cooperative) uses the same protected deletion flow.

1. Log in as the appropriate Admin (e.g. **Ministry Admin**) and go to the entity list (e.g. **Federations**).
2. Click the **Delete (Trash)** icon.
3. **Verify Step 1 – Preview:** a dialog opens showing the cascade impact: *"This will delete: X Apexes, Y Cooperatives, and Z associated user accounts."*
4. **Verify the type-to-confirm:** the action button is disabled until you type the exact entity name (e.g. `Test Federation`), which enables **Continue**.
5. Click **Continue** → a prompt requests your **password** (and an **OTP** if 2FA is configured).
6. Enter your password and submit.
7. **Verify** a single-use verification token is issued (valid ~120s), the DELETE is sent with the verification header, and the entity disappears from the table.
8. Reusing/expiring the token returns **428 Precondition Required** — the deletion is rejected without fresh verification.

---

# Part 9: Audit Logging (Ministry)

Every mutation across the platform (create, update, delete, invite, remove member, role assignment, password change) is written to an **audit log**.

1. Log in as **Ministry Admin** → **Audit** (`/app/audit`).
2. **Verify** you can filter by **action** (CREATE / UPDATE / DELETE / INVITE / …) and **resource type** (user / federation / apex / cooperative / organization).
3. **Verify** you can view row details with the actor, target resource, and timestamp.
4. Perform a mutation (e.g. create a federation) and **verify** a new audit entry appears.

---

# Part 10: Multilingual & Dynamic Content Localization

CoopData is **fully multilingual** in **4 languages — English (`en`), Portuguese (`pt`), siSwati (`ss`), French (`fr`)**. Localization works at **two layered levels**:

1. **Static UI chrome** — the interface labels, menus, and buttons are translated via i18next (all 4 languages).
2. **Dynamic content localization** — ministry-editable *data content* (questionnaire templates, non-financial indicator catalog, custom KPIs) is stored with **per-language translations** and served to each user in **their own language**.

Because questionnaires/indicators/KPIs are entered by the **Ministry** and seen by **Cooperative** users in different regions, dynamic localization means a siSwati- or Portuguese-speaking cooperative sees questions, labels, and options in **their** language, not hardcoded English.

## 10.1 Switching the UI Language (all roles)

1. Log in as any user → go to **Profile** (`/app/profile`).
2. Find the **Language** picker and switch to **Portuguese**, **siSwati**, or **French**.
3. **Verify** the interface (sidebar, buttons, labels) immediately re-renders in the chosen language.
4. Switch back to **English** and confirm it restores correctly.

## 10.2 Ministry enters Translations for Dynamic Content

The Ministry provides **translated labels/descriptions/options** per language, alongside the canonical source text.

### Questionnaire Templates

1. Log in as **Ministry Admin** → **Questionnaire Templates** (`/app/questionnaire-templates`).
2. Open the **Template Editor** and pick a section / field.
3. **Verify** the editor shows a **language selector** (`en`, `pt`, `ss`, `fr`).
4. For a non-English language, enter the translated **label**, **section title**, **section description**, **field label**, **field description**, and **select options**.
5. Save.
6. **Verify** saving a translation for one language does **not** wipe the English (canonical) text or another language's translation.



## 10.3 A Cooperative Sees Content in Their Language

1. Log in as a **Cooperative Submitter** and open a **Questionnaire** submission.
2. Set the UI language to **siSwati** (or Portuguese/French) via Profile.
3. Open the questionnaire **financial** or **non_financial** wizard.
4. **Verify** the questions, labels, field descriptions, and select options render in the active language for any field that has a translation.
5. **Verify the fallback:** for a field/section with **no** translation in the active language, it falls back to **English** (the canonical/source language) — the questionnaire is never blank or broken.
6. **Verify backward compatibility:** existing questionnaire answers and previously created templates still work unchanged (answer keys are untouched by localization).


---

# Test Checklist (Quick Reference)

- [ ] **Hierarchy:** Ministry → Federation → Apex → Cooperative all created; users invited at each level.
- [ ] **RBAC:** Each role only sees its own level's navigation; lower levels blocked from higher-level pages.
- [ ] **Submission methods:** Upload (AI), Manual entry, Questionnaire all work; basic-tier coop forced to Questionnaire.
- [ ] **AI extraction:** upload → progress → editor with confidence badges → edit/save.
- [ ] **Non-financial:** Excel upload parses members/savings/loans/FD/farm; validation flags sheet + row.
- [ ] **Review:** cooperative submits; Apex return/approve; Federation approve; Ministry approve.
- [ ] **Reports + AI narratives:** 4 tiers generate PDFs after approval with AI insight boxes.
- [ ] **Analytics:** main KPI dashboards per role; Basic Analytics aggregates questionnaire coops.
- [ ] **Benchmarking & Custom KPIs:** sector/national comparison; ministry-defined formulas.
- [ ] **High-stakes deletion:** preview → type-to-confirm → password/OTP → single-use token.
- [ ] **Audit log:** mutations recorded and filterable.
- [ ] **Multilingual:** UI switches between en/pt/ss/fr; ministry enters translations; cooperative sees questionnaire in own language with English fallback.
```



