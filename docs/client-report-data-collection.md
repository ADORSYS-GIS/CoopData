# Data Collection Report: Manual Questionnaires vs Digital Submission

**Prepared for:** Ministry / Project Stakeholders  
**Date:** July 2026  
**Purpose:** Understand how data flows through the system and identify which questionnaire questions can be answered automatically vs which need to be filled in manually.

---

## 1. How Data Enters the System

There are **two ways** a cooperative can submit their data:

### Option A: Digital Submission (Excel File Upload)

The cooperative uploads a pre-formatted Excel workbook containing detailed records of:
- **Each individual member** (name, age, gender, status, etc.)
- **Each savings account** (balance, interest rate, activity, etc.)
- **Each loan** (amount, repayment status, borrower details, etc.)
- **Each fixed deposit** (term, status, balance, etc.)
- **Farm cooperative data** (production, inputs, irrigation, etc.)
- **Financial statements** — converted from the cooperative's own accounting system

The system then processes these records and **automatically calculates** all performance indicators.

### Option B: Manual Questionnaire (Form Fill)

When a cooperative cannot provide an Excel file, they fill out a structured **PDF form** covering:
- **Financial Questionnaire** — about 140 individual data points (income, expenses, assets, loans, savings, etc.)
- **Non-Financial Questionnaire** — about 130 individual data points (membership, governance, training, activities, etc.)

---

## 2. The Big Question

**If a cooperative uploads their Excel file (Option A), which parts of the manual questionnaire (Option B) become unnecessary?**

We analysed every single question on both forms against what the system can calculate from the Excel upload. Here is what we found.

---

## 3. Overall Results

| Form | Total Questions | Already Answered by Upload | Only Available from Manual Form |
|---|---|---|---|
| **Financial Questionnaire** | ~141 | ~34 (24%) | ~107 (76%) |
| **Non-Financial Questionnaire** | ~133 | ~33 (25%) | ~100 (75%) |
| **Combined** | **~274** | **~67 (24%)** | **~207 (76%)** |

**Key takeaway:** About **three-quarters** of the manual form contains information that the Excel upload **cannot provide**. These questions remain essential. The remaining **one-quarter** overlaps with what the system can calculate — meaning a cooperative that already uploaded their Excel data would not need to re-enter those figures manually.

---

## 4. Questions That Are Already Covered by the Excel Upload

If a cooperative submits their data via Excel, the following information is **automatically available** and does not need to be typed into the form again.

### 4.1 Financial Information (24 items)

The system can calculate these from the cooperative's financial statements:

