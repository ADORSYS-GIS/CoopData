import { ACCOUNT_CODES, type BalanceSheet } from "@/lib/financial-data";
import type {
  WizardFarmCoop,
  WizardMember,
  WizardSavings,
  WizardLoan,
  WizardFixedDeposit,
} from "./types";

export const ACTIVE_ACCOUNT_CODES = [
  // Assets
  1101, 1102, 1103, 1104, 1201, 1202, 1203, 1204, 1205, 1251, 1252, 1301, 1302, 1303, 1304, 1305,
  // Liabilities
  2101, 2102, 2103, 2201, 2202, 2301, 2302, 2303,
  // Equity
  3101, 3102, 3201, 3202, 3203, 3301, 3302,
  // Income
  4101, 4102, 4201,
  // Expenses
  5101, 5102, 5201, 5202, 5203, 5204, 5301,
];

export const ACCOUNT_METADATA: Record<
  number,
  { name: string; category: string; subcategory: string }
> = {
  1101: { name: "Cash on Hand", category: "assets", subcategory: "liquid_assets" },
  1102: {
    name: "Cash at Bank – Current Account",
    category: "assets",
    subcategory: "liquid_assets",
  },
  1103: {
    name: "Cash at Bank – Savings Account",
    category: "assets",
    subcategory: "liquid_assets",
  },
  1104: { name: "Short-Term Investments", category: "assets", subcategory: "liquid_assets" },
  1201: { name: "Performing Loan Portfolio", category: "assets", subcategory: "loan_portfolio" },
  1202: { name: "Loans in Arrears (1-30 days)", category: "assets", subcategory: "loan_portfolio" },
  1203: {
    name: "Loans in Arrears (31-60 days)",
    category: "assets",
    subcategory: "loan_portfolio",
  },
  1204: {
    name: "Loans in Arrears (61-90 days)",
    category: "assets",
    subcategory: "loan_portfolio",
  },
  1205: {
    name: "Non-Performing Loans (>90 days)",
    category: "assets",
    subcategory: "loan_portfolio",
  },
  1251: {
    name: "General Loan Loss Provision",
    category: "assets",
    subcategory: "loan_loss_provisions",
  },
  1252: {
    name: "Specific Loan Loss Provision",
    category: "assets",
    subcategory: "loan_loss_provisions",
  },
  1301: { name: "Accounts Receivable", category: "assets", subcategory: "other_assets" },
  1302: { name: "Prepaid Expenses", category: "assets", subcategory: "other_assets" },
  1303: { name: "Fixed Assets (at Cost)", category: "assets", subcategory: "other_assets" },
  1304: { name: "Accumulated Depreciation", category: "assets", subcategory: "other_assets" },
  1305: { name: "Intangible Assets", category: "assets", subcategory: "other_assets" },

  2101: {
    name: "Voluntary Savings Deposits",
    category: "liabilities",
    subcategory: "member_deposits",
  },
  2102: {
    name: "Mandatory Savings Deposits",
    category: "liabilities",
    subcategory: "member_deposits",
  },
  2103: { name: "Fixed Term Deposits", category: "liabilities", subcategory: "member_deposits" },
  2201: { name: "Short-Term Borrowings", category: "liabilities", subcategory: "borrowings" },
  2202: { name: "Long-Term Borrowings", category: "liabilities", subcategory: "borrowings" },
  2301: { name: "Accounts Payable", category: "liabilities", subcategory: "other_liabilities" },
  2302: { name: "Accrued Expenses", category: "liabilities", subcategory: "other_liabilities" },
  2303: { name: "Deferred Income", category: "liabilities", subcategory: "other_liabilities" },

  3101: { name: "Permanent Share Capital", category: "equity", subcategory: "member_shares" },
  3102: { name: "Withdrawable Shares", category: "equity", subcategory: "member_shares" },
  3201: { name: "Statutory Reserve", category: "equity", subcategory: "reserves" },
  3202: { name: "General Reserve", category: "equity", subcategory: "reserves" },
  3203: { name: "Risk / Capital Adequacy Reserve", category: "equity", subcategory: "reserves" },
  3301: { name: "Accumulated Surplus", category: "equity", subcategory: "retained_earnings" },
  3302: { name: "Current Year Surplus", category: "equity", subcategory: "retained_earnings" },

  4101: { name: "Interest Income on Loans", category: "income", subcategory: "financial_income" },
  4102: {
    name: "Fees and Commissions Income",
    category: "income",
    subcategory: "financial_income",
  },
  4201: { name: "Other Operating Income", category: "income", subcategory: "other_income" },

  5101: {
    name: "Interest Expense on Member Deposits",
    category: "expenses",
    subcategory: "financial_expenses",
  },
  5102: {
    name: "Interest Expense on Borrowings",
    category: "expenses",
    subcategory: "financial_expenses",
  },
  5201: { name: "Personnel Costs", category: "expenses", subcategory: "operating_expenses" },
  5202: {
    name: "Administrative Expenses",
    category: "expenses",
    subcategory: "operating_expenses",
  },
  5203: { name: "Governance Expenses", category: "expenses", subcategory: "operating_expenses" },
  5204: {
    name: "Depreciation and Amortization",
    category: "expenses",
    subcategory: "operating_expenses",
  },
  5301: { name: "Loan Loss Provision Expense", category: "expenses", subcategory: "credit_loss" },
};

