-- Migration 04: Chart of Accounts + Coop-Type Mapping + Seed
-- Source: docs/architecture.md §6.6, frontend/src/lib/financial-data.ts ACCOUNT_CODES
-- Seeds all account codes 1000-6999 (assets, liabilities, equity, income, expenses, surplus)

-- ── chart_of_accounts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_code        INT PRIMARY KEY,
    account_name        VARCHAR(255) NOT NULL,
    account_category    account_category NOT NULL,
    account_subcategory VARCHAR(100),
    is_total            BOOLEAN NOT NULL DEFAULT FALSE,
    is_section_header   BOOLEAN NOT NULL DEFAULT FALSE,
    parent_code         INT REFERENCES chart_of_accounts(account_code),
    formula             TEXT,
    display_order       INT NOT NULL DEFAULT 0,
    baseline_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── chart_of_accounts_coop_types ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts_coop_types (
    account_code       INT NOT NULL REFERENCES chart_of_accounts(account_code) ON DELETE CASCADE,
    cooperative_type   cooperative_type NOT NULL,
    is_required        BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (account_code, cooperative_type)
);

-- ── account_aliases (optional for v1) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_aliases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code INT NOT NULL REFERENCES chart_of_accounts(account_code) ON DELETE CASCADE,
    alias_label  VARCHAR(255) NOT NULL,
    language     VARCHAR(10) NOT NULL DEFAULT 'en',
    UNIQUE (account_code, alias_label)
);

-- ── Seed: ASSETS (1000 series) ────────────────────────────────────────────────
INSERT INTO chart_of_accounts (account_code, account_name, account_category, account_subcategory, is_total, is_section_header, parent_code, formula, display_order, baseline_active)
VALUES
    (1999, 'TOTAL ASSETS', 'assets', 'TOTAL', TRUE, FALSE, NULL, '1100+1200-1250+1300', 100, TRUE),
    (1100, 'LIQUID ASSETS', 'assets', 'LIQUID', FALSE, TRUE, 1999, '1101+1102+1103+1104', 110, TRUE),
    (1101, 'CASH ON HAND', 'assets', 'LIQUID', FALSE, FALSE, 1100, NULL, 111, TRUE),
    (1102, 'CASH AT BANK (CURRENT)', 'assets', 'LIQUID', FALSE, FALSE, 1100, NULL, 112, TRUE),
    (1103, 'CASH AT BANK (SAVINGS)', 'assets', 'LIQUID', FALSE, FALSE, 1100, NULL, 113, TRUE),
    (1104, 'SHORT-TERM INVESTMENTS', 'assets', 'LIQUID', FALSE, FALSE, 1100, NULL, 114, TRUE),
    (1200, 'LOANS & ADVANCES', 'assets', 'LOANS', FALSE, TRUE, 1999, '1201+1202+1203+1204+1205', 120, TRUE),
    (1201, 'PERFORMING LOAN PORTFOLIO', 'assets', 'LOANS', FALSE, FALSE, 1200, NULL, 121, TRUE),
    (1202, 'LOANS IN ARREARS (1-30 DAYS)', 'assets', 'LOANS', FALSE, FALSE, 1200, NULL, 122, TRUE),
    (1203, 'LOANS IN ARREARS (31-60 DAYS)', 'assets', 'LOANS', FALSE, FALSE, 1200, NULL, 123, TRUE),
    (1204, 'LOANS IN ARREARS (61-90 DAYS)', 'assets', 'LOANS', FALSE, FALSE, 1200, NULL, 124, TRUE),
    (1205, 'NON-PERFORMING LOANS', 'assets', 'LOANS', FALSE, FALSE, 1200, NULL, 125, TRUE),
    (1250, 'ALLOWANCE FOR LOAN LOSSES', 'assets', 'PROVISIONS', FALSE, TRUE, 1999, '1251+1252', 130, TRUE),
    (1251, 'GENERAL LOAN LOSS PROVISION', 'assets', 'PROVISIONS', FALSE, FALSE, 1250, NULL, 131, TRUE),
    (1252, 'SPECIFIC LOAN LOSS PROVISION', 'assets', 'PROVISIONS', FALSE, FALSE, 1250, NULL, 132, TRUE),
    (1300, 'OTHER ASSETS', 'assets', 'OTHER', FALSE, TRUE, 1999, '1301+1302+1303-1304+1305', 140, TRUE),
    (1301, 'ACCOUNTS RECEIVABLE', 'assets', 'OTHER', FALSE, FALSE, 1300, NULL, 141, TRUE),
    (1302, 'PREPAID EXPENSES', 'assets', 'OTHER', FALSE, FALSE, 1300, NULL, 142, TRUE),
    (1303, 'FIXED ASSETS (COST)', 'assets', 'OTHER', FALSE, FALSE, 1300, NULL, 143, TRUE),
    (1304, 'ACCUMULATED DEPRECIATION', 'assets', 'OTHER', FALSE, FALSE, 1300, NULL, 144, TRUE),
    (1305, 'INTANGIBLE ASSETS', 'assets', 'OTHER', FALSE, FALSE, 1300, NULL, 145, TRUE)
