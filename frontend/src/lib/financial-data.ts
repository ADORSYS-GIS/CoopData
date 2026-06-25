// CoopData Financial Data Structures
// Based on COOPDATA ADORSYS.xlsx Chart of Accounts (1000-6999)

// ============================================================================
// CHART OF ACCOUNTS CODES
// ============================================================================

export const ACCOUNT_CODES = {
  // ASSETS (1000 Series)
  ASSETS: {
    TOTAL: 1999,
    LIQUID_ASSETS: 1100,
    CASH_ON_HAND: 1101,
    CASH_AT_BANK_CURRENT: 1102,
    CASH_AT_BANK_SAVINGS: 1103,
    SHORT_TERM_INVESTMENTS: 1104,
    LOANS_ADVANCES: 1200,
    PERFORMING_LOAN_PORTFOLIO: 1201,
    LOANS_IN_ARREARS_1_30: 1202,
    LOANS_IN_ARREARS_31_60: 1203,
    LOANS_IN_ARREARS_61_90: 1204,
    NON_PERFORMING_LOANS: 1205,
    ALLOWANCE_LOAN_LOSSES: 1250,
    GENERAL_LOAN_LOSS_PROV: 1251,
    SPECIFIC_LOAN_LOSS_PROV: 1252,
    OTHER_ASSETS: 1300,
    ACCOUNTS_RECEIVABLE: 1301,
    PREPAID_EXPENSES: 1302,
    FIXED_ASSETS_COST: 1303,
    ACCUMULATED_DEPRECIATION: 1304,
    INTANGIBLE_ASSETS: 1305,
  },
  // LIABILITIES (2000 Series)
  LIABILITIES: {
    TOTAL: 2999,
    MEMBER_DEPOSITS_SAVINGS: 2100,
    VOLUNTARY_SAVINGS: 2101,
    MANDATORY_SAVINGS: 2102,
    FIXED_TERM_DEPOSITS: 2103,
    BORROWINGS: 2200,
    SHORT_TERM_BORROWINGS: 2201,
    LONG_TERM_BORROWINGS: 2202,
    OTHER_LIABILITIES: 2300,
    ACCOUNTS_PAYABLE: 2301,
    ACCRUED_EXPENSES: 2302,
    DEFERRED_INCOME: 2303,
  },
  // EQUITY (3000 Series)
  EQUITY: {
    TOTAL: 3999,
    MEMBER_SHARES: 3100,
    PERMANENT_SHARE_CAPITAL: 3101,
    WITHDRAWABLE_SHARES: 3102,
    RESERVES: 3200,
    STATUTORY_RESERVE: 3201,
    GENERAL_RESERVE: 3202,
    RISK_CAPITAL_ADEQUACY_RESERVE: 3203,
    RETAINED_EARNINGS: 3300,
    ACCUMULATED_SURPLUS: 3301,
    CURRENT_YEAR_SURPLUS: 3302,
  },
  // INCOME (4000 Series)
  INCOME: {
    TOTAL: 4999,
    FINANCIAL_INCOME: 4100,
    INTEREST_INCOME_LOANS: 4101,
    FEES_COMMISSIONS_INCOME: 4102,
    OTHER_INCOME: 4200,
    OTHER_OPERATING_INCOME: 4201,
  },
  // EXPENSES (5000 Series)
  EXPENSES: {
    TOTAL: 5999,
    FINANCIAL_EXPENSES: 5100,
    INTEREST_EXPENSE_DEPOSITS: 5101,
    INTEREST_EXPENSE_BORROWINGS: 5102,
    OPERATING_EXPENSES: 5200,
    PERSONNEL_COSTS: 5201,
    ADMINISTRATIVE_EXPENSES: 5202,
    GOVERNANCE_EXPENSES: 5203,
    DEPRECIATION_AMORTIZATION: 5204,
    CREDIT_LOSS_EXPENSE: 5300,
    LOAN_LOSS_PROVISION_EXPENSE: 5301,
  },
  // SURPLUS/DEFICIT (6000 Series)
  SURPLUS: {
    NET_SURPLUS_DEFICIT: 6999,
  },
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface LiquidAssets {
  cashOnHand: number; // 1101
  cashAtBankCurrent: number; // 1102
  cashAtBankSavings: number; // 1103
  shortTermInvestments: number; // 1104
}

export interface LoanPortfolio {
  performingLoanPortfolio: number; // 1201
  loansInArrears_1_30: number; // 1202
  loansInArrears_31_60: number; // 1203
  loansInArrears_61_90: number; // 1204
  nonPerformingLoans: number; // 1205 ( >90 days)
}

export interface LoanLossProvisions {
  generalLoanLossProvision: number; // 1251
  specificLoanLossProvision: number; // 1252
}

export interface OtherAssets {
  accountsReceivable: number; // 1301
  prepaidExpenses: number; // 1302
  fixedAssetsCost: number; // 1303
  accumulatedDepreciation: number; // 1304
  intangibleAssets: number; // 1305
}

export interface MemberDeposits {
  voluntarySavings: number; // 2101
  mandatorySavings: number; // 2102
  fixedTermDeposits: number; // 2103
}

export interface Borrowings {
  shortTermBorrowings: number; // 2201
  longTermBorrowings: number; // 2202
}

export interface OtherLiabilities {
  accountsPayable: number; // 2301
  accruedExpenses: number; // 2302
  deferredIncome: number; // 2303
}

export interface MemberShares {
  permanentShareCapital: number; // 3101
  withdrawableShares: number; // 3102
}

export interface Reserves {
  statutoryReserve: number; // 3201
  generalReserve: number; // 3202
  riskCapitalAdequacyReserve: number; // 3203
}

export interface RetainedEarnings {
  accumulatedSurplus: number; // 3301
  currentYearSurplus: number; // 3302
}

export interface FinancialIncome {
  interestIncomeLoans: number; // 4101
  feesCommissionsIncome: number; // 4102
}

export interface OtherIncome {
  otherOperatingIncome: number; // 4201
}

export interface FinancialExpenses {
  interestExpenseDeposits: number; // 5101
  interestExpenseBorrowings: number; // 5102
}

export interface OperatingExpenses {
  personnelCosts: number; // 5201
  administrativeExpenses: number; // 5202
  governanceExpenses: number; // 5203
  depreciationAmortization: number; // 5204
}

// ============================================================================
// COMPLETE FINANCIAL STATEMENT
// ============================================================================

export interface BalanceSheet {
  reportingPeriod: string; // e.g., "2024-12"
  cooperativeId: string;
  cooperativeName: string;
  submissionDate: string;

  // ASSETS
  liquidAssets: LiquidAssets;
  loanPortfolio: LoanPortfolio;
  loanLossProvisions: LoanLossProvisions;
  otherAssets: OtherAssets;

  // LIABILITIES
  memberDeposits: MemberDeposits;
  borrowings: Borrowings;
  otherLiabilities: OtherLiabilities;

  // EQUITY
  memberShares: MemberShares;
  reserves: Reserves;
  retainedEarnings: RetainedEarnings;

  // INCOME
  financialIncome: FinancialIncome;
  otherIncome: OtherIncome;

  // EXPENSES
  financialExpenses: FinancialExpenses;
  operatingExpenses: OperatingExpenses;
  creditLossExpense: number; // 5301

  // METADATA
  currency: string; // e.g., "USD" or "SZL"
  accountingYear: "calendar" | "fiscal"; // Jan-Dec or Jul-Jun
}

// ============================================================================
// CALCULATED TOTALS
// ============================================================================

export function calculateTotalLiquidAssets(assets: LiquidAssets): number {
  return (
    assets.cashOnHand +
    assets.cashAtBankCurrent +
    assets.cashAtBankSavings +
    assets.shortTermInvestments
  );
}

export function calculateGrossLoanPortfolio(loans: LoanPortfolio): number {
  return (
    loans.performingLoanPortfolio +
    loans.loansInArrears_1_30 +
    loans.loansInArrears_31_60 +
    loans.loansInArrears_61_90 +
    loans.nonPerformingLoans
  );
}

export function calculateTotalLoanLossProvisions(provisions: LoanLossProvisions): number {
  return provisions.generalLoanLossProvision + provisions.specificLoanLossProvision;
}

export function calculateNetLoanPortfolio(
  loans: LoanPortfolio,
  provisions: LoanLossProvisions,
): number {
  return calculateGrossLoanPortfolio(loans) - calculateTotalLoanLossProvisions(provisions);
}

export function calculateTotalOtherAssets(assets: OtherAssets): number {
  return (
    assets.accountsReceivable +
    assets.prepaidExpenses +
    assets.fixedAssetsCost -
    Math.abs(assets.accumulatedDepreciation) +
    assets.intangibleAssets
  );
}

export function calculateTotalAssets(bs: BalanceSheet): number {
  return (
    calculateTotalLiquidAssets(bs.liquidAssets) +
    calculateGrossLoanPortfolio(bs.loanPortfolio) -
    calculateTotalLoanLossProvisions(bs.loanLossProvisions) +
    calculateTotalOtherAssets(bs.otherAssets)
  );
}

export function calculateTotalMemberDeposits(deposits: MemberDeposits): number {
  return deposits.voluntarySavings + deposits.mandatorySavings + deposits.fixedTermDeposits;
}

export function calculateTotalBorrowings(borrowings: Borrowings): number {
  return borrowings.shortTermBorrowings + borrowings.longTermBorrowings;
}

export function calculateTotalOtherLiabilities(liabilities: OtherLiabilities): number {
  return liabilities.accountsPayable + liabilities.accruedExpenses + liabilities.deferredIncome;
}

export function calculateTotalLiabilities(bs: BalanceSheet): number {
  return (
    calculateTotalMemberDeposits(bs.memberDeposits) +
    calculateTotalBorrowings(bs.borrowings) +
    calculateTotalOtherLiabilities(bs.otherLiabilities)
  );
}

export function calculateTotalMemberShares(shares: MemberShares): number {
  return shares.permanentShareCapital + shares.withdrawableShares;
}

export function calculateTotalReserves(reserves: Reserves): number {
  return reserves.statutoryReserve + reserves.generalReserve + reserves.riskCapitalAdequacyReserve;
}

export function calculateTotalRetainedEarnings(earnings: RetainedEarnings): number {
  return earnings.accumulatedSurplus + earnings.currentYearSurplus;
}

export function calculateTotalEquity(bs: BalanceSheet): number {
  return (
    calculateTotalMemberShares(bs.memberShares) +
    calculateTotalReserves(bs.reserves) +
    calculateTotalRetainedEarnings(bs.retainedEarnings)
  );
}

export function calculateTotalFinancialIncome(income: FinancialIncome): number {
  return income.interestIncomeLoans + income.feesCommissionsIncome;
}

export function calculateTotalOtherIncome(income: OtherIncome): number {
  return income.otherOperatingIncome;
}

export function calculateTotalIncome(bs: BalanceSheet): number {
  return (
    calculateTotalFinancialIncome(bs.financialIncome) + calculateTotalOtherIncome(bs.otherIncome)
  );
}

export function calculateTotalFinancialExpenses(expenses: FinancialExpenses): number {
  return expenses.interestExpenseDeposits + expenses.interestExpenseBorrowings;
}

export function calculateTotalOperatingExpenses(expenses: OperatingExpenses): number {
  return (
    expenses.personnelCosts +
    expenses.administrativeExpenses +
    expenses.governanceExpenses +
    expenses.depreciationAmortization
  );
}

export function calculateTotalExpenses(bs: BalanceSheet): number {
  return (
    calculateTotalFinancialExpenses(bs.financialExpenses) +
    calculateTotalOperatingExpenses(bs.operatingExpenses) +
    bs.creditLossExpense
  );
}

export function calculateNetSurplus(bs: BalanceSheet): number {
  return calculateTotalIncome(bs) - calculateTotalExpenses(bs);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export function validateBalanceSheet(bs: BalanceSheet): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Balance Sheet Must Balance: Assets = Liabilities + Equity
  const totalAssets = calculateTotalAssets(bs);
  const totalLiabEquity = calculateTotalLiabilities(bs) + calculateTotalEquity(bs);
  const balanceDifference = Math.abs(totalAssets - totalLiabEquity);

  if (balanceDifference > 0.01) {
    errors.push({
      field: "balance",
      message: `Balance sheet must balance. Assets (${totalAssets.toFixed(2)})≠ Liabilities + Equity (${totalLiabEquity.toFixed(2)}). Difference: ${balanceDifference.toFixed(2)}`,
      severity: "error",
    });
  }

  // 2. Loan Portfolio Breakdown
  const calculatedGrossLoans = calculateGrossLoanPortfolio(bs.loanPortfolio);
  if (calculatedGrossLoans < 0) {
    errors.push({
      field: "loanPortfolio",
      message: "Gross loan portfolio cannot be negative",
      severity: "error",
    });
  }

  // 3. All Values Must Be ≥ 0 (except accumulated depreciation)
  const nonNegativeFields = [
    { path: "liquidAssets.cashOnHand", value: bs.liquidAssets.cashOnHand },
    { path: "liquidAssets.cashAtBankCurrent", value: bs.liquidAssets.cashAtBankCurrent },
    { path: "liquidAssets.cashAtBankSavings", value: bs.liquidAssets.cashAtBankSavings },
    { path: "memberDeposits.voluntarySavings", value: bs.memberDeposits.voluntarySavings },
    { path: "memberDeposits.mandatorySavings", value: bs.memberDeposits.mandatorySavings },
  ];

  for (const field of nonNegativeFields) {
    if (field.value < 0) {
      errors.push({
        field: field.path,
        message: `${field.path} cannot be negative`,
        severity: "error",
      });
    }
  }

  // 4. Reasonableness Checks (Warnings)
  if (calculateTotalAssets(bs) === 0) {
    warnings.push({
      field: "assets",
      message: "Total assets is zero. This may indicate missing data.",
    });
  }

  if (calculateNetSurplus(bs) < 0) {
    warnings.push({
      field: "surplus",
      message: "Net surplus is negative (deficit).",
    });
  }

  // 5. PAR Reasonableness
  const grossLP = calculateGrossLoanPortfolio(bs.loanPortfolio);
  if (grossLP > 0) {
    const par30Rate =
      ((bs.loanPortfolio.loansInArrears_31_60 +
        bs.loanPortfolio.loansInArrears_61_90 +
        bs.loanPortfolio.nonPerformingLoans) /
        grossLP) *
      100;
    if (par30Rate > 20) {
      warnings.push({
        field: "loanPortfolio",
        message: `PAR >30 days is ${par30Rate.toFixed(1)}% which exceeds the 20% warning threshold.`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// NON-FINANCIAL DATA INTERFACES
// ============================================================================

export interface MemberRecord {
  memberId: string;
  joinDate: string;
  status: "Active" | "Dormant" | "Exited";
  exitDate?: string;
  gender: "Male" | "Female" | "Other";
  ageGroup: "<18" | "18-35" | "36-50" | "50+";
  region: string;
  urbanRural: "Urban" | "Rural";
  agmAttendance: boolean;
  leadershipRole?: string;
  votingExercised: boolean;
}

export interface SavingsAccount {
  savingsAccountId: string;
  memberId: string;
  accountType: "Voluntary" | "Mandatory" | "Fixed";
  accountOpeningDate: string;
  accountStatus: "Active" | "Dormant" | "Closed";
  contributionFrequency: "Weekly" | "Monthly" | "Quarterly" | "Irregular";
  lastContributionDate: string;
  numberOfContributions: number;
  balanceTrend: "Increasing" | "Stable" | "Decreasing";
  zeroBalanceFlag: boolean;
  withdrawalFrequencyCategory: "Low" | "Medium" | "High";
  emergencyWithdrawalsFlag: boolean;
  interestRate: number;
  balance: number;
}

export interface LoanRecord {
  loanId: string;
  memberId: string;
  loanProductType: string;
  loanStartDate: string;
  loanMaturityDate: string;
  loanStatus: "Performing" | "Arrears" | "Restructured" | "Written Off";
  borrowerType: string;
  youthBorrowerFlag: boolean;
  womenBorrowerFlag: boolean;
  ruralBorrowerFlag: boolean;
  repaymentRegularity: "Regular" | "Irregular" | "Default";
  daysPastDueCategory: "0" | "1-30" | "31-60" | "61-90" | "91+";
  missedInstallmentsCount: number;
  restructuredLoanFlag: boolean;
  numberOfRestructurings: number;
  earlySettlementFlag: boolean;
  multipleLoansFlag: boolean;
  largeBorrowerFlag: boolean;
  interestRate: number;
  balance: number;
  loanAmount: number;
}

export interface FixedDepositRecord {
  fixedDepositId: string;
  memberId: string;
  depositType: "Short-term" | "Medium-term" | "Long-term";
  startDate: string;
  maturityDate: string;
  status: "Active" | "Matured" | "Withdrawn" | "Rolled Over";
  tenureCategory: "<3m" | "3-6m" | "6-12m" | "1-3y" | ">3y";
  originalTenureSelected: string;
  earlyWithdrawalFlag: boolean;
  rolloverAtMaturityFlag: boolean;
  numberOfRenewals: number;
  changeInTenureAtRenewal: boolean;
  singleDepositorDependencyFlag: boolean;
  interestRate: number;
  balance: number;
}

// ============================================================================
// EMPTY TEMPLATES
// ============================================================================

export function createEmptyBalanceSheet(): BalanceSheet {
  return {
    reportingPeriod: "",
    cooperativeId: "",
    cooperativeName: "",
    submissionDate: "",
    currency: "USD",
    accountingYear: "calendar",

    liquidAssets: {
      cashOnHand: 0,
      cashAtBankCurrent: 0,
      cashAtBankSavings: 0,
      shortTermInvestments: 0,
    },
    loanPortfolio: {
      performingLoanPortfolio: 0,
      loansInArrears_1_30: 0,
      loansInArrears_31_60: 0,
      loansInArrears_61_90: 0,
      nonPerformingLoans: 0,
    },
    loanLossProvisions: {
      generalLoanLossProvision: 0,
      specificLoanLossProvision: 0,
    },
    otherAssets: {
      accountsReceivable: 0,
      prepaidExpenses: 0,
      fixedAssetsCost: 0,
      accumulatedDepreciation: 0,
      intangibleAssets: 0,
    },

    memberDeposits: {
      voluntarySavings: 0,
      mandatorySavings: 0,
      fixedTermDeposits: 0,
    },
    borrowings: {
      shortTermBorrowings: 0,
      longTermBorrowings: 0,
    },
    otherLiabilities: {
      accountsPayable: 0,
      accruedExpenses: 0,
      deferredIncome: 0,
    },

    memberShares: {
      permanentShareCapital: 0,
      withdrawableShares: 0,
    },
    reserves: {
      statutoryReserve: 0,
      generalReserve: 0,
      riskCapitalAdequacyReserve: 0,
    },
    retainedEarnings: {
      accumulatedSurplus: 0,
      currentYearSurplus: 0,
    },

    financialIncome: {
      interestIncomeLoans: 0,
      feesCommissionsIncome: 0,
    },
    otherIncome: {
      otherOperatingIncome: 0,
    },

    financialExpenses: {
      interestExpenseDeposits: 0,
      interestExpenseBorrowings: 0,
    },
    operatingExpenses: {
      personnelCosts: 0,
      administrativeExpenses: 0,
      governanceExpenses: 0,
      depreciationAmortization: 0,
    },
    creditLossExpense: 0,
  };
}