export function createEmptyFinancialGrid(): Record<number, Record<number, number>> {
  const grid: Record<number, Record<number, number>> = {};
  for (const code of ACTIVE_ACCOUNT_CODES) {
    grid[code] = {};
    for (let m = 1; m <= 12; m++) {
      grid[code][m] = 0;
    }
  }
  return grid;
}

export function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function createEmptyFarmCoop(): WizardFarmCoop {
  return {
    cooperativeType: "Sacco",
    primaryActivities: "Savings and Credit",
    yearOfEstablishment: new Date().getFullYear(),
    operationalStatus: "Active",
    activeProducerFlag: true,
    productionType: "Crop",
    participationFrequency: "Monthly",
    deliveryCompliance: "Compliant",
    productionCycleType: "Annual",
    useOfProductionPlanning: true,
    useOfSharedInputs: false,
    qualityComplianceFlag: true,
    marketChannelType: "Direct",
    formalOfftakeAgreement: false,
    buyerConcentrationFlag: false,
    pricePredictabilityCategory: "Stable",
    accessToStorage: true,
    accessToProcessingFacilities: false,
    transportCoordination: "Self-Coordinated",
    climateExposureType: "Low",
    irrigationAccess: false,
    climateMitigationPractices: "None",
  };
}

export function balanceSheetToLineItems(bs: BalanceSheet) {
  const month = bs.accountingYear === "fiscal" ? 6 : 12;
  return [
    {
      account_code: ACCOUNT_CODES.ASSETS.CASH_ON_HAND,
      account_name: "Cash on Hand",
      account_category: "assets",
      account_subcategory: "liquid_assets",
      month,
      value: bs.liquidAssets.cashOnHand,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.CASH_AT_BANK_CURRENT,
      account_name: "Cash at Bank Current",
      account_category: "assets",
      account_subcategory: "liquid_assets",
      month,
      value: bs.liquidAssets.cashAtBankCurrent,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.CASH_AT_BANK_SAVINGS,
      account_name: "Cash at Bank Savings",
      account_category: "assets",
      account_subcategory: "liquid_assets",
      month,
      value: bs.liquidAssets.cashAtBankSavings,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.SHORT_TERM_INVESTMENTS,
      account_name: "Short-term Investments",
      account_category: "assets",
      account_subcategory: "liquid_assets",
      month,
      value: bs.liquidAssets.shortTermInvestments,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.PERFORMING_LOAN_PORTFOLIO,
      account_name: "Performing Loan Portfolio",
      account_category: "assets",
      account_subcategory: "loan_portfolio",
      month,
      value: bs.loanPortfolio.performingLoanPortfolio,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.LOANS_IN_ARREARS_1_30,
      account_name: "Loans in Arrears 1-30 Days",
      account_category: "assets",
      account_subcategory: "loan_portfolio",
      month,
      value: bs.loanPortfolio.loansInArrears_1_30,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.LOANS_IN_ARREARS_31_60,
      account_name: "Loans in Arrears 31-60 Days",
      account_category: "assets",
      account_subcategory: "loan_portfolio",
      month,
      value: bs.loanPortfolio.loansInArrears_31_60,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.LOANS_IN_ARREARS_61_90,
      account_name: "Loans in Arrears 61-90 Days",
      account_category: "assets",
      account_subcategory: "loan_portfolio",
      month,
      value: bs.loanPortfolio.loansInArrears_61_90,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.NON_PERFORMING_LOANS,
      account_name: "Non-Performing Loans (>90 Days)",
      account_category: "assets",
      account_subcategory: "loan_portfolio",
      month,
      value: bs.loanPortfolio.nonPerformingLoans,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.GENERAL_LOAN_LOSS_PROV,
      account_name: "General Loan Loss Provision",
      account_category: "assets",
      account_subcategory: "loan_loss_provisions",
      month,
      value: -Math.abs(bs.loanLossProvisions.generalLoanLossProvision),
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.SPECIFIC_LOAN_LOSS_PROV,
      account_name: "Specific Loan Loss Provision",
      account_category: "assets",
      account_subcategory: "loan_loss_provisions",
      month,
      value: -Math.abs(bs.loanLossProvisions.specificLoanLossProvision),
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.ACCOUNTS_RECEIVABLE,
      account_name: "Accounts Receivable",
      account_category: "assets",
      account_subcategory: "other_assets",
      month,
      value: bs.otherAssets.accountsReceivable,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.PREPAID_EXPENSES,
      account_name: "Prepaid Expenses",
      account_category: "assets",
      account_subcategory: "other_assets",
      month,
      value: bs.otherAssets.prepaidExpenses,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.FIXED_ASSETS_COST,
      account_name: "Fixed Assets (Cost)",
      account_category: "assets",
      account_subcategory: "other_assets",
      month,
      value: bs.otherAssets.fixedAssetsCost,
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.ACCUMULATED_DEPRECIATION,
      account_name: "Accumulated Depreciation",
      account_category: "assets",
      account_subcategory: "other_assets",
      month,
      value: -Math.abs(bs.otherAssets.accumulatedDepreciation),
    },
    {
      account_code: ACCOUNT_CODES.ASSETS.INTANGIBLE_ASSETS,
      account_name: "Intangible Assets",
      account_category: "assets",
      account_subcategory: "other_assets",
      month,
      value: bs.otherAssets.intangibleAssets,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.VOLUNTARY_SAVINGS,
      account_name: "Voluntary Savings",
      account_category: "liabilities",
      account_subcategory: "member_deposits",
      month,
      value: bs.memberDeposits.voluntarySavings,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.MANDATORY_SAVINGS,
      account_name: "Mandatory Savings",
      account_category: "liabilities",
      account_subcategory: "member_deposits",
      month,
      value: bs.memberDeposits.mandatorySavings,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.FIXED_TERM_DEPOSITS,
      account_name: "Fixed Term Deposits",
      account_category: "liabilities",
      account_subcategory: "member_deposits",
      month,
      value: bs.memberDeposits.fixedTermDeposits,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.SHORT_TERM_BORROWINGS,
      account_name: "Short-term Borrowings",
      account_category: "liabilities",
      account_subcategory: "borrowings",
      month,
      value: bs.borrowings.shortTermBorrowings,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.LONG_TERM_BORROWINGS,
      account_name: "Long-term Borrowings",
      account_category: "liabilities",
      account_subcategory: "borrowings",
      month,
      value: bs.borrowings.longTermBorrowings,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.ACCOUNTS_PAYABLE,
      account_name: "Accounts Payable",
      account_category: "liabilities",
      account_subcategory: "other_liabilities",
      month,
      value: bs.otherLiabilities.accountsPayable,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.ACCRUED_EXPENSES,
      account_name: "Accrued Expenses",
      account_category: "liabilities",
      account_subcategory: "other_liabilities",
      month,
      value: bs.otherLiabilities.accruedExpenses,
    },
    {
      account_code: ACCOUNT_CODES.LIABILITIES.DEFERRED_INCOME,
      account_name: "Deferred Income",
      account_category: "liabilities",
      account_subcategory: "other_liabilities",
      month,
      value: bs.otherLiabilities.deferredIncome,
    },
    {
      account_code: ACCOUNT_CODES.EQUITY.PERMANENT_SHARE_CAPITAL,
      account_name: "Permanent Share Capital",
      account_category: "equity",
      account_subcategory: "member_shares",
      month,
      value: bs.memberShares.permanentShareCapital,
    },
    {
      account_code: ACCOUNT_CODES.EQUITY.WITHDRAWABLE_SHARES,
      account_name: "Withdrawable Shares",
      account_category: "equity",
      account_subcategory: "member_shares",
      month,
      value: bs.memberShares.withdrawableShares,
    },
    {
      account_code: ACCOUNT_CODES.EQUITY.STATUTORY_RESERVE,
      account_name: "Statutory Reserve",
      account_category: "equity",
      account_subcategory: "reserves",
      month,
      value: bs.reserves.statutoryReserve,
    },
    {
      account_code: ACCOUNT_CODES.EQUITY.GENERAL_RESERVE,
      account_name: "General Reserve",
      account_category: "equity",
      account_subcategory: "reserves",
      month,
      value: bs.reserves.generalReserve,
    },
    {
      account_code: ACCOUNT_CODES.EQUITY.RISK_CAPITAL_ADEQUACY_RESERVE,
      account_name: "Risk Capital Adequacy Reserve",
      account_category: "equity",
      account_subcategory: "reserves",
      month,
      value: bs.reserves.riskCapitalAdequacyReserve,
    },
    {
      account_code: ACCOUNT_CODES.EQUITY.ACCUMULATED_SURPLUS,
      account_name: "Accumulated Surplus",
      account_category: "equity",
      account_subcategory: "retained_earnings",
      month,
      value: bs.retainedEarnings.accumulatedSurplus,
    },
    {
      account_code: ACCOUNT_CODES.EQUITY.CURRENT_YEAR_SURPLUS,
      account_name: "Current Year Surplus",
      account_category: "equity",
      account_subcategory: "retained_earnings",
      month,
      value: bs.retainedEarnings.currentYearSurplus,
    },
    {
      account_code: ACCOUNT_CODES.INCOME.INTEREST_INCOME_LOANS,
      account_name: "Interest Income on Loans",
      account_category: "income",
      account_subcategory: "financial_income",
      month,
      value: bs.financialIncome.interestIncomeLoans,
    },
    {
      account_code: ACCOUNT_CODES.INCOME.FEES_COMMISSIONS_INCOME,
      account_name: "Fees and Commissions Income",
      account_category: "income",
      account_subcategory: "financial_income",
      month,
      value: bs.financialIncome.feesCommissionsIncome,
    },
    {
      account_code: ACCOUNT_CODES.INCOME.OTHER_OPERATING_INCOME,
      account_name: "Other Operating Income",
      account_category: "income",
      account_subcategory: "other_income",
      month,
      value: bs.otherIncome.otherOperatingIncome,
    },
    {
      account_code: ACCOUNT_CODES.EXPENSES.INTEREST_EXPENSE_DEPOSITS,
      account_name: "Interest Expense on Deposits",
      account_category: "expenses",
      account_subcategory: "financial_expenses",
      month,
      value: bs.financialExpenses.interestExpenseDeposits,
    },
    {
      account_code: ACCOUNT_CODES.EXPENSES.INTEREST_EXPENSE_BORROWINGS,
      account_name: "Interest Expense on Borrowings",
      account_category: "expenses",
      account_subcategory: "financial_expenses",
      month,
      value: bs.financialExpenses.interestExpenseBorrowings,
    },
    {
      account_code: ACCOUNT_CODES.EXPENSES.PERSONNEL_COSTS,
      account_name: "Personnel Costs",
      account_category: "expenses",
      account_subcategory: "operating_expenses",
      month,
      value: bs.operatingExpenses.personnelCosts,
    },
    {
      account_code: ACCOUNT_CODES.EXPENSES.ADMINISTRATIVE_EXPENSES,
      account_name: "Administrative Expenses",
      account_category: "expenses",
      account_subcategory: "operating_expenses",
      month,
      value: bs.operatingExpenses.administrativeExpenses,
    },
    {
      account_code: ACCOUNT_CODES.EXPENSES.GOVERNANCE_EXPENSES,
      account_name: "Governance Expenses",
      account_category: "expenses",
      account_subcategory: "operating_expenses",
      month,
      value: bs.operatingExpenses.governanceExpenses,
    },
    {
      account_code: ACCOUNT_CODES.EXPENSES.DEPRECIATION_AMORTIZATION,
      account_name: "Depreciation and Amortization",
      account_category: "expenses",
      account_subcategory: "operating_expenses",
      month,
      value: bs.operatingExpenses.depreciationAmortization,
    },
    {
      account_code: ACCOUNT_CODES.EXPENSES.LOAN_LOSS_PROVISION_EXPENSE,
      account_name: "Loan Loss Provision Expense",
      account_category: "expenses",
      account_subcategory: "credit_loss",
      month,
      value: bs.creditLossExpense,
    },
  ];
}

