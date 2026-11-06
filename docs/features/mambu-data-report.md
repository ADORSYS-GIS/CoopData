# Mambu data report: what CoopData takes from Mambu, how, and how far it can be trusted

Date of the audit: 5 November 2026
Branch of the code: `feat/mambu-sync`
Mambu tenant used: `coopshub.sandbox.mambu.com` (sandbox), API v2, read-only user `adorsys`
Main branch checked in depth: `ES0006` (the cooperative called Adorsys in CoopData, "Asikhutulisane SACCO" in Mambu). Other branches were checked for size and data completeness only.

This report answers four questions for every piece of data CoopData imports:

1. Which Mambu endpoint and which field does it come from?
2. How is Mambu's value turned into the CoopData value?
3. Did we check that the CoopData value is right, and how?
4. What could mislead a reader, and what does CoopData do about it?

It also lists what Mambu does not provide at all. It is the companion of `mambu-sync.md`, which describes the design and the flow.

---

## 1. Summary

### 1.1 How the audit was done

The import code was not trusted to check itself. For each kind of record the audit:

- downloaded the raw Mambu records of branch ES0006 (2,906 clients, 10,077 deposit accounts, 4,146 loans, 134 deposit products, 236 loan products, 663 ledger accounts) with a separate script;
- re-implemented the CoopData rules a second time, in Python, from the written rules and not from the Rust code;
- compared the result with what CoopData had stored for the Adorsys return;
- reconciled the lists with the ledger, and the ledger with Mambu's own accounting report.

Only totals and counts were printed. No names, national IDs, phone numbers or bank details were read into the report. The raw files used for the audit were kept in a scratch folder outside the repository and deleted after the audit.

### 1.2 Result in one table

| Data | Result of the independent check | Trust |
|---|---|---|
| Members (1,209) | The replica gives the same 1,209 members, the same status split (Active 1,104, Dormant 74, Exited 31), the same gender split (615, 593, 1), the same age groups (33, 196, 440, 540) and the same regions (490, 439, 211, 69) | Good, with the caveats in 4.1 |
| Dropped members | Replica drops 996 exited before the year, 686 blacklisted, 4 without birth date, 7 without join date, 4 without exit date. These are exactly the warnings the sync shows | Good |
| Share balance (members) | Sum 2,676,387.18 over 1,044 members with a share account (984 with a positive balance). Same in the replica | Good |
| Savings (3,165 before the fixes) | Count 3,165 and sum 15,726,729.38, identical to the replica | The numbers are right; two classification problems found (4.2) |
| Fixed deposits (49) | Count 49 and sum 864,285.90, identical to the replica | Balances right; maturity and status were misleading, fixed (4.3) |
| Loans (634) | Count 634, principal 12,114,986.10 and loan amount 16,760,212.65, identical to the replica | Right, with the caveats in 4.4 |
| Ledger | Rebuilt from the general ledger. Closed books balance to the cent over 72 months. November equals Mambu's own balanced report line by line. Loans, interest and fees reconcile to 0.06% | Good for the figures; some Mambu accounts need a business review (4.5) |
| Fields Mambu does not hold | Fixed values (false, Unknown, Stable, Irregular, 0) | Not real data. Now announced by a warning, and still shown as 0% in some charts (section 7) |

### 1.3 What the audit changed in the code

The audit found five things that were wrong or misleading. Four are fixed and covered by tests.

1. **Fixed deposits shown as Matured although Mambu says Active.** Mambu has no maturity date on these accounts and the product has no term. CoopData assumed 12 months and then marked every deposit older than that as Matured. 46 of 49 were shown Matured; Mambu says 48 are Active. Now an assumed maturity never overrules Mambu's state. Fixed.
2. **"Member Over-Payments" counted as savings.** These are loan over-payment accounts. The word list only knew "overpayment", not "over-payment". Fixed.
3. **Board members were not recognised.** Mambu holds the member category in the custom field `mcat` (value `board` for 10 members). CoopData now sets a leadership role and counts total and female board members. Fixed.
4. **Silent assumptions.** Region taken from the cooperative (35% of members), loan type defaulted to Personal (98% of loans) and the fields Mambu does not hold were not announced. Three new info warnings now say so: `MEMBER_REGION_ASSUMED`, `LOAN_TYPE_DEFAULTED`, `FIELDS_NOT_IN_MAMBU`.
Verified on the live return after a new sync (5 November 2026): fixed deposits 48 Active and 1 Matured, the same as Mambu's states (before: 3 Active, 46 Matured); savings 2,870 accounts, 15,699,748.26 (before: 3,165 accounts, 15,726,729.38; the 295 over-payment accounts are gone); 10 board members (4 women); the notices `MEMBER_REGION_ASSUMED` (419 members), `LOAN_TYPE_DEFAULTED` (630 loans), `FD_MATURITY_DEFAULTED` (49) and `FIELDS_NOT_IN_MAMBU` are on the import.