ON CONFLICT (account_code) DO NOTHING;

-- ── Seed: LIABILITIES (2000 series) ───────────────────────────────────────────
INSERT INTO chart_of_accounts (account_code, account_name, account_category, account_subcategory, is_total, is_section_header, parent_code, formula, display_order, baseline_active)
VALUES
    (2999, 'TOTAL LIABILITIES', 'liabilities', 'TOTAL', TRUE, FALSE, NULL, '2100+2200+2300', 200, TRUE),
    (2100, 'MEMBER DEPOSITS & SAVINGS', 'liabilities', 'DEPOSITS', FALSE, TRUE, 2999, '2101+2102+2103', 210, TRUE),
    (2101, 'VOLUNTARY SAVINGS', 'liabilities', 'DEPOSITS', FALSE, FALSE, 2100, NULL, 211, TRUE),
    (2102, 'MANDATORY SAVINGS', 'liabilities', 'DEPOSITS', FALSE, FALSE, 2100, NULL, 212, TRUE),
    (2103, 'FIXED-TERM DEPOSITS', 'liabilities', 'DEPOSITS', FALSE, FALSE, 2100, NULL, 213, TRUE),
    (2200, 'BORROWINGS', 'liabilities', 'BORROWINGS', FALSE, TRUE, 2999, '2201+2202', 220, TRUE),
    (2201, 'SHORT-TERM BORROWINGS', 'liabilities', 'BORROWINGS', FALSE, FALSE, 2200, NULL, 221, TRUE),
    (2202, 'LONG-TERM BORROWINGS', 'liabilities', 'BORROWINGS', FALSE, FALSE, 2200, NULL, 222, TRUE),
    (2300, 'OTHER LIABILITIES', 'liabilities', 'OTHER', FALSE, TRUE, 2999, '2301+2302+2303', 230, TRUE),
    (2301, 'ACCOUNTS PAYABLE', 'liabilities', 'OTHER', FALSE, FALSE, 2300, NULL, 231, TRUE),
    (2302, 'ACCRUED EXPENSES', 'liabilities', 'OTHER', FALSE, FALSE, 2300, NULL, 232, TRUE),
    (2303, 'DEFERRED INCOME', 'liabilities', 'OTHER', FALSE, FALSE, 2300, NULL, 233, TRUE)
ON CONFLICT (account_code) DO NOTHING;

-- ── Seed: EQUITY (3000 series) ────────────────────────────────────────────────
INSERT INTO chart_of_accounts (account_code, account_name, account_category, account_subcategory, is_total, is_section_header, parent_code, formula, display_order, baseline_active)
VALUES
    (3999, 'TOTAL EQUITY', 'equity', 'TOTAL', TRUE, FALSE, NULL, '3100+3200+3300', 300, TRUE),
    (3100, 'MEMBER SHARES', 'equity', 'SHARES', FALSE, TRUE, 3999, '3101+3102', 310, TRUE),
    (3101, 'PERMANENT SHARE CAPITAL', 'equity', 'SHARES', FALSE, FALSE, 3100, NULL, 311, TRUE),
    (3102, 'WITHDRAWABLE SHARES', 'equity', 'SHARES', FALSE, FALSE, 3100, NULL, 312, TRUE),
    (3200, 'RESERVES', 'equity', 'RESERVES', FALSE, TRUE, 3999, '3201+3202+3203', 320, TRUE),
    (3201, 'STATUTORY RESERVE', 'equity', 'RESERVES', FALSE, FALSE, 3200, NULL, 321, TRUE),
    (3202, 'GENERAL RESERVE', 'equity', 'RESERVES', FALSE, FALSE, 3200, NULL, 322, TRUE),
    (3203, 'RISK/CAPITAL ADEQUACY RESERVE', 'equity', 'RESERVES', FALSE, FALSE, 3200, NULL, 323, TRUE),
    (3300, 'RETAINED EARNINGS', 'equity', 'RETAINED', FALSE, TRUE, 3999, '3301+3302', 330, TRUE),
    (3301, 'ACCUMULATED SURPLUS', 'equity', 'RETAINED', FALSE, FALSE, 3300, NULL, 331, TRUE),
    (3302, 'CURRENT YEAR SURPLUS', 'equity', 'RETAINED', FALSE, FALSE, 3300, NULL, 332, TRUE)