export const mapAgeGroup = (val: string) => {
  if (val === "<18" || val === "Under 18" || val === "Under18") return "Under18";
  if (val === "18-35" || val === "Between18And35") return "Between18And35";
  if (val === "36-50" || val === "Between36And50") return "Between36And50";
  if (val === "50+" || val === "Over 50" || val === "Over50") return "Over50";
  return "Between18And35";
};

export const mapAgeGroupToFrontend = (val: string) => {
  if (val === "Under18") return "<18";
  if (val === "Between18And35") return "18-35";
  if (val === "Between36And50") return "36-50";
  if (val === "Over50") return "50+";
  return val;
};

export const mapDpdCategory = (val: string) => {
  if (val === "0" || val === "Zero") return "Zero";
  if (val === "1-30" || val === "Days1To30") return "Days1To30";
  if (val === "31-60" || val === "Days31To60") return "Days31To60";
  if (val === "61-90" || val === "Days61To90") return "Days61To90";
  if (val === "91+" || val === "Days91Plus") return "Days91Plus";
  return "Zero";
};

export const mapDpdCategoryToFrontend = (val: string) => {
  if (val === "Zero") return "0";
  if (val === "Days1To30") return "1-30";
  if (val === "Days31To60") return "31-60";
  if (val === "Days61To90") return "61-90";
  if (val === "Days91Plus") return "91+";
  return val;
};
