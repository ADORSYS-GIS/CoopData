-- Migration 21: Populate CoA descriptions for AI extraction guidance
-- These descriptions help the LLM correctly map free-text labels from uploaded
-- financial statements to the canonical Chart of Accounts codes.
-- Each description covers: what the account is, sign convention, common aliases,
-- and parent/child relationship notes.

UPDATE chart_of_accounts SET description = desc_text FROM (VALUES

-- ── ASSETS ───────────────────────────────────────────────────────────────────
(1999, 'TOTAL ASSETS — Grand total of all asset categories. Sum of liquid assets (1100), net loan portfolio (1200 minus 1250), and other assets (1300). Maps to: "Total assets", "Total resources". Always positive. Use this code only for the grand total row.'),
(1100, 'LIQUID ASSETS — Section header/subtotal for all cash and near-cash items. Sum of 1101+1102+1103+1104. Maps to: "Cash and cash equivalents", "Liquid resources", "Current assets - cash". Do NOT map individual cash line items here.'),
(1101, 'CASH ON HAND — Physical cash held at the cooperative premises or in a petty cash box. Maps to: "Cash in hand", "Petty cash", "Cash at till", "Imali", "Till cash". Always positive.'),
(1102, 'CASH AT BANK (CURRENT) — Funds in a commercial bank current/checking account. Maps to: "Bank current account", "Checking account balance", "Current bank account", "Cash at bank - current". Always positive.'),
(1103, 'CASH AT BANK (SAVINGS) — Funds in a commercial bank savings account. Maps to: "Bank savings account", "Savings bank balance", "Cash at bank - savings". Always positive.'),
(1104, 'SHORT-TERM INVESTMENTS — Treasury bills, fixed deposits maturing within 12 months, money market instruments. Maps to: "Treasury bills", "T-bills", "Short-term deposits", "Call deposits", "Near-cash investments", "Money market". Always positive.'),

(1200, 'LOANS & ADVANCES — Section header/subtotal for the gross loan portfolio before provisions. Sum of 1201+1202+1203+1204+1205. Maps to: "Gross loan portfolio", "Total loans", "Loans and advances - gross". Do NOT map individual loan quality buckets here.'),
(1201, 'PERFORMING LOAN PORTFOLIO — Loans where borrowers are fully current on repayments (0 days past due). Maps to: "Current loans", "Good loans", "Performing loans", "Loans - performing", "Loans current". Always positive.'),
(1202, 'LOANS IN ARREARS (1-30 DAYS) — Loans with payments overdue 1 to 30 days. Maps to: "PAR 1-30", "Loans past due 1-30 days", "Early arrears", "1-30 day arrears". Always positive.'),
(1203, 'LOANS IN ARREARS (31-60 DAYS) — Loans with payments overdue 31 to 60 days. Maps to: "PAR 31-60", "Loans past due 31-60 days", "31-60 day arrears". Always positive.'),
(1204, 'LOANS IN ARREARS (61-90 DAYS) — Loans with payments overdue 61 to 90 days. Maps to: "PAR 61-90", "Loans past due 61-90 days", "61-90 day arrears", "Sub-standard loans". Always positive.'),
(1205, 'NON-PERFORMING LOANS — Loans overdue more than 90 days, written off, or classified as loss. Maps to: "NPL", "Bad loans", "Doubtful loans", "Loss loans", "Written-off loans", "Loans >90 days", "Non-performing". Always positive (the gross amount before write-off).'),

(1250, 'ALLOWANCE FOR LOAN LOSSES — Section header/subtotal for all loan loss provisions. Sum of 1251+1252. Maps to: "Loan loss reserve", "Provision for bad debts", "Allowance for credit losses". ALWAYS stored as a NEGATIVE number (it reduces the asset value).'),
(1251, 'GENERAL LOAN LOSS PROVISION — Collective/statistical provision held against the whole performing portfolio as a regulatory buffer. Maps to: "GLLP", "General provision", "Collective provision", "Portfolio provision". ALWAYS NEGATIVE (e.g. -50000). Deducted from gross loans to give net portfolio.'),
(1252, 'SPECIFIC LOAN LOSS PROVISION — Provision held against individual identified impaired loans. Maps to: "SLLP", "Specific provision", "Individual impairment", "Specific allowance". ALWAYS NEGATIVE (e.g. -20000). Deducted from gross loans to give net portfolio.'),

(1300, 'OTHER ASSETS — Section header/subtotal for non-loan, non-cash assets. Sum of 1301+1302+1303-1304+1305. Maps to: "Other assets", "Non-current assets", "Fixed and other assets". Do NOT map individual items here.'),
(1301, 'ACCOUNTS RECEIVABLE — Amounts owed to the cooperative by third parties (not member loans). Maps to: "Debtors", "Trade receivables", "Sundry debtors", "Receivables", "Amounts due from members" (non-loan). Always positive.'),
(1302, 'PREPAID EXPENSES — Expenses paid in advance not yet consumed. Maps to: "Prepayments", "Prepaid costs", "Advance payments", "Deferred expenses". Always positive.'),
(1303, 'FIXED ASSETS (COST) — Property, plant and equipment at historical/original cost before depreciation. Maps to: "PP&E (cost)", "Property plant and equipment", "Fixed assets at cost", "Tangible assets - cost", "PPE". Always positive — DO NOT net against depreciation here.'),
(1304, 'ACCUMULATED DEPRECIATION — Total depreciation charged against fixed assets since acquisition. Maps to: "Accumulated depreciation", "Accum. depreciation", "Depreciation to date", "Total depreciation". ALWAYS NEGATIVE (e.g. -30000). Deducted from 1303 to give net book value.'),
(1305, 'INTANGIBLE ASSETS — Non-physical long-term assets such as software, goodwill, licenses. Maps to: "Intangibles", "Software", "Goodwill", "Licenses", "Computer software". Always positive.'),

-- ── LIABILITIES ──────────────────────────────────────────────────────────────
(2999, 'TOTAL LIABILITIES — Grand total of all liability categories. Sum of member deposits (2100), borrowings (2200), and other liabilities (2300). Maps to: "Total liabilities", "Total obligations". Always positive. Use only for the grand total row.'),
(2100, 'MEMBER DEPOSITS & SAVINGS — Section header/subtotal for all forms of member savings deposits. Sum of 2101+2102+2103. Maps to: "Total member savings", "Total deposits", "Member savings - total". Do NOT map individual savings types here.'),
(2101, 'VOLUNTARY SAVINGS — Savings deposited by members at their own discretion, withdrawable on demand or with notice. Maps to: "Voluntary deposits", "Member voluntary savings", "Demand deposits", "Passbook savings". Always positive.'),
(2102, 'MANDATORY SAVINGS — Compulsory savings members must maintain as a condition of membership or loan eligibility. Maps to: "Compulsory savings", "Mandatory deposits", "Minimum savings", "Share savings", "Forced savings". Always positive.'),
(2103, 'FIXED-TERM DEPOSITS — Member savings locked in for a fixed period at a contracted interest rate. Maps to: "Fixed deposits", "Term deposits", "Time deposits", "Fixed-term savings", "FDs". Always positive.'),

(2200, 'BORROWINGS — Section header/subtotal for all external loans and lines of credit. Sum of 2201+2202. Maps to: "Total borrowings", "External debt", "Loans payable - total". Do NOT map individual borrowing lines here.'),
(2201, 'SHORT-TERM BORROWINGS — Loans and credit lines from banks or other institutions due within 12 months. Maps to: "Bank overdraft", "Short-term loans", "Current portion of debt", "Short-term credit", "Lines of credit due <1yr". Always positive.'),
(2202, 'LONG-TERM BORROWINGS — Loans from banks, development finance institutions, or apex bodies due after 12 months. Maps to: "Long-term loans", "Long-term debt", "Term loans", "Development finance loans", "Apex borrowings", "Non-current debt". Always positive.'),

(2300, 'OTHER LIABILITIES — Section header/subtotal for non-deposit, non-borrowing obligations. Sum of 2301+2302+2303. Maps to: "Other liabilities", "Trade payables and accruals". Do NOT map individual items here.'),
(2301, 'ACCOUNTS PAYABLE — Amounts owed to suppliers and service providers for goods/services already received. Maps to: "Trade payables", "Creditors", "Sundry creditors", "Amounts owed to suppliers", "Trade creditors". Always positive.'),
(2302, 'ACCRUED EXPENSES — Expenses incurred but not yet paid or invoiced (e.g. accrued salaries, interest). Maps to: "Accruals", "Accrued liabilities", "Accrued charges", "Outstanding expenses", "Accrued interest payable". Always positive.'),
(2303, 'DEFERRED INCOME — Revenue received in advance not yet earned. Maps to: "Deferred revenue", "Unearned income", "Income received in advance", "Advance income". Always positive.'),

-- ── EQUITY ───────────────────────────────────────────────────────────────────
(3999, 'TOTAL EQUITY — Grand total of member equity. Sum of member shares (3100), reserves (3200), and retained earnings (3300). Maps to: "Total equity", "Members equity", "Net assets", "Total members funds", "Shareholders equity". Can be positive or negative.'),
(3100, 'MEMBER SHARES — Section header/subtotal for all share capital. Sum of 3101+3102. Maps to: "Share capital - total", "Member share capital". Do NOT map individual share classes here.'),
(3101, 'PERMANENT SHARE CAPITAL — Non-withdrawable shares that form the permanent capital base of the cooperative. Maps to: "Permanent shares", "Non-withdrawable shares", "Ordinary share capital", "Membership shares", "Core capital shares". Always positive.'),
(3102, 'WITHDRAWABLE SHARES — Shares that members can redeem upon exit from the cooperative. Maps to: "Redeemable shares", "Withdrawable share capital", "Member redeemable shares", "Transferable shares". Always positive.'),

(3200, 'RESERVES — Section header/subtotal for all legally and internally designated reserve funds. Sum of 3201+3202+3203. Maps to: "Total reserves", "Reserve funds". Do NOT map individual reserves here.'),
(3201, 'STATUTORY RESERVE — Legally mandated reserve fund, typically a percentage of annual surplus set aside by law. Maps to: "Legal reserve", "Mandatory reserve", "Cooperative reserve fund", "Compulsory reserve". Always positive.'),
(3202, 'GENERAL RESERVE — Discretionary reserve set aside by the board for general purposes such as capital growth or risk buffer. Maps to: "General reserve fund", "Institutional capital reserve", "Board reserve", "Undivided earnings reserve". Always positive.'),
(3203, 'RISK/CAPITAL ADEQUACY RESERVE — Reserve specifically held to maintain capital adequacy ratios or absorb unexpected losses. Maps to: "Capital reserve", "Risk reserve", "Capital adequacy reserve", "CAR reserve", "Prudential reserve". Always positive.'),

(3300, 'RETAINED EARNINGS — Section header/subtotal for accumulated and current year operating results. Sum of 3301+3302. Maps to: "Total retained earnings", "Accumulated results". Do NOT map individual retained earnings lines here.'),
(3301, 'ACCUMULATED SURPLUS — Net surplus (or deficit) from all prior financial years carried forward. Maps to: "Retained surplus", "Retained earnings - prior years", "Accumulated profit", "Brought forward surplus", "Prior year surplus". Positive = surplus, Negative = accumulated deficit.'),
(3302, 'CURRENT YEAR SURPLUS — Net surplus or deficit for the current reporting period only. Maps to: "Net surplus", "Net income", "Profit for the year", "Current year profit", "Net deficit", "Net income for the period", "Profit or loss this year". Positive = surplus, Negative = deficit.'),

-- ── INCOME ───────────────────────────────────────────────────────────────────
(4999, 'TOTAL INCOME — Grand total of all income earned. Sum of financial income (4100) and other income (4200). Maps to: "Total income", "Total revenue", "Total operating income". Always positive.'),
(4100, 'FINANCIAL INCOME — Section header/subtotal for income from core lending and financial services. Sum of 4101+4102. Maps to: "Financial income - total". Do NOT map individual income lines here.'),
(4101, 'INTEREST INCOME FROM LOANS — Interest earned on the loan portfolio from member borrowers. Maps to: "Loan interest income", "Interest on loans", "Interest received on advances", "Interest from members", "Lending income". Always positive.'),
(4102, 'FEES & COMMISSIONS INCOME — Fees charged for services: loan processing, account maintenance, insurance, ATM. Maps to: "Fee income", "Commission income", "Service charges", "Transaction fees", "Service fees", "Non-interest income from fees". Always positive.'),
(4200, 'OTHER INCOME — Section header/subtotal for non-core income. Sum of 4201. Maps to: "Other income - total". Do NOT map individual items here.'),
(4201, 'OTHER OPERATING INCOME — Income from non-core activities: rental income, dividends received, grant income. Maps to: "Non-financial income", "Miscellaneous income", "Other revenue", "Rental income", "Investment income", "Grant income". Always positive.'),

-- ── EXPENSES ─────────────────────────────────────────────────────────────────
(5999, 'TOTAL EXPENSES — Grand total of all expenses incurred. Sum of financial expenses (5100), operating expenses (5200), and credit loss expense (5300). Maps to: "Total expenses", "Total costs", "Total operating expenses". Always positive on the expense side.'),
(5100, 'FINANCIAL EXPENSES — Section header/subtotal for interest paid to depositors and lenders. Sum of 5101+5102. Maps to: "Financial expenses - total", "Interest expenses - total". Do NOT map individual items here.'),
(5101, 'INTEREST EXPENSE ON DEPOSITS — Interest paid to members on their savings accounts and fixed deposits. Maps to: "Interest paid on savings", "Interest on deposits", "Cost of funds - member", "Savings interest expense", "Deposit interest". Always positive (expense).'),
(5102, 'INTEREST EXPENSE ON BORROWINGS — Interest paid on external loans and credit lines from banks or apex bodies. Maps to: "Interest on borrowed funds", "Bank interest expense", "Interest on loans payable", "Borrowing costs", "Finance charges". Always positive (expense).'),

(5200, 'OPERATING EXPENSES — Section header/subtotal for staff, administration, and operational costs. Sum of 5201+5202+5203+5204. Maps to: "Operating expenses - total", "Administrative and operating costs". Do NOT map individual items here.'),
(5201, 'PERSONNEL COSTS — All staff-related costs: salaries, wages, bonuses, benefits, NSSF/pension contributions. Maps to: "Staff costs", "Salaries and wages", "Employee costs", "Remuneration", "Payroll costs", "HR costs". Always positive (expense).'),
(5202, 'ADMINISTRATIVE EXPENSES — Office running costs: rent, utilities, stationery, IT, communications, travel. Maps to: "Admin costs", "Administrative costs", "Office expenses", "General expenses", "Overheads", "Operating costs". Always positive (expense).'),
(5203, 'GOVERNANCE EXPENSES — Costs related to running the cooperative governance: AGM, board meetings, director fees, training. Maps to: "Board expenses", "Committee costs", "Meeting expenses", "Director fees", "AGM costs", "Governance costs". Always positive (expense).'),
(5204, 'DEPRECIATION & AMORTIZATION — Systematic allocation of the cost of fixed and intangible assets over their useful lives. Maps to: "Depreciation", "Depreciation expense", "Amortization", "D&A", "Depreciation charge for the year". Always positive (expense). DIFFERENT from 1304 (accumulated depreciation on balance sheet).'),

(5300, 'CREDIT LOSS EXPENSE — Section header/subtotal for loan impairment charges. Sum of 5301. Maps to: "Credit loss - total". Do NOT map individual items here.'),
(5301, 'LOAN LOSS PROVISION EXPENSE — The income statement charge for increasing loan loss provisions this period. Maps to: "Provision for loan losses", "Impairment charge", "Bad debt expense", "Credit impairment", "Provision expense", "Loan loss charge". Always positive (expense). DIFFERENT from 1251/1252 (balance sheet provisions).'),

-- ── SURPLUS ──────────────────────────────────────────────────────────────────
(6999, 'NET SURPLUS/(DEFICIT) — Bottom line result: total income minus total expenses. Formula: 4999-5999. Maps to: "Net surplus", "Net deficit", "Net income", "Profit for the year", "Operating result", "Surplus for the year", "Bottom line". Positive = surplus, Negative = deficit. Use for the final P&L result row only.')

) AS t(code, desc_text)
WHERE chart_of_accounts.account_code = t.code;
