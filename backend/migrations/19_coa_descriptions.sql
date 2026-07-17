-- Migration 19: Add description column to chart_of_accounts
-- This description is injected into the LLM prompt so it knows exactly
-- what each account code means and what values it should contain.

ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE chart_of_accounts SET description = CASE account_code
  -- ASSETS
  WHEN 1101 THEN 'Physical cash held in the cooperative office safe or teller drawers. Includes petty cash. Always positive.'
  WHEN 1102 THEN 'Balance in current/cheque bank accounts used for daily operations. Always positive.'
  WHEN 1103 THEN 'Balance in bank savings accounts earning interest. Always positive.'
  WHEN 1104 THEN 'Treasury bills, money market instruments, and other short-term investment securities. Always positive.'
  WHEN 1100 THEN 'Sum of all liquid assets: 1101+1102+1103+1104. Do not map individual items here.'
  WHEN 1201 THEN 'Performing loans: current, up-to-date repayments, 0 days past due. The main component of the loan portfolio.'
  WHEN 1202 THEN 'Loans that are 1 to 30 days late in repayment. Early delinquency bucket.'
  WHEN 1203 THEN 'Loans that are 31 to 60 days late in repayment. Substandard bucket.'
  WHEN 1204 THEN 'Loans that are 61 to 90 days late in repayment. Doubtful bucket.'
  WHEN 1205 THEN 'Non-performing loans: 91+ days past due, written-off, or restructured. Also called bad loans or NPLs. Always positive.'
  WHEN 1200 THEN 'Sum of all loan categories: 1201+1202+1203+1204+1205. Gross loan portfolio before provisions. Do not map individual items here.'
  WHEN 1251 THEN 'General (collective) provision against loan losses. MUST be stored as a NEGATIVE number (e.g., -8000). Reduces net loan portfolio.'
  WHEN 1252 THEN 'Specific provision for identified non-performing loans. MUST be stored as a NEGATIVE number. Reduces net loan portfolio.'
  WHEN 1250 THEN 'Total loan loss provisions: 1251+1252. Sum is negative. Do not map individual items here.'
  WHEN 1301 THEN 'Amounts owed to the cooperative by non-members or other entities. Receivables, debtors.'
  WHEN 1302 THEN 'Expenses paid in advance such as rent, insurance premiums. Always positive.'
  WHEN 1303 THEN 'Land, buildings, furniture, computers, vehicles at original purchase cost. Always positive.'
  WHEN 1304 THEN 'Cumulative depreciation charged on fixed assets. MUST be stored as a NEGATIVE number (e.g., -20000). Net book value = 1303 + 1304.'
  WHEN 1305 THEN 'Software licences, trademarks, goodwill. Usually small or zero for rural cooperatives.'
  WHEN 1300 THEN 'Sum of other assets: 1301+1302+1303-1304+1305. Do not map individual items here.'
  WHEN 1999 THEN 'TOTAL ASSETS = 1100 + 1200 - 1250 + 1300. The grand total of everything the cooperative owns. Always positive.'
  -- LIABILITIES
  WHEN 2101 THEN 'Member savings deposited voluntarily. The primary funding source for most SACCOs. Always positive as a liability.'
  WHEN 2102 THEN 'Savings that members are required to maintain as a condition of membership or loans. Always positive.'
  WHEN 2103 THEN 'Fixed-term deposits locked for a specified period. Always positive.'
  WHEN 2100 THEN 'Total member deposits: 2101+2102+2103. Do not map individual items here.'
  WHEN 2201 THEN 'Loans borrowed from banks or other institutions repayable within 12 months.'
  WHEN 2202 THEN 'Loans borrowed from banks or other institutions repayable after 12 months.'
  WHEN 2200 THEN 'Total borrowings: 2201+2202. Do not map individual items here.'
  WHEN 2301 THEN 'Amounts owed to suppliers or creditors for goods/services received but not yet paid.'
  WHEN 2302 THEN 'Expenses incurred but not yet paid: salaries payable, interest payable, audit fees.'
  WHEN 2303 THEN 'Income received in advance that has not yet been earned.'
  WHEN 2300 THEN 'Total other liabilities: 2301+2302+2303. Do not map individual items here.'
  WHEN 2999 THEN 'TOTAL LIABILITIES = 2100 + 2200 + 2300. Everything the cooperative owes to members and third parties.'
  -- EQUITY
  WHEN 3101 THEN 'Non-withdrawable share capital permanently committed by members. Also called permanent shares or institutional capital.'
  WHEN 3102 THEN 'Shares that members can withdraw under certain conditions. Also called redeemable shares.'
  WHEN 3100 THEN 'Total member shares: 3101+3102. Do not map individual items here.'
  WHEN 3201 THEN 'Legally required reserve, typically 20% of net surplus per year. Cannot be distributed to members.'
  WHEN 3202 THEN 'Discretionary reserve set aside by management or board for future use.'
  WHEN 3203 THEN 'Reserve held to maintain capital adequacy ratio. May also be called risk reserve.'
  WHEN 3200 THEN 'Total reserves: 3201+3202+3203. Do not map individual items here.'
  WHEN 3301 THEN 'Accumulated surpluses (or deficits) from all prior years. Also called retained earnings or accumulated surplus. Can be negative if historical losses.'
  WHEN 3302 THEN 'Net surplus (or deficit) for the CURRENT financial year only. Positive = profit; negative = loss.'
  WHEN 3300 THEN 'Total retained earnings: 3301+3302. Do not map individual items here.'
  WHEN 3999 THEN 'TOTAL EQUITY = 3100 + 3200 + 3300. Net worth of the cooperative, owned by members.'
  -- INCOME
  WHEN 4101 THEN 'Interest earned on loans given to members. The main revenue source for most cooperatives.'
  WHEN 4102 THEN 'Fees, service charges, commissions charged to members for loans, accounts, transactions.'
  WHEN 4100 THEN 'Total financial income: 4101+4102. Do not map individual items here.'
  WHEN 4201 THEN 'Rental income, investment returns, government grants, other non-lending income.'
  WHEN 4200 THEN 'Total other income: 4201. Do not map individual items here.'
  WHEN 4999 THEN 'TOTAL INCOME = 4100 + 4200. All income from all sources.'
  -- EXPENSES
  WHEN 5101 THEN 'Interest paid to members on their voluntary/mandatory savings and fixed deposits.'
  WHEN 5102 THEN 'Interest paid on external borrowings from banks or apex bodies.'
  WHEN 5100 THEN 'Total financial expenses: 5101+5102. Do not map individual items here.'
  WHEN 5201 THEN 'Salaries, wages, social security contributions, staff training costs.'
  WHEN 5202 THEN 'Office rent, utilities, printing, stationery, communications, IT costs.'
  WHEN 5203 THEN 'Board meeting costs, AGM costs, audit committee expenses, director allowances.'
  WHEN 5204 THEN 'Annual depreciation charge on fixed assets. Also called amortization for intangibles.'
  WHEN 5200 THEN 'Total operating expenses: 5201+5202+5203+5204. Do not map individual items here.'
  WHEN 5301 THEN 'Expense charged to income statement for loan loss provisions created this year.'
  WHEN 5300 THEN 'Total credit loss expense: 5301. Do not map individual items here.'
  WHEN 5999 THEN 'TOTAL EXPENSES = 5100 + 5200 + 5300. All costs.'
  -- SURPLUS
  WHEN 6999 THEN 'NET SURPLUS/(DEFICIT) = Total Income - Total Expenses. Positive = profit; negative = loss. Also the same as 3302.'
  ELSE NULL
END
WHERE description IS NULL;