ON CONFLICT (account_code) DO NOTHING;

-- ── Seed: INCOME (4000 series) ────────────────────────────────────────────────
INSERT INTO chart_of_accounts (account_code, account_name, account_category, account_subcategory, is_total, is_section_header, parent_code, formula, display_order, baseline_active)
VALUES
    (4999, 'TOTAL INCOME', 'income', 'TOTAL', TRUE, FALSE, NULL, '4100+4200', 400, TRUE),
    (4100, 'FINANCIAL INCOME', 'income', 'FINANCIAL', FALSE, TRUE, 4999, '4101+4102', 410, TRUE),
    (4101, 'INTEREST INCOME FROM LOANS', 'income', 'FINANCIAL', FALSE, FALSE, 4100, NULL, 411, TRUE),
    (4102, 'FEES & COMMISSIONS INCOME', 'income', 'FINANCIAL', FALSE, FALSE, 4100, NULL, 412, TRUE),
    (4200, 'OTHER INCOME', 'income', 'OTHER', FALSE, TRUE, 4999, '4201', 420, TRUE),
    (4201, 'OTHER OPERATING INCOME', 'income', 'OTHER', FALSE, FALSE, 4200, NULL, 421, TRUE)
ON CONFLICT (account_code) DO NOTHING;

-- ── Seed: EXPENSES (5000 series) ──────────────────────────────────────────────
INSERT INTO chart_of_accounts (account_code, account_name, account_category, account_subcategory, is_total, is_section_header, parent_code, formula, display_order, baseline_active)
VALUES
    (5999, 'TOTAL EXPENSES', 'expenses', 'TOTAL', TRUE, FALSE, NULL, '5100+5200+5300', 500, TRUE),
    (5100, 'FINANCIAL EXPENSES', 'expenses', 'FINANCIAL', FALSE, TRUE, 5999, '5101+5102', 510, TRUE),
    (5101, 'INTEREST EXPENSE ON DEPOSITS', 'expenses', 'FINANCIAL', FALSE, FALSE, 5100, NULL, 511, TRUE),
    (5102, 'INTEREST EXPENSE ON BORROWINGS', 'expenses', 'FINANCIAL', FALSE, FALSE, 5100, NULL, 512, TRUE),
    (5200, 'OPERATING EXPENSES', 'expenses', 'OPERATING', FALSE, TRUE, 5999, '5201+5202+5203+5204', 520, TRUE),
    (5201, 'PERSONNEL COSTS', 'expenses', 'OPERATING', FALSE, FALSE, 5200, NULL, 521, TRUE),
    (5202, 'ADMINISTRATIVE EXPENSES', 'expenses', 'OPERATING', FALSE, FALSE, 5200, NULL, 522, TRUE),
    (5203, 'GOVERNANCE EXPENSES', 'expenses', 'OPERATING', FALSE, FALSE, 5200, NULL, 523, TRUE),
    (5204, 'DEPRECIATION & AMORTIZATION', 'expenses', 'OPERATING', FALSE, FALSE, 5200, NULL, 524, TRUE),
    (5300, 'CREDIT LOSS EXPENSE', 'expenses', 'CREDIT_LOSS', FALSE, TRUE, 5999, '5301', 530, TRUE),
    (5301, 'LOAN LOSS PROVISION EXPENSE', 'expenses', 'CREDIT_LOSS', FALSE, FALSE, 5300, NULL, 531, TRUE)
ON CONFLICT (account_code) DO NOTHING;

-- ── Seed: SURPLUS (6000 series) ───────────────────────────────────────────────
INSERT INTO chart_of_accounts (account_code, account_name, account_category, account_subcategory, is_total, is_section_header, parent_code, formula, display_order, baseline_active)
VALUES
    (6999, 'NET SURPLUS/(DEFICIT)', 'surplus', 'TOTAL', TRUE, FALSE, NULL, '4999-5999', 600, TRUE)
ON CONFLICT (account_code) DO NOTHING;

-- ── Seed: chart_of_accounts_coop_types (all accounts active for all coop types) ─
INSERT INTO chart_of_accounts_coop_types (account_code, cooperative_type, is_required, is_active)
SELECT a.account_code, t.coop_type, FALSE, TRUE
FROM chart_of_accounts a
CROSS JOIN (VALUES
    ('sacco'::cooperative_type),
    ('multipurpose'::cooperative_type),
    ('farm'::cooperative_type),
    ('housing'::cooperative_type),
    ('transport'::cooperative_type),
    ('finance'::cooperative_type),
    ('other'::cooperative_type)
) AS t(coop_type)
ON CONFLICT (account_code, cooperative_type) DO NOTHING;