5. **Not fixed, needs a decision:** how Permanent Savings is classified (4.2) and a few Mambu ledger accounts that look like accounting artefacts (4.5).

---

## 2. How CoopData talks to Mambu

| Item | Value |
|---|---|
| Base URL | `MAMBU_BASE_URL`, ends with `/api` (sandbox: `https://coopshub.sandbox.mambu.com/api`) |
| Authentication | HTTP Basic (`MAMBU_USERNAME`, `MAMBU_PASSWORD`) or an `apikey` header (`MAMBU_API_KEY`). The secrets live in the server environment only |
| Version header | `Accept: application/vnd.mambu.v2+json` |
| Access | Read-only. The only POSTs are searches and the request that starts an accounting report. Nothing is created, changed or deleted in Mambu |
| API user rights | Read of clients, deposits, loans, GL accounts, GL journal entries, branches, deposit products, loan products. Not allowed: `/users`, `/centres` (403) |
| Paging | 200 records per page (`MAMBU_PAGE_SIZE`). Mambu accepts up to 1,000 per page; 200 was kept because it was faster per record on this sandbox |
| Parallelism | Four SACCOs of a run at a time (`MAMBU_SYNC_CONCURRENCY`), at most 8 requests in flight over all syncs (`MAMBU_MAX_INFLIGHT`), clients, deposits and loans of one branch read at the same time, pages of a list four at a time |
| Retries | 6 attempts with growing waits on a dropped connection, 429 or 5xx; 3 attempts on a page that cannot be decoded; a report request waits while Mambu builds another report |
| Privacy | Every Mambu record is read through an allow-list of fields (`services/mambu/models.rs`). Anything not listed (names, phones, national IDs, bank accounts, nominees, addresses) is dropped when the response is read and never reaches the mapper, the database or the logs. Mambu account IDs, which can hold names, are replaced by a hash (`SA-`, `FD-`, `LN-` plus 12 hex characters) |

---

## 3. Endpoints used

All paths are relative to the base URL. "Filter" is the field of the search body (`filterCriteria`).

| # | Data | Method and path | Parameters | Filter or notes | Source of the endpoint |
|---|---|---|---|---|---|
| 1 | Branch search and branch key | `GET /branches` | `detailsLevel=FULL`, `limit`, `offset` | All branches, used to search by name and to check a typed ID | Mambu API v2 reference |
| 2 | Key of one branch | `GET /branches/{id}` | `detailsLevel=BASIC` | Gives `encodedKey`, needed by rows 4 to 7 | Mambu API v2 reference |
| 3 | Members | `POST /clients:search` | `detailsLevel=FULL`, `limit=200`, `offset`; a first call with `limit=1&paginationDetails=ON` gives `items-total` | `branchKey EQUALS <encodedKey>`, sorted by `encodedKey` | Mambu API v2 reference. The filter name `branchKey` was found from Mambu's own error message: `assignedBranchKey` is refused for clients |
| 4 | Savings, shares, fixed deposits | `POST /deposits:search` | as row 3 | `assignedBranchKey EQUALS <encodedKey>` | Mambu API v2 reference. Checked: 10,077 accounts for ES0006 against 472,691 in the tenant |
| 5 | Loans | `POST /loans:search` | as row 3 | `assignedBranchKey EQUALS <encodedKey>` | Mambu API v2 reference. 4,146 loans for ES0006 against 1,108,466 in the tenant |
| 6 | Deposit and loan product names and fixed-deposit terms | `GET /depositproducts`, `GET /loanproducts` | `detailsLevel=FULL`, paged | All products (134 deposit and 236 loan products) | Mambu API v2 reference. Returned 403 until the Mambu administrator gave the API user the right |
| 7 | Ledger | `POST /gljournalentries:search` | `limit=1000`, `offset`; a count call with `limit=1&paginationDetails=ON` | `assignedBranchKey EQUALS <encodedKey>` and `bookingDate BETWEEN <from> AND <to>` (both dates inclusive). A range with more than 30,000 lines is split in two before it is read | Mambu API v2 reference. Filter names found by trial: `branchKey` is refused here too |
| 8 | Chart of accounts (header accounts) | `GET /glaccounts?type=ASSET`, `LIABILITY`, `EQUITY`, `INCOME`, `EXPENSE` | `type` is required, paged | Used to map a Mambu account through its header | Mambu API v2 reference |
| 9 | Ledger fallback | `POST /accounting/reports` then `GET /accounting/reports/{key}` | Body: `startDate`, `endDate`, `branchId`, `currencyCode=SZL`, `balanceTypes` (opening, net change, closing) | Only when the journal cannot be read. Mambu builds one report at a time; the request waits and retries | Mambu API v2 reference |

Endpoints that were read once in tests to learn what Mambu offers, and are not used by the product: `deposits/transactions:search` (readable, 272,143 lines for ES0006), `loans/transactions:search` (times out), `installments` (readable), `groups`, `customfieldsets` (readable), `users`, `centres` (403).