| What the Form Asks | How the System Gets It |
|---|---|
| Share capital (members' contributions) | From the financial statement account code 3101 |
| Borrowed funds / loans taken | From account code 2201 |
| Donations and grants received | From account code 4201 |
| Statutory reserves (book value) | From account code 3201 |
| Retained earnings | From account code 3301 |
| Money invested in the bank | From account code 1102 |
| Money invested in shares and other investments | From account code 1104 |
| Total outstanding loan value (by gender) | From account code 1201 |
| Loans overdue by 0–30 days | From account code 1202 |
| Loans overdue by 31–365 days | From account code 1205 |
| Loan loss provisions (general) | From account code 1251 |
| Loan loss provisions (specific) | From account code 1252 |
| Loans written off | From account code 5301 |
| Loan fees (stationery, application, protection, penalties, other) | From account code 4102 |
| Activity expenses | From account code 5101 |
| Total income for the period | From accounts 4101, 4102, 4201 combined |
| Net profit or loss | From account code 6999 |
| Fixed assets (buildings, equipment) | From account code 1303 |
| Current assets (cash, receivables) | From account code 1100 |
| Short-term debts / current liabilities | From account code 2100 |
| Long-term debts / long-term liabilities | From account code 2200 |
| Total equity | From account code 3999 |

### 4.2 Membership Information (9 items)

From the individual member records in the Excel upload:

| What the Form Asks | How the System Gets It |
|---|---|
| Total number of registered members | Count of all member records |
| Number of active members | Count of members with status "Active" |
| Members by gender (male / female) | Count by gender field |
| Members aged 17 and under | Count by age group |
| Members aged 36 to 60 | Count by age group |
| Members aged 61 and above | Count by age group |
| Number of dormant (inactive) members | Count of members with status "Dormant" |
| AGM attendance | Count of members who attended the AGM |

### 4.3 Loan & Savings Balances (2 items)

| What the Form Asks | How the System Gets It |
|---|---|
| Total amount owed by members (outstanding loans) | Sum of all loan balances |
| Total savings deposits | Sum of all savings account balances |

---

## 5. Questions That Are UNIQUE to the Manual Form

These questions cover information that **cannot** be obtained from an Excel upload. They must still be answered through the form.

### 5.1 Governance & Leadership (about 40 questions)

- Number of board members (by gender)
- Number of executive committee members (by gender)
- Number of credit committee members (by gender)
- Number of education committee members (by gender)
- Number of supervisory committee members (by gender)
- Education level of the chairperson, vice-chair, treasurer, and secretary
- Number of staff by role and gender (manager, assistant manager, accountant, other management, support staff)
- Manager's academic level and cooperative training level

### 5.2 Training & Capacity Building (about 14 questions)

- Number of members, leaders, and staff trained in the last year
- Who sponsored the training
- Quality rating of the training
- What training is needed (for members, leaders, and staff)
- Willingness to cover training costs (percentage)

### 5.3 Governance Dates & Compliance (about 10 questions)

- Date of last audit
- Date of last inspection
- Date of last management report
- Date of last budget
- Date of last committee profile
- Name of the last audit firm
- Whether the AGM is up to date and reasons for any delays

### 5.4 Products & Services (about 2 questions)

- What financial products does the cooperative offer?
- What non-financial products does the cooperative offer?

### 5.5 Share Structure & Fees (about 4 questions)

- Nominal value of one share
- Share capital contribution required per member
- Member joining fee
- Annual subscription fee

### 5.6 Loan Details by Gender (about 16 questions)

Unlike the Excel upload which gives totals, the manual form breaks down loans by gender:

- Number of loans issued to men, women, and cooperatives
- Value of loans issued to men, women, and cooperatives
- Number of outstanding loan accounts by gender
- Number of overdue accounts by gender
- Value of overdue amounts by gender

### 5.7 Loan Terms & Recoveries (about 4 questions)

- Average loan term (in months)
- Average interest rate on loans
- Value of loans recovered in the last 12 months
- Method used to calculate interest

### 5.8 Year-Over-Year Comparison (about 6 questions)

The form asks for last year's figures alongside current year's:

- Last year's total income
- Last year's total expenses
- Last year's net income
- Last year's surplus distribution

### 5.9 Activity-Level Financials (about 8 questions)

For cooperatives that run commercial activities (e.g., farming, retail):

- Name of each activity
- Unit of measure
- Annual production/output
- Income, expenses, and profit per activity
- Amount distributed to members
- Date of last distribution

### 5.10 Threats & Challenges (about 6 questions)

- Amount owed to outside creditors
- Amount owed to member creditors
- Amount owed to banks
- Outstanding payments due to members
- Number of competitors
- Number of disputes resolved and unresolved

### 5.11 Qualitative / Open-Ended Feedback (5 questions)

- What advantages does the cooperative have over competitors?
- What are the main reasons for the cooperative's success?
- What challenges or failures has the cooperative faced?
- Recommendations for improvement
- Any additional comments from the respondent

---

## 6. Performance Indicator Comparison

Beyond the individual questions, the system produces **performance indicators** (ratios and statistics). Here is how the two methods compare:

### Financial Performance Indicators

| Indicator | From Excel Upload | From Manual Form |
|---|---|---|
| Total assets | ✅ Accurate | ✅ Accurate |
| Total equity | ✅ Accurate | ✅ Accurate |
| Net profit | ✅ Accurate | ✅ Accurate |
| Return on assets (ROA) | ✅ Accurate | ✅ Accurate |
| Return on equity (ROE) | ✅ Accurate | ✅ Accurate |
| Capital adequacy ratio | ✅ Accurate | ✅ Accurate |
| Gross loan portfolio | ✅ Accurate | ⚠️ Slightly understated |
| Member deposits | ✅ Accurate | ⚠️ Understated |
| PAR30 (loan quality) | ✅ Accurate | ⚠️ Slightly off |
| Operating expense ratio | ✅ Accurate | ❌ Not available |
| Operational self-sufficiency | ✅ Accurate | ⚠️ Overstated |
| Liquid funds ratio | ✅ Accurate | ⚠️ Understated |

**Of 18 financial indicators:**
- **6** are identical between both methods
- **10** have minor differences because the manual form uses broader categories
- **1** (operating expense ratio) cannot be calculated from the manual form
- **1** has a known data issue that inflates the result slightly

### Non-Financial Performance Statistics

| Category | Number of Statistics | From Excel Upload | From Manual Form |
|---|---|---|---|
| Membership analysis (active, dormant, youth, women, etc.) | 18 | ✅ All available | ❌ None |
| Savings analysis (accounts, balances, trends) | 16 | ✅ All available | ❌ None |
| Loan analysis (performance, arrears, borrower profile) | 20 | ✅ All available | ❌ None |
| Fixed deposit analysis | 14 | ✅ All available | ❌ None |
| Farm cooperative analysis | 17 | ✅ All available | ❌ None |
| **Total** | **85** | **All available** | **Not available from manual form alone** |

**Important note:** The manual questionnaire contains the *raw numbers* needed to calculate these statistics (e.g., total members, total savings), but the system currently stores them in a way that does not feed into the automated statistics engine. This means that cooperatives submitting via the manual form will see **zero results** in the non-financial dashboard, even though they provided the data.

---

## 7. Summary & Recommendations

### What We Recommend

| Area | Recommendation |
|---|---|
| **Overlapping questions (24%)** | These should be **auto-filled** when a cooperative uploads their Excel data. The cooperative should not need to retype them. |
| **Unique questions (76%)** | These should remain as-is. They capture valuable information that the Excel upload cannot provide. |
| **Manual form non-financial data** | We recommend building a bridge that converts the manual form data into the same format as the Excel upload, so that non-financial statistics become available to all cooperatives regardless of submission method. |
| **Financial indicator accuracy** | The manual financial form could be improved by adding a few extra fields (personnel costs, admin expenses, depreciation) to bring indicator accuracy from 6/18 to 16/18. |

### In One Sentence

**If a cooperative submits an Excel file, about one-quarter of the manual form becomes unnecessary; the remaining three-quarters covers governance, training, staff, activities, and qualitative information that the Excel file simply does not contain.**
