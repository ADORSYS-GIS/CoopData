COMPLETE CALCULATION ENGINE & ABNORMALITY FLAG SYSTEM
This is your comprehensive guide to all calculations your system must perform and all abnormality scenarios it must detect. Think of this as the "Health Monitor" for every financial statement uploaded.

PART 1: CALCULATION ENGINE (What the Code Must Compute)
A. PRIMARY CALCULATIONS (Always Execute)
Calculation	Formula	Purpose	When to Run
Total Liquid Assets	= 1101 + 1102 + 1103 + 1104	Compute total liquid assets from components	Always
Gross Loan Portfolio	= 1201 + 1202 + 1203 + 1204 + 1205	Total loans before provisions	Always
Net Loan Portfolio	= (1201+1202+1203+1204+1205) - (1251+1252)	Loans net of provisions	Always
Total Assets	= (1101+1102+1103+1104) + (1201+1202+1203+1204+1205) - (1251+1252) + (1301+1302+1303-1304+1305)	Sum of all asset categories	Always
Total Member Deposits	= 2101 + 2102 + 2103	Total deposit liabilities	Always
Total Borrowings	= 2201 + 2202	Total external debt	Always
Total Other Liabilities	= 2301 + 2302 + 2303	Other liabilities	Always
Total Liabilities	= (2101+2102+2103) + (2201+2202) + (2301+2302+2303)	All liabilities	Always
Total Share Capital	= 3101 + 3102	Member share capital	Always
Total Reserves	= 3201 + 3202 + 3203	All reserves	Always
Total Retained Earnings	= 3301 + 3302	All retained earnings	Always
Total Equity	= (3101+3102) + (3201+3202+3203) + (3301+3302)	All equity	Always
Total Income	= 4101 + 4102 + 4201	All income (from income statement)	Always
Total Expenses	= 5101 + 5102 + 5201 + 5202 + 5203 + 5204 + 5301	All expenses (from income statement)	Always
Net Surplus/Deficit	= Total Income - Total Expenses	Operating result	Always
B. SECONDARY CALCULATIONS (Derived Metrics)
Metric	Formula	Purpose	When to Run
Total Arrears	= 1202 + 1203 + 1204 + 1205	All past-due loans	Always
Performing Portfolio %	= 1201 / (1201+1202+1203+1204+1205) * 100	Portfolio quality	Always
Portfolio at Risk (PAR) 30 Days	= (1202+1203+1204+1205) / (1201+1202+1203+1204+1205) * 100	Early warning indicator	Always
Portfolio at Risk (PAR) 90 Days	= (1204+1205) / (1201+1202+1203+1204+1205) * 100	Severe delinquency	Always
NPL Ratio	= 1205 / (1201+1202+1203+1204+1205) * 100	Bad loan percentage	Always
Provision Coverage Ratio	= (1251+1252) / 1205 * 100	How well provisions cover NPLs	Always
Specific Provision Coverage	= 1252 / 1205 * 100	Specific provision adequacy	Always
Loan-to-Deposit Ratio	= (1201+1202+1203+1204+1205) / (2101+2102+2103) * 100	Lending efficiency	Always
Liquidity Ratio	= (1101+1102+1103+1104) / (2100+2201+2301+2302) * 100	Short-term solvency	Always
Cash Ratio	= (1101+1102+1103) / Total Assets * 100	Cash position	Always
Equity-to-Assets Ratio	= Total Equity / Total Assets * 100	Capital strength	Always
Debt-to-Equity Ratio	= Total Liabilities / Total Equity	Leverage	Always
Capital Adequacy Ratio (CAR)	= Total Equity / (Total Loans) * 100	Regulatory compliance	Always
Return on Assets (ROA)	= Net Surplus / Total Assets * 100	Profitability efficiency	Always
Return on Equity (ROE)	= Net Surplus / Total Equity * 100	Member returns	Always
Operating Efficiency	= (5201+5202+5203+5204) / Total Income * 100	Cost management	Always
Interest Income Ratio	= 4101 / Total Income * 100	Revenue composition	Always
Cost-to-Income Ratio	= (5101+5102+5201+5202+5203+5204+5301) / Total Income * 100	Overall efficiency	Always
C. YEAR-OVER-YEAR CALCULATIONS (If Historical Data Exists)
Metric	Formula	Purpose	When to Run
Asset Growth	= (Current Assets / Previous Assets - 1) * 100	Growth trend	If historical data exists
Loan Growth	= (Current Loans / Previous Loans - 1) * 100	Lending growth	If historical data exists
Deposit Growth	= (Current Deposits / Previous Deposits - 1) * 100	Funding growth	If historical data exists
Equity Growth	= (Current Equity / Previous Equity - 1) * 100	Capital growth	If historical data exists
Surplus Growth	= (Current Surplus / Previous Surplus - 1) * 100	Profitability trend	If historical data exists
NPL Trend	= Current NPL Ratio - Previous NPL Ratio	Deterioration/improvement	If historical data exists
PAR Trend	= Current PAR 30 - Previous PAR 30	Delinquency trend	If historical data exists
Efficiency Trend	= Current Efficiency - Previous Efficiency	Cost management	If historical data exists
D. INTERNAL CONSISTENCY VALIDATION (Check Sums)
Check	Verification	Action if Mismatch
Liquid Assets Sum Check	1100 == 1101 + 1102 + 1103 + 1104	Flag as calculation_mismatch
Gross Loans Sum Check	1200 == 1201 + 1202 + 1203 + 1204 + 1205	Flag as calculation_mismatch
Loan Provisions Sum Check	1250 == 1251 + 1252	Flag as calculation_mismatch
Other Assets Sum Check	1300 == 1301 + 1302 + 1303 - 1304 + 1305	Flag as calculation_mismatch
Deposits Sum Check	2100 == 2101 + 2102 + 2103	Flag as calculation_mismatch
Borrowings Sum Check	2200 == 2201 + 2202	Flag as calculation_mismatch
Other Liabilities Sum Check	2300 == 2301 + 2302 + 2303	Flag as calculation_mismatch
Share Capital Sum Check	3100 == 3101 + 3102	Flag as calculation_mismatch
Reserves Sum Check	3200 == 3201 + 3202 + 3203	Flag as calculation_mismatch
Retained Earnings Sum Check	3300 == 3301 + 3302	Flag as calculation_mismatch
PART 2: ABNORMALITY FLAG SYSTEM
FLAG CATEGORIES & SEVERITY LEVELS
Severity	Color Code	Action Required
Critical	🔴 Red	System blocks report. Human MUST review before proceeding.
High	🟠 Orange	Human MUST review and approve before proceeding.
Medium	🟡 Yellow	Human should review. Can proceed but flagged.
Low	🔵 Blue	Informational only. No action required.
A. CRITICAL ABNORMALITIES (🔴 RED - System Blocks)
ID	Abnormality	Detection Formula	Severity	User Message
CRIT-001	Accounting Equation Imbalance	1999 != 2999 + 3999 (Difference > 0.01% of Total Assets)	Critical	"CRITICAL ERROR: The accounting equation does not balance. Assets (X) ≠ Liabilities (Y) + Equity (Z). Please verify all entries."
CRIT-002	Assets Don't Sum to Total	1999 != 1100 + 1200 + 1250 + 1300	Critical	"CRITICAL ERROR: Total Assets (1999) does not match the sum of asset sub-categories. Please verify."
CRIT-003	Liabilities Don't Sum to Total	2999 != 2100 + 2200 + 2300	Critical	"CRITICAL ERROR: Total Liabilities (2999) does not match the sum of liability sub-categories. Please verify."
CRIT-004	Equity Don't Sum to Total	3999 != 3100 + 3200 + 3300	Critical	"CRITICAL ERROR: Total Equity (3999) does not match the sum of equity sub-categories. Please verify."
CRIT-005	Negative Total Assets	1999 < 0	Critical	"CRITICAL ERROR: Total Assets is negative. This is impossible. Please verify all negative values."
CRIT-006	Negative Total Equity	3999 < 0	Critical	"CRITICAL ERROR: Total Equity is negative. The cooperative is technically insolvent. Please verify."
CRIT-007	Zero Total Assets	1999 = 0	Critical	"CRITICAL ERROR: Total Assets is zero. This appears to be an empty or invalid financial statement."
CRIT-008	Total Assets Missing	1999 field is empty or null	Critical	"CRITICAL ERROR: Total Assets is missing. This is a required field for balance sheet validation."
CRIT-009	Total Liabilities Missing	2999 field is empty or null	Critical	"CRITICAL ERROR: Total Liabilities is missing. This is a required field for balance sheet validation."
CRIT-010	Total Equity Missing	3999 field is empty or null	Critical	"CRITICAL ERROR: Total Equity is missing. This is a required field for balance sheet validation."
B. HIGH SEVERITY ABNORMALITIES (🟠 ORANGE - Human MUST Review)
B1. Credit Risk Abnormalities
ID	Abnormality	Detection Formula	Severity	User Message
HIGH-001	NPL Ratio Exceeds Threshold	1205 / (1201+1202+1203+1204+1205) * 100 > 10%	High	"⚠️ CREDIT RISK: Non-Performing Loans (NPLs) are {X}% of the total loan portfolio. This exceeds the 10% alert threshold. Immediate attention required."
HIGH-002	PAR 90 Days Exceeds Threshold	(1204+1205) / (1201+1202+1203+1204+1205) * 100 > 5%	High	"⚠️ DELINQUENCY: Portfolio at Risk (90+ days) is {X}%. This exceeds the 5% alert threshold. Urgent collection action needed."
HIGH-003	PAR 30 Days Exceeds Threshold	(1202+1203+1204+1205) / (1201+1202+1203+1204+1205) * 100 > 10%	High	"⚠️ EARLY WARNING: Portfolio at Risk (30+ days) is {X}%. This exceeds the 10% alert threshold. Collection efforts must be intensified."
HIGH-004	Under Provisioning	1252 / 1205 * 100 < 50%	High	"⚠️ UNDER-PROVISIONING: Specific provision covers only {X}% of NPLs. Regulatory minimum is 50%. The cooperative is under-provisioned."
HIGH-005	Zero Provision with NPLs	1252 = 0 and 1205 > 0	High	"⚠️ MISSING PROVISION: You have NPLs ({X}) but no specific loan loss provision. This is a regulatory violation."
HIGH-006	Negative Loan Portfolio	1201+1202+1203+1204+1205 < 0	High	"⚠️ INVALID DATA: Total loan portfolio is negative. This is impossible. Please verify all loan values."
HIGH-007	Loans Exceed Member Deposits	(1201+1202+1203+1204+1205) / (2101+2102+2103) * 100 > 100%	High	"⚠️ HIGH LEVERAGE: Loans exceed member deposits. The cooperative is funding loans with external debt or equity. This increases risk."
B2. Liquidity Abnormalities
ID	Abnormality	Detection Formula	Severity	User Message
HIGH-008	Liquidity Too Low	(1101+1102+1103+1104) / (2100+2201+2301+2302) * 100 < 50%	High	"⚠️ LIQUIDITY CRISIS: Liquid assets cover only {X}% of short-term liabilities. This indicates a potential liquidity crisis. Immediate action required."
HIGH-009	Cash Too Low	(1101+1102+1103) / Total Assets * 100 < 2%	High	"⚠️ CASH CONCENTRATION: Cash is only {X}% of total assets. This is dangerously low. Consider increasing cash reserves."
HIGH-010	Cash Too High	(1101+1102+1103) / Total Assets * 100 > 30%	High	"⚠️ EXCESS CASH: Cash is {X}% of total assets. This is unusually high. Consider investing idle cash to generate returns."
HIGH-011	Liquid Assets Too Low	(1101+1102+1103+1104) / Total Assets * 100 < 10%	High	"⚠️ LOW LIQUIDITY: Liquid assets are only {X}% of total assets. This is below the 10% minimum standard."
B3. Capital Adequacy Abnormalities
ID	Abnormality	Detection Formula	Severity	User Message
HIGH-012	Capital Adequacy Below Minimum	3999 / (1201+1202+1203+1204+1205) * 100 < 8%	High	"⚠️ CAPITAL ADEQUACY: Capital Adequacy Ratio (CAR) is {X}%. The regulatory minimum is 8%. The cooperative is under-capitalized."
HIGH-013	Equity to Assets Too Low	3999 / Total Assets * 100 < 10%	High	"⚠️ LOW EQUITY: Equity is only {X}% of total assets. This is below the 10% minimum standard. Consider strengthening equity."
HIGH-014	High Leverage	2999 / 3999 > 3	High	"⚠️ HIGH LEVERAGE: Debt-to-Equity ratio is {X}. This exceeds the 3:1 threshold. The cooperative is highly leveraged."
HIGH-015	Statutory Reserve Missing	3201 = 0	High	"⚠️ STATUTORY RESERVE: Statutory reserve is zero. This may be a regulatory violation."
B4. Profitability Abnormalities
ID	Abnormality	Detection Formula	Severity	User Message
HIGH-016	Operating Loss	3302 < 0	High	"⚠️ OPERATING LOSS: The cooperative incurred a net loss of {X} in the current period. This is a warning sign. Investigate causes."
HIGH-017	ROA Negative	3302 / Total Assets * 100 < 0	High	"⚠️ NEGATIVE ROA: Return on Assets (ROA) is {X}%. The cooperative is losing money relative to its assets."
HIGH-018	ROE Negative	3302 / Total Equity * 100 < 0	High	"⚠️ NEGATIVE ROE: Return on Equity (ROE) is {X}%. The cooperative is destroying member value."
HIGH-019	Low Profitability	3302 / Total Assets * 100 < 1%	High	"⚠️ LOW PROFITABILITY: ROA is only {X}%. This is below the 1% minimum standard. Performance needs improvement."
HIGH-020	Inefficient Operations	(5201+5202+5203+5204) / Total Income * 100 > 4) / Total Income * 100 > 80%	80%` | High | "⚠️ INEFFICIENT: Operating expenses High | "⚠️ INEFFICIENT: Operating expenses consume {X}% of income. This is above the 80% consume {X}% of income. This is above the 80% threshold. Cost reduction needed." |	
B5. Missing threshold. Cost reduction needed." |
B5. Missing Critical Data
| ** Critical Data

| ID | ID | Abnormality | Detection Formula | SeverAbnormality | Detection Formula | Severity | User Message |
ity** | User Message |
|:---||:---|:---|::---|:---|:---|:---|
| HIGH----|:---|:---|
| HIGH-021 | Cash on Hand Missing | 1101 is null or empty | High021 | Cash on Hand Missing | 1101 is null or empty | High | "⚠️ | "⚠️ MISSING DATA: Cash on Hand is MISSING DATA: Cash on Hand is missing. This is a critical missing. This is a critical field for cash management field for cash management." |
| HIGH-022." |
| HIGH-022 | Cash at Bank Missing | 110 | **Cash at Bank Missing** |1102is null or empty | High2 is null or empty | High | "⚠️ MISSING DATA: | "⚠️ MISSING DATA: Cash at Bank - Current Accounts is missing Cash at Bank - Current Accounts is missing. This is a. This is a critical field." |
| HIGH critical field." |
| HIGH-023 | Loan Portfolio-023 | Loan Portfolio Missing | 1201 Missing | 1201 is null or empty | High | "⚠️ MISS is null or empty | High | "⚠️ MISSING DATA: Performing Loan Portfolio is missingING DATA: Performing Loan Portfolio is missing. This is essential for credit risk analysis. This is essential for credit risk analysis." |
| HIGH-024 | Member Deposits Missing |." |
| HIGH-024 | Member Deposits Missing | 2101 2101 is null or empty is null or empty | High | " | High | "⚠️ MISSING DATA: Voluntary⚠️ MISSING DATA: Voluntary Savings is missing. This is essential Savings is missing. This is essential for funding analysis." |
| **HIGH-025 for funding analysis." |
| HIGH-025 | Share Capital Missing | 3101** | **Share Capital Missing** |3101`` is null or empty | High | "⚠️ MISSING DATA: Permanent Share Capital is missing is null or empty | High | "⚠️ MISSING DATA: Permanent Share Capital is missing. This is essential for capital analysis." |

. This is essential for capital analysis." |

C. MEDIUM SEVERITY## C. MEDIUM SEVERITY ABNORMALITIES ABNORMALITIES (🟡 YELLOW - Human Should (🟡 YELLOW - Human Should Review)
C Review)
C1. Portfolio Quality Concerns1. Portfolio Quality Concerns
| **

| ID | Abnormality | Detection FormulaID | Abnormality | Detection Formula | Severity | **** | Severity | User Message |
|:---|User Message** |
|:---|:---|::---|:---|:---|:---|
---|:---|:---|
| MED-001 || MED-001 | NPL Ratio Elevated | 1205 / (120 **NPL Ratio Elevated** |1201+1202+1203+1204+1205 / (1201+1202+1203+1204+1205) * 100 > 55) * 100 > 5% and <= 10%% and <= 10% | Medium | "ℹ️ MODERATE RIS | Medium | "ℹ️ MODERATE RISK: NPLs are {X}% of the loan portfolio. ThisK: NPLs are {X}% of the loan portfolio. This is above the 5% target but below the 10% alert threshold is above the 5% target but below the 10% alert threshold. Monitor closely." |
| **. Monitor closely." |
| MED-002 | PAR 30 Elevated | (1202+1203+120MED-002** | **PAR 30 Elevated** |(1202+1203+12044+1205) / (1201+1202+1203+1204+1205+1205) / (1201+1202+1203+1204+1205) * 100 > 5% and <= 10%| Medium) * 100 > 5% and <= 10 | "ℹ️ MODERATE DELIN% | Medium | "ℹ️ MODERATE DELINQUENCY: PAR 30 isQUENCY: PAR 30 is {X}%. This is elevated but not {X}%. This is elevated but not yet critical. Strengthen yet critical. Strengthen collection efforts." |
| **MED- collection efforts." |
| MED-003 | Per003 | Performing Loans Below Targetforming Loans Below Target | 1201 / (1201+1202** |1201 / (1201+1202+1203++1203+1204+1201204+1205) * 100 < 85%| Medium5) * 100 < 85% | Medium | "ℹ | "ℹ️ PORTFOLIO QUALITY: Only {X}️ PORTFOLIO QUALITY: Only {X}% of loans% of loans are performing. Target is are performing. Target is 85%+. Review85%+. Review lending policies." |
| ** lending policies." |
| MED-004 | Low ProvisionMED-004 | Low Provision Coverage | (1251+ Coverage** |(1251+1252) / (1201+1202+1203+1201252) / (1201+1202+1203+1204+1205) * 1004+1205) * 100 < 5%| Medium | "ℹ < 5% | Medium | "ℹ️ LOW PROVISION️ LOW PROVISIONING: Total provisions are only {X}ING: Total provisions are only {X}% of gross loans. Consider increasing provisions." |

C% of gross loans. Consider increasing provisions." |
C2. Liquidity Concerns
| **2. Liquidity Concerns

| ID | AbnormalityID** | Abnormality | Detection Formula | Sever | Detection Formula | Severity | User Messageity | User Message |
|:---|:---|:---|:--- |
|:---|:---|:---|:---|:---|
| **MED-|:---|
| MED-005 | Liquidity Borderline | 005** | **Liquidity Borderline** |(1101+1102+(1101+1102+1103+1104) / (1103+1104) / (2100+2201+23012100+2201+2301+2302) * 100+2302) * 100 < 100% and >= 50%< 100% and >= 50% | Medium | "ℹ️ | Medium | "ℹ️ BORDERLINE LIQUIDITY: Liquid assets cover BORDERLINE LIQUIDITY: Liquid assets cover {X {X}% of short-term liabilities. This is below the}% of short-term liabilities. This is below the 100% standard 100% standard but above the but above the 50% alert threshold." |
| **MED-00650% alert threshold." |
| MED-006 | Cash Below | Cash Below Target | (1101+1102+1103 Target** |(1101+110) / Total Assets2+1103) / Total Assets * 100 < 5% and * 100 < 5% and >= 2% >= 2%| Medium | | Medium | "ℹ️ LOW CASH: Cash is "ℹ️ LOW CASH: Cash is {X}% of assets {X}% of assets. This is below. This is below the 5% the 5% target but above the 2% alert threshold." |
target but above the 2% alert threshold." |
| **MED-| MED-007 | Deposit007 | Deposit Dependence Decreasing Dependence Decreasing | (2101** |(2101+2102+2103) / (Total+2102+2103) / Assets) * 100 (Total Assets) * 100 < 50%| Medium | "ℹ️ DEP < 50% | Medium | "ℹ️ DEPOSIT CONOSIT CONCENTRATION: Member deposits are only {X}% of assets. ConsiderCENTRATION: Member deposits are only {X}% of assets. Consider growing deposit growing deposit base." |

C base." |
C3. Capital & Leverage Concerns
|3. Capital & Leverage Concerns

| ID | Abnormality ID | Abnormality | Detection Formula | Severity | User Message | Detection Formula | Severity | User Message |
|:---|:---| |
|:---:---|:---|:---|
| **MED|:---|:---|:---|:---|
| MED-008 | Capital Adequacy Borderline-008 | Capital Adequacy Borderline | 3999 / (1201+1202** |3999 / (120+1203+1204+1205) * 1+1202+1203+1204+1205) * 100100 < 10% and >= 8%< 10% and >= 8% | Medium | "ℹ️ B | Medium | "ℹ️ BORDERLINE CAR: Capital Adequacy Ratio is {XORDERLINE CAR: Capital Adequacy Ratio is {X}%. This is}%. This is above the 8% minimum but below the above the 8% minimum but below the 10% target.10% target. Monitor." |
| **MED Monitor." |
| MED-009 | Equity to Assets Border-009 | Equity to Assets Borderline | line** |3999 / Total Assets * 1003999 / Total Assets * 100 < 15 < 15% and >= 10%| Medium | "% and >= 10% | Medium | "ℹ️ BORDERLINE EQUITY: Equity is {Xℹ️ BORDERLINE EQUITY: Equity is {X}% of assets. This is above the 10% minimum but below the}% of assets 15% target." |
| MED-010. This is above the 10% minimum but below the 15% target." |
| MED-010 | Debt to Equity Elevated | 2999 / | **Debt to Equity Elevated** |2999 / 3999 > 2 and <= 3| Medium | "ℹ️ E3999 > 2 and <= 3 | Medium | "ℹ️ ELEVATED LEVERAGE: Debt-to-Equity is {X}.LEVATED LEVERAGE: Debt-to-Equity This is above the 2:1 target but below the 3:1 alert threshold." |

is {X}. This is above the 2:1 target but below the 3:1 alert threshold." |

C4. Profitability### C4. Profitability Concerns
| ID | Abnormality Concerns

| ID | Abnormality | Detection Formula | Severity | User Message |
|:---| | Detection Formula | Severity | User Message |
|:---|:---|::---|:---|:---|:---|
| **MED----|:---|:---|
| MED-011 | ROA Below Target | 330011** | **ROA Below Target** |3302 / Total2 / Total Assets * 100 >= 0.5% and < 1%Assets * 100 >= 0.5% and < 1% | Medium | "ℹ️ MODERATE ROA: ROA is {X} | Medium | "ℹ️ MODERATE ROA: ROA is {X}%. This is below the 1% target but not%. This is below the 1% target but not negative. negative. Explore efficiency improvements." |
| **MED-012 Explore efficiency improvements." |
| MED-012 | RO | ROE Below Target | 3302 / Total Equity *E Below Target** |3302 / Total Equity * 100 >= 3% and 100 >= < 5%| Medium | "3% and < 5% | Medium | "ℹ️ MODERATE ROE: ROE isℹ️ MODERATE ROE: ROE is {X}%. {X}%. This is below the 5% target. This is below the 5% target. Evaluate if Evaluate if returns are sufficient for members." |
| **MED- returns are sufficient for members." |
| MED-013 | Operating Inefficiency | (5201+520013** | **Operating Inefficiency** |(5201+5202+52032+5203+5204) / Total Income *+5204) / Total Income * 100 > 70% and <= 80%100 > 70% and <= 80% | Medium | " | Medium | "ℹ️ MODℹ️ MODERATE INEFFICIENCYERATE INEFFICIENCY: Operating expenses are {X}% of income. This: Operating expenses are {X}% of income. This is above the 70% target. Review cost is above the 70% target. Review cost management." |

C5. Data Quality management." |
C5. Data Quality & & Consistency
| ** Consistency

| ID | Abnormality | Detection FormulaID | Abnormality | Detection Formula | Sever | Severity | ity | User Message |
|:---|User Message** |
|:---|:---|::---|:---|:---|:---|
| MED-014 |---|:---|:---|
| MED-014 | Rounding Inconsistency | Any value Rounding Inconsistency | Any value has more than 2 decimal places | Medium has more than 2 decimal places | Medium | "ℹ️ ROUNDING: Some values have more | "ℹ️ ROUNDING: Some values have more than 2 decimal places. This may than 2 decimal places. This may indicate a indicate a currency or formatting currency or formatting issue." |
| **MED-015 issue." |
| MED-015 | Zero | Zero Values in Key Values in Key Fields | Fields** |1101 = 0(1101 = 0 (Cash on Hand)Cash on Hand) | Medium | "ℹ | Medium | "ℹ️ ZERO VALUE️ ZERO VALUE: Cash on Hand: Cash on Hand is zero. This is zero. This is unusual. Please verify if this is correct is unusual. Please verify if this is correct." |
| MED-016 | High Growth." |
| MED-016 | High Growth Rate Rate | Year-over-year growth > 50 | Year-over-year growth > 50% | Medium | "ℹ️ R% | Medium | "ℹ️ RAPID GROWAPID GROWTH: {Field} grew byTH: {Field} grew by {X}% compared {X}% compared to previous period. Verify this is to previous period. Verify this is accurate." |
| MED-017 accurate." |
| MED-017 | Negative Growth | Negative Growth | Year-over-year | Year-over-year growth < -20% | Medium | "ℹ️ growth < -20% | Medium | "ℹ️ DECLINE: {Field DECLINE: {Field} declined by {X}%} declined by {X}% compared to previous period. Investigate the compared to previous period. Investigate the reason reason." |
| MED-018 | Implausible Ratio." |
| MED-018 | Implausible Ratio | Any | Any ratio > ratio > 1000% | 1000% | Medium | "ℹ️ UNUSUAL VALUE Medium | "ℹ️ UNUSUAL VALUE: {: {Ratio} is {X}Ratio} is {X}%. This seems implausible. Please%. This seems implausible. Please verify the verify the data." |

D. LOW SEVERITY ABNORMALITIES data." |
D. LOW SEVERITY ABNORMALITIES (🔵 BLUE - Informational)
| ID | (🔵 BLUE - Informational)

| ID | Abnormality Abnormality | Detection Formula | **** | Detection Formula | Severity |Severity | User Message |
|:---|:---| User Message |
|:---|:---|:---|::---|:---|:------|:---|
| LOW-001 | Missing Optional Fields | Optional|
| LOW-001 | Missing Optional Fields | Optional fields (e.g., 1305 fields (e.g., 1305 Intangible Assets) are null | Low | "ℹ Intangible Assets) are null | Low | "ℹ️ INFORMATION️ INFORMATION: {Field: {Field} was not provided. Default} was not provided. Defaulted to 0." |
| ed to 0." |
| LOW-002LOW-002 | Rounding Tolerance | Rounding Tolerance | Values rounded | Values rounded to nearest thousand to nearest thousand or million | Low | or million | Low | "ℹ️ "ℹ️ ROUNDING: Values appear ROUNDING: Values appear rounded to nearest {X}. Verify rounded to nearest {X}. Verify currency precision currency precision." |
| LOW-003 | Syn." |
| LOW-003 | Synonym Mappingonym Mapping Used | AI mapped an Used | AI mapped an item using a synonym item using a synonym | Low | "ℹ️ M | Low | "ℹ️ MAPPED: '{User FieldAPPED: '{User Field}' was mapped}' was mapped to '{COA Field}' using synonym recognition to '{COA Field}' using synonym recognition." |
| LOW-004 | Historical." |
| LOW-004 | Historical Comparison Available | Year-over-year data Comparison Available | Year-over-year data available | Low | " available | Low | "ℹ️ HISTℹ️ HISTORICAL DATA: YearORICAL DATA: Year-over-year comparison is available for {-over-year comparison is available for {Field}." |
| LOW-005Field}." |
| LOW-005 | No Flags | No Flags Found | All data Found | All is clean | Low | "✅ ALL data is clean | Low | "✅ ALL CLEAR: No abnormalities CLEAR: No abnormalities detected. Your financial statement appears complete detected. Your financial statement appears complete and and consistent." |
| LOW- consistent." |
| LOW-006 | Consistent Growth006 | Consistent Growth | All | All key metrics show key metrics show healthy growth healthy growth | Low | "✅ HEALTHY GROWTH: Assets, loans | Low | "✅ HEALTHY GROWTH: Assets, deposits, and, loans, deposits, and equity all show equity all show positive growth." |

E positive growth." |
E. SPECIAL SC. SPECIAL SCENARIO AENARIO ABNORMALITIESBNORMALITIES (Context-Specific (Context-Specific)
| ID | **)

| ID | Abnormality | Detection Formula |Abnormality** | Detection Formula | Severity | User Severity | User Message |
|:---| Message |
|:---|:---|:---|:---:---|:---|:---|:---|
|:---|
| SPEC-001 || SPEC-001 | **New Cooperative ( New Cooperative (NoNo Historical Data) | Year of establishment Historical Data)** |Year of establishment = Current Year| Low | "ℹ️ NEW = Current Year | Low | "ℹ️ NEW COOPERATIVE: Limited historical data COOPERATIVE: Limited historical data available. Benchmarking may available. Benchmarking may not be possible not be possible." |
| SPEC-002." |
| SPEC-002 | **Deficit After | Deficit After Prof Profitable Years | itable Years** |3301 > 0 and 3302 < 0| High3301 > 0 and 3302 < 0 | High | "⚠ | "⚠️ PROFIT REVERSAL: Cooperative has️ PROFIT REVERSAL: Cooperative has accumulated surplus but current year is loss-making. Investigate cause accumulated surplus but current year is loss-making. Investigate cause." |
| SPEC-003 | **Surplus After Loss Years." |
| SPEC-003 | Surplus After Loss Years | 330** |3301 < 0 and 3302 > 01 < 0 and 3302 > 0 | Medium | Medium | "ℹ️ REC | "ℹ️ RECOVERY: Current year surplus after previousOVERY: Current year surplus after previous accumulated accumulated losses. Turnaround achieved." |
| SPEC-004 losses. Turnaround achieved." |
| SPEC-004 | **Asset-L | Asset-Liability Miability Mismatch | (ismatch** |(1101101+1102+11031+1102+1103+1104)+1104) < (2101+2102+2103)< (2101+2102+2103) and and12051205 > 0 > 0| High | "⚠️ ASS | High | "⚠️ ASSET-LIET-LIABILITY MISMATCH: Liquid assets are insufficientABILITY MISMATCH: Liquid assets are insufficient to cover to cover member deposits. Potential member deposits. Potential liquidity crisis." |
liquidity crisis." |
| SPEC-005 | **| SPEC-005 | High Proportion of ShortHigh Proportion of Short-Term Borrowings | -Term Borrowings** |2201 / (2201+2202)2201 / (2201+2202) * 100 > 50%| Medium | " * 100 > 50% | Medium | "ℹ️ SHORT-TERM DEBT CONℹ️ SHORT-TERM DEBT CONCENTRATION: {X}% of borrowings are short-term. ThisCENTRATION: {X}% of borrowings are short-term. This increases refin increases refinancing risk." |
| SPEC-ancing risk." |
| SPEC-006 | Low Interest Income |006 | Low Interest Income | 4101 / Total Income *4101 / Total Income * 100 < 60%| Medium | "ℹ100 < 60% | Medium | "ℹ️ NON-️ NON-INTEREST ININTEREST INCOME: Interest income is only {X}COME: Interest income is only {X}% of total income. Review revenue composition."% of total income. Review revenue composition." |
| SPEC |
| SPEC-007 |-007 | High Administrative Costs | 5202 / ( **High Administrative Costs** |5202 / (5201+5202+5203+5204) * 100 > 40%5201+5202+5203+5204) * 100 > 40%| Medium | " | Medium | "ℹ️ HIGH ADMIN COℹ️ HIGH ADMIN COSTS: Administrative expensesSTS: Administrative expenses are {X}% of operating expenses are {X}% of operating expenses. Consider cost optimization." |
| . Consider cost optimization." |
| SPEC-008 | AccSPEC-008 | Accumulated Deficit |umulated Deficit | 3301 < 0 | Medium | " 3301 < 0 | Medium | "ℹ️ ACCUMℹ️ ACCUMULATED DEFICIT: The cooperativeULATED DEFICIT: The cooperative has accumulated losses of {X}. This has accumulated losses of {X}. This is a concern for long is a concern for long-term sustainability." |
| SPEC-009 | **-term sustainability." |
| SPEC-009 | Concentration Risk | (120Concentration Risk** |(1+1202+1203+1204+1201201+1202+1203+1204+1205) / Total Assets * 100 > 5) / Total Assets * 100 > 70%| Medium | "ℹ️70% | Medium | "ℹ️ LOAN CONCENTRATION: Loans LOAN CONCENTRATION: Loans represent {X}% of total assets. Asset concentration represent {X}% of total assets. Asset concentration risk is high." |
| risk is high." |
| SPEC-010 | Zero Growth | All SPEC-010 | Zero Growth | All year-over-year growth rates year-over-year growth rates = 0% = 0% | Low | "ℹ️ STABLE: | Low | "ℹ️ STABLE: No significant No significant changes from previous period. This may be intentional changes from previous period. This may be intentional or may or may indicate data indicate data issues." |