---

## 4. The data, record by record

Each table lists the CoopData field, the Mambu source, the rule and the check made.

### 4.1 Members (`clients:search`)

Observed structure of a client record (ES0006): top-level fields `encodedKey`, `id`, `state`, `creationDate`, `activationDate`, `approvedDate`, `firstName`, `lastName`, `middleName`, `mobilePhone`, `emailAddress`, `birthDate`, `gender`, `assignedBranchKey`, `loanCycle` and others, plus custom field sets `_ADL` (member details), `_bank` and `_savben` (bank and nominee data, never read). The `_ADL` keys seen in the data are `mcat`, `dateJoined`, `RG`, `dateResignedDeceased`, `emp`, `Marital_Status_Clients`, `chf`, `Member_Default_Source_Members`, `IND`, `pa`, `nid`, `occ`, `emp_no`, `Nationality_Clients`, `birthPlace`. CoopData reads only `state`, `activationDate`, `closedDate`, `birthDate`, `gender`, `assignedBranchKey`, `id` and from `_ADL` only `mcat`, `dateJoined`, `RG`, `dateResignedDeceased`.

| CoopData field | Mambu source | Rule | Check |
|---|---|---|---|
| `member_id` | `id` | The Mambu client ID, kept as the member's business ID | The lists show it in the "Member Business ID" column (looked up from the member row) |
| `join_date` | `_ADL.dateJoined`, else `activationDate` | The first one present | `dateJoined` is earlier than `activationDate` for all 2,664 clients that have both and differ (the activation date is the day the client was entered in Mambu, not the day the person joined). So `dateJoined` is the right first choice. New members of 2026: 146 by `dateJoined`, 140 by `activationDate` |
| `status` | `state` and `_ADL.mcat` | ACTIVE: Active; INACTIVE: Dormant; EXITED: Exited; BLACKLISTED: left out. `mcat=deceased`: Deceased; `mcat=resigned` on an active client: Exited | Replica identical: 1,104 / 74 / 31 |
| `exit_date` | `_ADL.dateResignedDeceased`, else `closedDate` | For exited and deceased members only. Left out if it is before the join date | Only 2 of the 31 exited members have a resignation date; 29 use `closedDate`, the day the client was closed in Mambu, which may differ from the real exit |
| `gender` | `gender` | MALE, FEMALE, anything else: Other | 615 / 593 / 1, identical |
| `age_group` | `birthDate` and the date of the return | Under 18, 18 to 35, 36 to 50, over 50 | 33 / 196 / 440 / 540, identical. 29 of the 33 under 18 are younger than 10, which is a data quality signal (4.1.1) |
| `region` | `_ADL.RG`, else the cooperative's region | One of Hhohho, Lubombo, Manzini, Shiselweni | Identical to the replica. `RG` is present for 790 of the 1,209 members; 419 (35%) use the cooperative's region (Lubombo) |
| `leadership_role` | `_ADL.mcat` | `board` gives "Board member" (new) | 10 board members among the imported members |
| `share_balance` | `deposits:search`, accounts of kind Share | Sum of `balances.totalBalance` of the member's share accounts open at the date | 2,676,387.18, identical |
| `urban_rural` | none | Always Unknown | See section 6 |
| `agm_attendance`, `voting_exercised` | none | Always false | See section 6 |

Members left out and why (replica counts equal the sync warnings): exited before the year 996, blacklisted 686, no birth date 4, no join date 7, exited without a date 4.

#### 4.1.1 Member data quality seen in the sandbox

- 2,898 of 2,906 clients have a birth date, but 43 birth years are before 1900 or after 2015 and 29 imported members are under 10 years old. These look like placeholder dates.
- `_ADL.RG` (region) is blank for 57% of all clients.
- Categories in `mcat`: member 2,793, resigned 72, deceased 11, secondary member 10, board 10, staff 5, child 4. Only `board` is used.
- Unused fields that exist: occupation (`occ`), industry (`IND`), employer (`emp`), nationality, marital status. They could feed other indicators later.

### 4.2 Savings and shares (`deposits:search`)

Structure of a deposit record: `encodedKey`, `id`, `name` (the product name), `accountType` (REGULAR_SAVINGS, CURRENT_ACCOUNT, FIXED_DEPOSIT, SAVINGS_PLAN), `accountState`, `accountHolderKey`, `productTypeKey`, `activationDate`, `closedDate`, `maturityDate` (often absent), `currencyCode`, `balances` (total, available, blocked, locked, hold, overdraft, fees due), `interestSettings`, `accruedAmounts`, custom set `_centreOfDeduction`.

How an account is classified, in this order (first match wins; a product mapping chosen by the apex always wins):

1. Name contains "share": **share capital**, goes to the member's `share_balance`.
2. Name contains one of: over-payment, over payment, collection, settlement, overpayment, payout, debtor, interest, tax, transactional, burial, refund, subscription: **not reported**.
3. `accountType` is FIXED_DEPOSIT or SAVINGS_PLAN, or the name contains "fixed deposit": **fixed deposit**.
4. Name contains "mandatory" or "compulsory": **mandatory savings**.
5. Everything else: **voluntary savings**.

An account is reported only when its state is in service (ACTIVE, ACTIVE_IN_ARREARS, DORMANT, LOCKED, MATURED, WITHDRAWN, CLOSED, CLOSED_WRITTEN_OFF), it has an activation date on or before the date of the return, it was not closed before that date, and its holder is one of the imported members. Pending and approved (never activated) accounts and rejected ones are left out.

| CoopData field | Mambu source | Rule | Check |
|---|---|---|---|
| `savings_account_id` | `encodedKey` | `SA-` plus the first 12 hex characters of its SHA-256 | Hash, not reversible |
| `account_type` | the classification above | Voluntary or Mandatory | See the open decision below |
| `account_opening_date` | `activationDate` | | |
| `account_status` | `accountState` | DORMANT: Dormant; otherwise Active | 2,175 Active, 990 Dormant |
| `balance` | `balances.totalBalance` | Total balance, rounded to 2 decimals | Sum 15,726,729.38, identical. Total equals available balance for all reported accounts: no blocked, locked, held or overdrawn amounts |
| `interest_rate` | `interestSettings.interestRateSettings.interestRate` | As given by Mambu (annual percentage) | Present for 2,818 of 3,165 accounts; 2,509 of them are 0, the others 5, 7, 10 or 15 |
| `zero_balance_flag` | `balances.totalBalance` | true when 0 | 733 accounts |
| `contribution_frequency` | `_centreOfDeduction.monthlyContribution` | "Monthly" when above 0, else "Irregular" | **The field does not exist in this tenant.** `_centreOfDeduction` has one key, `DepositCenterOfDeduction`, on 2,108 accounts. So every account is "Irregular" |
| `last_contribution_date`, `number_of_contributions`, `balance_trend`, `withdrawal_frequency_category`, `emergency_withdrawals_flag` | none | Fixed: none, 0, Stable, Low, false | See section 6 |

Problems found in savings:

- **Over-payment accounts counted as savings (fixed).** "Member Over-Payments" are current accounts that hold loan over-payments. 295 of them were reported as voluntary savings.
- **Current accounts counted as savings (open).** "Current Account" (765 accounts, 226,958) and "Sidzingo Savings" (19 accounts, 174,530) are of type CURRENT_ACCOUNT. They are small, and the business must decide whether transactional accounts belong in savings.
- **Permanent Savings is reported as voluntary (open decision, large).** The product "Permanent Savings" holds 751 accounts and 12,273,918 of the 15,726,729 (78%), and Mambu's own ledger header for it is "SAVINGS - (NON WITHDRAWABLE DEPOSITS)". A non-withdrawable, compulsory deposit is closer to **mandatory** savings than to voluntary savings. Today the Mandatory line shows 0 records and Voluntary shows everything. The apex can change this in Mapping, Product mapping; the Ministry should confirm the intended meaning first.
- "Resigned Members Holding" is a product for the savings of resigned members (423 accounts in the branch, 31,549 in total). It is reported for the resigned members that are still in the list.

### 4.3 Fixed deposits (`deposits:search`)

Fixed deposits are the accounts classified as fixed deposit above. For Adorsys all 49 reported accounts are of type REGULAR_SAVINGS and belong to the product "FIXED DEPOSIT - PROPERTY". The tenant also has real FIXED_DEPOSIT products (8) and SAVINGS_PLAN products (19), for example "FDA" with 9 accounts in the branch. None of them is in the reported set: their holders are not imported members, or the accounts were closed before the year.

| CoopData field | Mambu source | Rule | Check |
|---|---|---|---|
| `fixed_deposit_id` | `encodedKey` | `FD-` plus hash | |
| `start_date` | `activationDate` | | |
| `maturity_date` | `maturityDate`, else start plus the product term, else start plus 12 months | | `maturityDate` is present on **0 of 49** accounts, and the product's `maturitySettings.maturityPeriod` is empty. So all 49 maturities are assumed (12 months) and the warning `FD_MATURITY_DEFAULTED` is raised |
| `status` | `accountState` and the maturity date | MATURED: Matured; CLOSED or WITHDRAWN: Withdrawn or Matured by date; ACTIVE: Active. **An assumed maturity no longer turns an active deposit into a matured one** | Mambu: 48 Active, 1 Closed. Before the fix CoopData showed 46 Matured and 3 Active, which contradicted Mambu |
| `balance` | `balances.totalBalance` | | Sum 864,285.90, identical |
| `interest_rate` | as savings | | |
| `tenure_category`, `original_tenure_selected` | computed from the assumed term | Short up to 6 months, Medium up to 12, Long above | Always "Medium, 12 months" while the term is assumed |
| `deposit_type` | none | "Standard" | |
| `early_withdrawal_flag` | `closedDate` and maturity | true only when closed before an explicit maturity | |
| `number_of_renewals`, `rollover_at_maturity_flag`, `change_in_tenure_at_renewal`, `single_depositor_dependency_flag` | none | 0 and false | Section 6 |

The ledger line for fixed-term deposits (265,798 at 30 November) is far below the list (864,286). In Mambu these 49 accounts are booked on other ledger accounts than the ones mapped to fixed-term deposits. This is Mambu's accounting choice, and the Data Integrity table in CoopData shows the variance.

### 4.4 Loans (`loans:search`)

Structure of a loan record: `encodedKey`, `id`, `loanName` (the product name), `accountHolderKey`, `accountHolderType`, `accountState`, `accountSubState`, `loanAmount`, `daysInArrears`, `balances` (principal, interest, fees, penalty: balance, due and paid), `interestSettings`, `scheduleSettings`, `disbursementDetails`, `closedDate`, `productTypeKey`, `accruedInterest`, and the custom set `_LINFO` with one key, `loanp` (purpose).

A loan is reported when it is not pending or rejected, has a disbursement date on or before the date of the return, was not closed before the first day of the month of the return, and its borrower is an imported member.

| CoopData field | Mambu source | Rule | Check |
|---|---|---|---|
| `loan_id` | `encodedKey` | `LN-` plus hash | |
| `loan_status` | `accountState`, `accountSubState`, `daysInArrears` | CLOSED_WRITTEN_OFF or WRITTEN_OFF: Written off; RESCHEDULED or REFINANCED: Restructured; ACTIVE_IN_ARREARS with days above 0: Arrears; otherwise Performing | All reported loans are ACTIVE (170) or ACTIVE_IN_ARREARS (464). No loan in the reported set is restructured or written off, because those are closed |
| `days_past_due_category` | `daysInArrears` | 0, 1 to 30, 31 to 60, 61 to 90, 91 and over | Replica (data of 5 November): 170 / 299 / 44 / 16 / 105. Stored (data of 4 November): 198 / 278 / 40 / 13 / 105. The 28 loans that moved are the daily ageing of the sandbox between the two dates; the principal is identical |
| `repayment_regularity` | days in arrears | 0: Regular; 1 to 90: Irregular; over 90 or written off: Default | Derived, not read from Mambu |
| `balance` | `balances.principalBalance` | Outstanding principal only | Sum 12,114,986.10, identical. Zero for written-off loans |
| `loan_amount` | `loanAmount` | The approved amount | Sum 16,760,212.65, identical |
| `loan_start_date` | `disbursementDetails.disbursementDate` | | |
| `loan_maturity_date` | `scheduleSettings` | First repayment date plus (installments minus 1) periods | Computed; Mambu has no maturity field on the loan |
| `interest_rate` | `interestSettings.interestRate` and `interestChargeFrequency` | Annualised: times 12 for EVERY_MONTH, 13 for EVERY_FOUR_WEEKS, 52 for EVERY_WEEK, 365 for EVERY_DAY, 1 for ANNUALIZED | Values seen: 2.5% a month (336 loans, 30% a year), 1.25% (235, 15%), 1.5% (48, 18%), 7% annual (3), 1.8% every four weeks (6). Stored range 0 to 66, average 23.2 |
| `loan_product_type` | product name and purpose, or a product mapping | Education, Agriculture, Business, Other or Personal by key words | **630 of 634 are "Personal".** The product names (Quick Loan, Long Term Loan, Executive Loan, Mid Term Loan, Development Loan, Smart Loan) contain no key word, and the purpose field `_LINFO.loanp` is filled for only 20 loans. So the type is a default, not information. Warning `LOAN_TYPE_DEFAULTED` |
| `borrower_type` | `accountHolderType` | GROUP: Group; otherwise Individual | All 634 are Individual |
| `youth_borrower_flag`, `women_borrower_flag` | the borrower's member record | Set from the member's age group and gender when the return is saved | 231 multiple-loan flags, women and youth borrowers follow the members |
| `multiple_loans_flag` | computed | A member with more than one open loan with a balance | 112 members, 231 loans |
| `rural_borrower_flag`, `large_borrower_flag`, `early_settlement_flag`, `missed_installments_count` | none | false and 0 | Section 6 |

**Loans against the ledger.** The list holds principal for the 634 loans of imported members: 12,114,986. The ledger line for the loan portfolio at 30 November is 14,351,183. Adding principal, interest, fees and penalties of **all** 772 active loans of the branch (including the 138 whose borrower is not an imported member) gives 14,360,494, which is within 9,311 (0.06%) of the ledger. So the difference between the list and the ledger is explained: interest balance (about 0.3M), fees (about 0.5M) and the loans of members who are left out (1.4M principal).

### 4.5 Ledger (`gljournalentries:search`, with `glaccounts` and accounting reports)

The financial statement is rebuilt from the Mambu general ledger, not from the accounting reports, because the reports are unreliable for older periods.

Structure of a journal line: `encodedKey`, `entryID`, `bookingDate`, `creationDate`, `transactionId`, `accountKey`, `productKey`, `productType`, `amount`, `type` (DEBIT or CREDIT), `assignedBranchKey` and the full `glAccount` (`glCode`, `type`, `name`, `usage`, `currency`).

How the statement is built:

1. Every line of the branch is read, month by month, up to the last month of the return. Lines in another currency than SZL are left out.
2. Lines are added up per account and month. The balance of an account at a month end is the sum of all months up to then. Assets and expenses are debit minus credit; liabilities, equity and income are credit minus debit (the signs of the Mambu balance sheet screen).
3. Closed months (ended more than 45 days ago) are kept in the database (`mambu_ledger_months`), so later syncs read only the recent months.
4. Each Mambu account is mapped to a CoopData account: a direct mapping (147 rows in `mambu_account_mappings`) or the nearest header account below the account's code (headers are read from `glaccounts`). Unmapped accounts go to a default account of their type and raise `LEDGER_UNMAPPED`; the apex cannot submit while any exist.
5. Balance sheet lines use the closing balance of the month. Income and expense lines use the movement of the month.
6. Accumulated and current-year surplus are split with the earnings at the end of the previous year, computed from the same ledger.
7. Section subtotals and totals (1100, 1200, 1250, 1300, 1999, 2100, 2200, 2300, 2999, 3100, 3200, 3300, 3999, 4100, 4200, 4999, 5100, 5200, 5300, 5999, 6999) are worked out from the formulas of the CoopData chart of accounts.
8. For the current month only, loans in arrears are moved from "performing" into the arrears lines (1202 to 1205) from the loan list.

What was checked:

| Check | Result |
|---|---|
| Debits equal credits over the whole history of ES0006 (September 2020 to August 2026, 72 months, 5,569 account-month rows, 190 accounts) | 687,837,343.64 on both sides. No month has a gap |
| Assets equal liabilities plus equity in every month of 2026 | Yes, to the cent (for example November: 22,256,215.14 = 16,118,155.77 + 6,138,059.37) |
| November compared with Mambu's own accounting report for November (which balances) | Every line compared is identical: cash on hand 66,499.10, cash at bank 1,945,768.93 and 109,292.72, loans 14,328,199.44, savings 15,204,586.83, share capital 3,247,105.23, statutory reserve 794,599.00 |
| 31 March, 30 June and 31 August against Mambu's reports for those dates | Not usable. Mambu's own reports for these dates do not balance (a gap of about 7 million) and differ on about 20 accounts, so they cannot serve as a reference |
| Same fault on other branches (ES0002, ES0003, SA0003) | Yes: Mambu's older reports do not balance there either. It is a tenant-wide problem of Mambu's reporting |
| Against the Mambu Balance Sheet screen figures supplied earlier (assets 20,205,474.26) | Inconclusive: the date of the screen was not known. The closest day, 15 January 2026, gives 20,207,284 |
| Mapping coverage at 31 August 2026 | 141 accounts with a balance: 20 mapped directly, 121 through a header, 0 unmapped |

Ledger accounts that look wrong or need a business review (not changed by the audit, because they are in Mambu's own books):

- **9701 "NET LOSS/PROFIT"** (an expense account, 1,149,674). It looks like a profit and loss closing account and is mapped to administrative expenses, so it inflates expenses. Ask the SACCO's accountant.
- **9107 "SALARIES" (5.26M) and 9101 "NET PAY" (2.33M)** are both expenses mapped to personnel costs. If net pay is part of the gross salary it is counted twice.
- **3016 "SUSPENSE ACCOUNT"** (779K) is mapped to accounts receivable.
- **6721 "GENERAL RESERVES"** is negative (about −5.1M), and moved by −765K in September. October administrative expenses are negative (−610K), which looks like a reversal.
- **1259 "INTER COMPANY ACCOUNT"** (1.78M) sits under the header "FINANCIAL INVESTMENTS" and is mapped to accounts receivable.

### 4.6 Indicators counted from the member list

| Indicator | Rule | Value for Adorsys |
|---|---|---|
| `new_members_joined` | Members whose join date is in the period | 146 |
| `members_exited` | Members whose exit date is in the period | 31 |
| `women_members_count` | Members still in the SACCO that are women | 576 |
| `youth_members_count` | Members still in the SACCO aged 18 to 35 | 190 |
| `total_board_members`, `female_board_members` | Members still in the SACCO with `mcat = board` | 10 board members (new) |

### 4.7 Reference data

- **Branches** (`/branches`): 33 branches. Used to search by name and to link. The branch record of ES0006 carries no address, so the branch cannot give a region.
- **Products**: 134 deposit products (86 regular savings, 21 current account, 19 savings plan, 8 fixed deposit) and 236 loan products (170 dynamic-term, 40 fixed-term, 26 interest-free). Used for the product names, fixed-deposit terms and the product mapping screen.
- **Chart of accounts**: 663 ledger accounts (199 assets, 189 liabilities, 146 expenses, 106 income, 23 equity; 615 detail and 48 header accounts).

---

## 5. Data volume and speed measured

| Step | Size for ES0006 | Time |
|---|---|---|
| Members, deposits and loans | 2,906 clients, 10,077 deposits, 4,146 loans (about 87 pages of 200) | About 2 minutes, read at the same time |
| Ledger, first read | 640,432 lines before 2026 and 5,000 to 9,000 a month | About 30 minutes once, then kept |
| Ledger, later syncs | The last three months | About 3 minutes |
| A search page of 1,000 records | clients 3.5 s, deposits 3.2 s, loans 19 s | Loans are the slow list |

---

## 6. What Mambu does not provide

These CoopData fields have no source in Mambu. CoopData stores a fixed value so the record is complete. **The values are not real data.** Since this audit a warning (`FIELDS_NOT_IN_MAMBU`) says so on every import.

| Record | Fields without a Mambu source | Fixed value |
|---|---|---|
| Member | `urban_rural` | Unknown |
| Member | `agm_attendance`, `voting_exercised` | false |
| Savings | `contribution_frequency` (the expected custom field does not exist in this tenant) | Irregular |
| Savings | `number_of_contributions`, `last_contribution_date` | 0, none |
| Savings | `balance_trend` | Stable |
| Savings | `withdrawal_frequency_category`, `emergency_withdrawals_flag` | Low, false |
| Fixed deposit | `number_of_renewals`, `rollover_at_maturity_flag`, `change_in_tenure_at_renewal`, `single_depositor_dependency_flag`, `deposit_type` | 0, false, false, false, Standard |
| Fixed deposit | `maturity_date` and the term, when the account and product have none | Assumed 12 months |
| Loan | `missed_installments_count`, `early_settlement_flag`, `large_borrower_flag`, `rural_borrower_flag` | 0, false, false, false |
| Loan | a real loan purpose or type | Personal |
| Indicators | AGM held, board meetings, audited accounts, CEO appointed, core banking, mobile banking, IT staff, trainings, CSR and community projects, regulatory returns, loan and insurance products offered | Not imported; entered by hand |
| Farm cooperative section | everything | Not applicable to SACCOs |

Some of these could be calculated later from Mambu's transaction history (`deposits/transactions:search` is readable): contribution frequency and count, last contribution, balance trend, withdrawal behaviour. `installments` (readable) could give missed installments. Governance data (AGM, board meetings, audits, systems, training) is not in Mambu in any form.

**Where the fixed values still mislead.** The indicator engine counts the fixed values as real data. For an imported return, the charts "AGM participation", "Voting", "Urban and rural", "Rural borrowers", "Large borrowers", "Balance trend", "High withdrawers", "Emergency withdrawals", "Single depositor concentration" and "Regular savers" therefore show 0% (or 100% Stable), not "no data". A reader can mistake 0% for a bad result. The warning on the import says why, but the charts themselves do not. This is the main remaining way CoopData can mislead, and the recommended fix is in section 8.

---

## 7. Reading the dates correctly

- The lists (members, savings, fixed deposits, loans) are Mambu's state **at the moment of the sync**, not at the end of each month. A whole-year return repeats the same lists in every month. Only the ledger is truly month by month. The warning `LISTS_AS_AT_SYNC_TIME` is raised when the date of the return is in the past.
- The "date of the return" used by the rules is the last day of the last month of the period. For the current year this is the end of the current month, which is in the future; nothing can be opened after today, so it makes no difference, but the comment on the submission now reads "the month to date".
- Loans closed before the first day of the month of the return are left out. For a whole-year return this means loans that were disbursed and repaid earlier in the year are not in the loan list.
- A day passing changes the loan arrears (28 loans moved between 4 and 5 November in the sandbox). Two syncs of the same data on different days can differ.

---

## 8. Open decisions and recommendations

| # | Question | Recommendation |
|---|---|---|
| 1 | Is "Permanent Savings" (78% of savings) voluntary or mandatory? | Ask the Ministry. If it is compulsory, map the product to Mandatory under Mapping |
| 2 | Are current accounts part of savings? | Decide per product; the amounts are small |
| 3 | Show "not reported" instead of 0% for the fields in section 6 | Build: mark such a field as "not available" for returns made by Mambu and hide or grey the matching charts. Not built yet |
| 4 | Contribution behaviour, balance trend, withdrawals, missed installments | Build from `deposits/transactions:search` and `installments`. The transaction search is heavy (272,143 lines for one branch) |
| 5 | Region of the 35% of members without one in Mambu | Ask the SACCO to fill `RG`, or accept the approximation. Warning `MEMBER_REGION_ASSUMED` counts them |
| 6 | Loan type | Map the loan products (Quick, Long Term, Executive, Mid Term, Development, Smart) to a type under Mapping |
| 7 | The ledger accounts listed in 4.5 | Ask the SACCO's accountant |
| 8 | Real maturity of fixed deposits | Set the term on the product in Mambu, or enter it in the product mapping once supported |
| 9 | Members with a missing birth or join date, and placeholder birth dates | Fix in Mambu. 4 and 7 members are left out; 43 birth years are implausible |
| 10 | Production Mambu | Everything here was proved on the sandbox. The same checks must be repeated on the real tenant: field names such as `_ADL.mcat`, `_ADL.dateJoined`, `_ADL.RG`, `_LINFO.loanp` belong to this tenant's custom fields and may differ |

---

## 9. Warning codes

| Code | Level | Meaning |
|---|---|---|
| `LEDGER_FROM_JOURNAL` | info | The ledger was rebuilt from journal entries |
| `LEDGER_FROM_REPORTS` | warning | The journal could not be read; accounting reports were used |
| `LEDGER_DOES_NOT_BALANCE`, `LEDGER_MONTHS_UNRELIABLE` | warning | An accounting report did not balance; those months are empty |
| `LEDGER_EMPTY` | warning | No ledger lines for the period |
| `LEDGER_UNMAPPED` | warning | Ledger accounts have no mapping; the apex cannot submit |
| `SURPLUS_NOT_SPLIT` | warning | Accumulated and current-year surplus could not be separated |
| `ARREARS_SPLIT_CURRENT_MONTH` | info | The arrears lines come from the loan list and apply to the current month only |
| `LISTS_AS_AT_SYNC_TIME` | warning | Lists show the state at the time of the sync |
| `FD_MATURITY_DEFAULTED` | warning | Maturity date or term missing in Mambu; 12 months assumed |
| `DEPOSITS_IGNORED_BY_PRODUCT` | info | Accounts of collection, payout, tax or similar products are not reported |
| `MEMBER_REGION_ASSUMED` | info | Members without a region got the cooperative's region |
| `LOAN_TYPE_DEFAULTED` | info | Loans reported as Personal because nothing says otherwise |
| `FIELDS_NOT_IN_MAMBU` | info | Lists the fields that carry a fixed value |
| `REFERENCE_DATA_UNAVAILABLE` | warning | Branches, products or chart accounts could not be read; the sync went on without |
| `MEMBER_BIRTH_DATE_MISSING`, `MEMBER_JOIN_DATE_MISSING`, `MEMBER_REGION_MISSING`, `MEMBER_EXIT_DATE_MISSING` | warning | Members left out for missing data |
| `MEMBER_BLACKLISTED`, `MEMBER_EXITED_BEFORE_YEAR`, `MEMBER_JOINED_AFTER_DATE`, `MEMBER_STATE_NOT_SUPPORTED` | info | Members left out by rule |
| `ACCOUNT_NOT_ACTIVE`, `ACCOUNT_NOT_OPEN_AT_DATE`, `START_DATE_MISSING`, `HOLDER_NOT_IN_MEMBER_LIST` | info | Accounts left out |
| `LOAN_NOT_DISBURSED`, `LOAN_CLOSED_BEFORE_PERIOD` | info | Loans left out |

An import with warnings of level "warning" can only be submitted by the apex after it confirms that it read them. Unmapped ledger accounts block the submit.

---

## 10. Limits of this evidence

- One tenant (the sandbox) and one branch checked in depth (ES0006). Sizes and data completeness of seven other branches were read (36 to 1,087 clients). The sandbox may contain generated data: for example 69% of Adorsys loans are in arrears, which would be unusual for a real SACCO.
- The independent replica checks that the code follows its rules. It cannot prove that the rules are what the Ministry wants; that is what section 8 asks.
- The Mambu screen figures given earlier could not be matched to a date, so the ledger has no confirmation from the Mambu user interface yet. The recommended check is the Balance Sheet of ES0006 as of 30 November 2026: expected total assets 22,256,215.14 and total liabilities 16,118,155.77.
- Mambu's older accounting reports are wrong on this tenant, so there is no second source for past months other than the journal's own internal balance.

---

## 11. How to repeat the checks

1. Download the clients, deposits, loans, products and ledger accounts of one branch with the read-only user, using the search endpoints of section 3.
2. Apply the rules of section 4 in a separate script.
3. Compare counts and sums with the stored return (`members`, `savings_accounts`, `fixed_deposits`, `loans`, `balance_sheet_line_items`).
4. Reconcile the loan list with the ledger (principal, interest, fees and penalties of all active loans against ledger line 1200) and the ledger with Mambu's report for a recent month.
5. Delete the downloaded files. They contain personal data.
