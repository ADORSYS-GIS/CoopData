// CoopData KPI Calculations
// Based on COOPDATA ADORSYS.xlsx Indicator definitions

import type {
  BalanceSheet,
  MemberRecord,
  SavingsAccount,
  LoanRecord,
  FixedDepositRecord,
} from "./financial-data";
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateTotalEquity,
  calculateGrossLoanPortfolio,
  calculateNetLoanPortfolio,
  calculateTotalLoanLossProvisions,
  calculateTotalMemberDeposits,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateTotalFinancialIncome,
  calculateTotalFinancialExpenses,
  calculateTotalOperatingExpenses,
} from "./financial-data";

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface KPIResult {
  value: number;
  formatted: string;
  unit: string;
  description: string;
  status?: "green" | "amber" | "red";
  benchmark?: number;
  variance?: number;
}

export interface FinancialKPIs {
  // Size & Market Structure
  totalAssets: KPIResult;
  grossLoanPortfolio: KPIResult;
  netLoanPortfolio: KPIResult;
  totalMemberDeposits: KPIResult;
  totalEquity: KPIResult;

  // Portfolio Quality
  par30: KPIResult; // Portfolio at Risk >30 days
  par60: KPIResult; // Portfolio at Risk >60 days
  par90: KPIResult; // Portfolio at Risk >90 days
  nplRatio: KPIResult; // Non-Performing Loans Ratio
  loanLossCoverage: KPIResult;
  writeOffRatio?: KPIResult;

  // Profitability
  roa: KPIResult; // Return on Assets
  roe: KPIResult; // Return on Equity
  financialRevenueRatio: KPIResult;
  financialExpenseRatio: KPIResult;
  operatingExpenseRatio: KPIResult;
  costOfFunds: KPIResult;
  yieldOnPortfolio: KPIResult;
  netInterestMargin: KPIResult;
  operationalSelfSufficiency: KPIResult;

  // Liquidity & Solvency
  currentRatio: KPIResult;
  cashRatio: KPIResult;
  capitalAdequacyRatio: KPIResult;
  debtToEquity: KPIResult;
  liquidFundsRatio: KPIResult;
  depositsToLoans: KPIResult;

  // Savings
  savingsToAssets: KPIResult;
  voluntarySavingsRatio: KPIResult;
}

export interface MembershipKPIs {
  totalMembers: KPIResult;
  membershipGrowthRate: KPIResult;
  dormancyRate: KPIResult;
  exitRate: KPIResult;
  activeMembersRatio: KPIResult;
  agmParticipationRate: KPIResult;
  womenMembersPercent: KPIResult;
  youthMembersPercent: KPIResult;
  ruralMembersPercent: KPIResult;
  womenInGovernancePercent: KPIResult;
  youthInGovernancePercent: KPIResult;
}

export interface SavingsKPIs {
  savingsPenetration: KPIResult;
  activeSaversRatio: KPIResult;
  regularSaversRatio: KPIResult;
  dormantSavingsAccountsPercent: KPIResult;
  zeroBalanceAccountsPercent: KPIResult;
  stableBalanceRatio: KPIResult;
  highWithdrawalFrequencyPercent: KPIResult;
  emergencyWithdrawalIncidence: KPIResult;
  averageInterestRate: KPIResult;
  accountConcentration: KPIResult;
}

export interface LoanKPIs {
  creditPenetration: KPIResult;
  onTimeRepaymentRatio: KPIResult;
  loansInArrearsPercent: KPIResult;
  restructuredLoansRatio: KPIResult;
  womenBorrowersPercent: KPIResult;
  youthBorrowersPercent: KPIResult;
  ruralBorrowersPercent: KPIResult;
  averageLoanSize: KPIResult;
  loansPerMember: KPIResult;
  averageInterestRate: KPIResult;
}

export interface FixedDepositKPIs {
  fdPenetration: KPIResult;
  longTermFdRatio: KPIResult;
  fdRolloverRate: KPIResult;
  earlyWithdrawalRate: KPIResult;
  concentrationRisk: KPIResult;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

function getStatus(
  value: number,
  target: number,
  warningThreshold?: number,
): "green" | "amber" | "red" {
  // For values where higher is better
  if (value >= target) return "green";
  if (warningThreshold !== undefined && value >= warningThreshold) return "amber";
  return "red";
}

function getStatusInverse(
  value: number,
  target: number,
  warningThreshold?: number,
): "green" | "amber" | "red" {
  // For values where lower is better (e.g., PAR)
  if (value <= target) return "green";
  if (warningThreshold !== undefined && value <= warningThreshold) return "amber";
  return "red";
}

// ============================================================================
// FINANCIAL KPI CALCULATIONS
// ============================================================================

export function calculateFinancialKPIs(bs: BalanceSheet): FinancialKPIs {
  const totalAssets = calculateTotalAssets(bs);
  const totalLiabilities = calculateTotalLiabilities(bs);
  const totalEquity = calculateTotalEquity(bs);
  const grossLP = calculateGrossLoanPortfolio(bs.loanPortfolio);
  const netLP = calculateNetLoanPortfolio(bs.loanPortfolio, bs.loanLossProvisions);
  const provisions = calculateTotalLoanLossProvisions(bs.loanLossProvisions);
  const totalDeposits = calculateTotalMemberDeposits(bs.memberDeposits);
  const totalIncome = calculateTotalIncome(bs);
  const totalExpenses = calculateTotalExpenses(bs);
  const netSurplus = totalIncome - totalExpenses;
  const financialIncome = calculateTotalFinancialIncome(bs.financialIncome);
  const financialExpenses = calculateTotalFinancialExpenses(bs.financialExpenses);
  const operatingExpenses = calculateTotalOperatingExpenses(bs.operatingExpenses);

  // Average values (we'll assume these equal current values for simplicity)
  // In a real system, you'd average over 12 months
  const avgAssets = totalAssets || 1;
  const avgEquity = totalEquity || 1;
  const avgGrossLP = grossLP || 1;
  const avgDeposits = totalDeposits || 1;

  // Liquid assets
  const liquidAssets =
    bs.liquidAssets.cashOnHand +
    bs.liquidAssets.cashAtBankCurrent +
    bs.liquidAssets.cashAtBankSavings;
  const cash = bs.liquidAssets.cashOnHand + bs.liquidAssets.cashAtBankCurrent;
  const shortTermLiabilities =
    bs.borrowings.shortTermBorrowings + bs.otherLiabilities.accountsPayable;
  const arreas30Plus =
    bs.loanPortfolio.loansInArrears_31_60 +
    bs.loanPortfolio.loansInArrears_61_90 +
    bs.loanPortfolio.nonPerformingLoans;
  const arrears60Plus = bs.loanPortfolio.loansInArrears_61_90 + bs.loanPortfolio.nonPerformingLoans;
  const npl = bs.loanPortfolio.nonPerformingLoans;

  return {
    // Size & Market Structure
    totalAssets: {
      value: totalAssets,
      formatted: formatCurrency(totalAssets),
      unit: "currency",
      description: "Total value of all assets owned by the cooperative",
    },
    grossLoanPortfolio: {
      value: grossLP,
      formatted: formatCurrency(grossLP),
      unit: "currency",
      description: "Total outstanding loan balance including arrears",
    },
    netLoanPortfolio: {
      value: netLP,
      formatted: formatCurrency(netLP),
      unit: "currency",
      description: "Gross Loan Portfolio minus Loan Loss Provisions",
    },
    totalMemberDeposits: {
      value: totalDeposits,
      formatted: formatCurrency(totalDeposits),
      unit: "currency",
      description: "Total member savings and deposits",
    },
    totalEquity: {
      value: totalEquity,
      formatted: formatCurrency(totalEquity),
      unit: "currency",
      description: "Total institutional capital and reserves",
    },

    // Portfolio Quality
    par30: {
      value: grossLP > 0 ? (arreas30Plus / grossLP) * 100 : 0,
      formatted: formatPercent(grossLP > 0 ? (arreas30Plus / grossLP) * 100 : 0),
      unit: "percent",
      description: "Portfolio at Risk >30 days (loans in arrears >30 days / gross loan portfolio)",
      status: getStatusInverse(grossLP > 0 ? (arreas30Plus / grossLP) * 100 : 0, 5, 10),
      benchmark: 5,
    },
    par60: {
      value: grossLP > 0 ? (arrears60Plus / grossLP) * 100 : 0,
      formatted: formatPercent(grossLP > 0 ? (arrears60Plus / grossLP) * 100 : 0),
      unit: "percent",
      description: "Portfolio at Risk >60 days",
      status: getStatusInverse(grossLP > 0 ? (arrears60Plus / grossLP) * 100 : 0, 3, 5),
      benchmark: 3,
    },
    par90: {
      value: grossLP > 0 ? (npl / grossLP) * 100 : 0,
      formatted: formatPercent(grossLP > 0 ? (npl / grossLP) * 100 : 0),
      unit: "percent",
      description: "Portfolio at Risk >90 days (Non-Performing Loans ratio)",
      status: getStatusInverse(grossLP > 0 ? (npl / grossLP) * 100 : 0, 2, 5),
      benchmark: 2,
    },
    nplRatio: {
      value: grossLP > 0 ? (npl / grossLP) * 100 : 0,
      formatted: formatPercent(grossLP > 0 ? (npl / grossLP) * 100 : 0),
      unit: "percent",
      description: "Non-Performing Loans ( >90 days) as percentage of gross portfolio",
    },
    loanLossCoverage: {
      value: arreas30Plus > 0 ? (provisions / arreas30Plus) * 100 : 100,
      formatted: formatPercent(arreas30Plus > 0 ? (provisions / arreas30Plus) * 100 : 100),
      unit: "percent",
      description: "Loan loss provisions / Loans in arrears >30 days",
      status: getStatus(arreas30Plus > 0 ? (provisions / arreas30Plus) * 100 : 100, 100, 80),
      benchmark: 100,
    },

    // Profitability
    roa: {
      value: avgAssets > 0 ? (netSurplus / avgAssets) * 100 : 0,
      formatted: formatPercent(avgAssets > 0 ? (netSurplus / avgAssets) * 100 : 0),
      unit: "percent",
      description: "Return on Assets (Net Surplus / Average Total Assets)",
      status: getStatus(avgAssets > 0 ? (netSurplus / avgAssets) * 100 : 0, 3, 1),
      benchmark: 3,
    },
    roe: {
      value: avgEquity > 0 ? (netSurplus / avgEquity) * 100 : 0,
      formatted: formatPercent(avgEquity > 0 ? (netSurplus / avgEquity) * 100 : 0),
      unit: "percent",
      description: "Return on Equity (Net Surplus / Average Equity)",
      status: getStatus(avgEquity > 0 ? (netSurplus / avgEquity) * 100 : 0, 8, 4),
      benchmark: 8,
    },
    financialRevenueRatio: {
      value: avgAssets > 0 ? (financialIncome / avgAssets) * 100 : 0,
      formatted: formatPercent(avgAssets > 0 ? (financialIncome / avgAssets) * 100 : 0),
      unit: "percent",
      description: "Financial Income / Average Total Assets",
    },
    financialExpenseRatio: {
      value: avgAssets > 0 ? (financialExpenses / avgAssets) * 100 : 0,
      formatted: formatPercent(avgAssets > 0 ? (financialExpenses / avgAssets) * 100 : 0),
      unit: "percent",
      description: "Financial Expenses / Average Total Assets",
    },
    operatingExpenseRatio: {
      value: avgAssets > 0 ? (operatingExpenses / avgAssets) * 100 : 0,
      formatted: formatPercent(avgAssets > 0 ? (operatingExpenses / avgAssets) * 100 : 0),
      unit: "percent",
      description: "Operating Expenses / Average Total Assets",
      status: getStatusInverse(avgAssets > 0 ? (operatingExpenses / avgAssets) * 100 : 0, 5, 8),
      benchmark: 5,
    },
    costOfFunds: {
      value:
        avgDeposits > 0 ? (bs.financialExpenses.interestExpenseDeposits / avgDeposits) * 100 : 0,
      formatted: formatPercent(
        avgDeposits > 0 ? (bs.financialExpenses.interestExpenseDeposits / avgDeposits) * 100 : 0,
      ),
      unit: "percent",
      description: "Interest Expense on Deposits / Average Member Deposits",
    },
    yieldOnPortfolio: {
      value: avgGrossLP > 0 ? (bs.financialIncome.interestIncomeLoans / avgGrossLP) * 100 : 0,
      formatted: formatPercent(
        avgGrossLP > 0 ? (bs.financialIncome.interestIncomeLoans / avgGrossLP) * 100 : 0,
      ),
      unit: "percent",
      description: "Interest Income on Loans / Average Gross Loan Portfolio",
    },
    netInterestMargin: {
      value: avgAssets > 0 ? ((financialIncome - financialExpenses) / avgAssets) * 100 : 0,
      formatted: formatPercent(
        avgAssets > 0 ? ((financialIncome - financialExpenses) / avgAssets) * 100 : 0,
      ),
      unit: "percent",
      description: "(Financial Income - Financial Expenses) / Average Assets",
    },
    operationalSelfSufficiency: {
      value: totalExpenses > 0 ? (totalIncome / totalExpenses) * 100 : 0,
      formatted: formatPercent(totalExpenses > 0 ? (totalIncome / totalExpenses) * 100 : 0),
      unit: "percent",
      description: "Operating Income / Operating Expenses",
      status: getStatus(totalExpenses > 0 ? (totalIncome / totalExpenses) * 100 : 0, 110, 100),
      benchmark: 110,
    },

    // Liquidity & Solvency
    currentRatio: {
      value: shortTermLiabilities > 0 ? liquidAssets / shortTermLiabilities : liquidAssets,
      formatted:
        shortTermLiabilities > 0
          ? `${(liquidAssets / shortTermLiabilities).toFixed(2)}x`
          : `${liquidAssets.toFixed(0)} / 0`,
      unit: "ratio",
      description: "Liquid Assets / Short-term Liabilities",
      status: getStatus(
        shortTermLiabilities > 0 ? liquidAssets / shortTermLiabilities : 999,
        1,
        0.8,
      ),
      benchmark: 1,
    },
    cashRatio: {
      value: shortTermLiabilities > 0 ? cash / shortTermLiabilities : cash,
      formatted:
        shortTermLiabilities > 0
          ? `${(cash / shortTermLiabilities).toFixed(2)}x`
          : `${cash.toFixed(0)} / 0`,
      unit: "ratio",
      description: "Cash + Current Accounts / Short-term Liabilities",
      status: getStatus(shortTermLiabilities > 0 ? cash / shortTermLiabilities : 999, 0.5, 0.3),
      benchmark: 0.5,
    },
    capitalAdequacyRatio: {
      value: totalAssets > 0 ? (totalEquity / totalAssets) * 100 : 0,
      formatted: formatPercent(totalAssets > 0 ? (totalEquity / totalAssets) * 100 : 0),
      unit: "percent",
      description: "Total Equity / Total Assets",
      status: getStatus(totalAssets > 0 ? (totalEquity / totalAssets) * 100 : 0, 10, 8),
      benchmark: 10,
    },
    debtToEquity: {
      value: totalEquity > 0 ? totalLiabilities / totalEquity : totalLiabilities,
      formatted: totalEquity > 0 ? `${(totalLiabilities / totalEquity).toFixed(2)}x` : "∞",
      unit: "ratio",
      description: "Total Liabilities / Total Equity",
      status: getStatusInverse(totalEquity > 0 ? totalLiabilities / totalEquity : 999, 3, 5),
      benchmark: 3,
    },
    liquidFundsRatio: {
      value: totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0,
      formatted: formatPercent(totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0),
      unit: "percent",
      description: "Liquid Assets / Total Assets",
      status: getStatus(totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0, 15, 10),
      benchmark: 15,
    },
    depositsToLoans: {
      value: grossLP > 0 ? (totalDeposits / grossLP) * 100 : 0,
      formatted: formatPercent(grossLP > 0 ? (totalDeposits / grossLP) * 100 : 0),
      unit: "percent",
      description: "Total Deposits / Gross Loan Portfolio",
    },
    savingsToAssets: {
      value: totalAssets > 0 ? (totalDeposits / totalAssets) * 100 : 0,
      formatted: formatPercent(totalAssets > 0 ? (totalDeposits / totalAssets) * 100 : 0),
      unit: "percent",
      description: "Member Deposits / Total Assets",
    },
    voluntarySavingsRatio: {
      value: totalDeposits > 0 ? (bs.memberDeposits.voluntarySavings / totalDeposits) * 100 : 0,
      formatted: formatPercent(
        totalDeposits > 0 ? (bs.memberDeposits.voluntarySavings / totalDeposits) * 100 : 0,
      ),
      unit: "percent",
      description: "Voluntary Savings / Total Deposits",
    },
  };
}

// ============================================================================
// MEMBERSHIP KPI CALCULATIONS
// ============================================================================

export function calculateMembershipKPIs(
  members: MemberRecord[],
  previousPeriodCount?: number,
  newMembersCount?: number,
  exitedMembersCount?: number,
  boardMembers?: MemberRecord[],
): MembershipKPIs {
  const total = members.length;
  const active = members.filter((m) => m.status === "Active").length;
  const dormant = members.filter((m) => m.status === "Dormant").length;
  const exited = members.filter((m) => m.status === "Exited").length;
  const women = members.filter((m) => m.gender === "Female").length;
  const youth = members.filter((m) => m.ageGroup === "18-35").length;
  const rural = members.filter((m) => m.urbanRural === "Rural").length;
  const agmAttended = members.filter((m) => m.agmAttendance).length;

  const boardTotal = boardMembers?.length || 0;
  const boardWomen = boardMembers?.filter((m) => m.gender === "Female").length || 0;
  const boardYouth = boardMembers?.filter((m) => m.ageGroup === "18-35").length || 0;

  const growthRate =
    previousPeriodCount && previousPeriodCount > 0
      ? ((total - previousPeriodCount) / previousPeriodCount) * 100
      : 0;

  return {
    totalMembers: {
      value: total,
      formatted: formatNumber(total),
      unit: "number",
      description: "Total number of registered members",
    },
    membershipGrowthRate: {
      value: growthRate,
      formatted: `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`,
      unit: "percent",
      description: "(New members - Exited members) / Previous period total",
      status: getStatus(growthRate, 5, 0),
    },
    dormancyRate: {
      value: total > 0 ? (dormant / total) * 100 : 0,
      formatted: formatPercent(total > 0 ? (dormant / total) * 100 : 0),
      unit: "percent",
      description: "Dormant members / Total members",
      status: getStatusInverse(total > 0 ? (dormant / total) * 100 : 0, 20, 30),
      benchmark: 20,
    },
    exitRate: {
      value: total > 0 ? (exited / total) * 100 : 0,
      formatted: formatPercent(total > 0 ? (exited / total) * 100 : 0),
      unit: "percent",
      description: "Exited members / Total members",
      status: getStatusInverse(total > 0 ? (exited / total) * 100 : 0, 5, 10),
      benchmark: 5,
    },
    activeMembersRatio: {
      value: total > 0 ? (active / total) * 100 : 0,
      formatted: formatPercent(total > 0 ? (active / total) * 100 : 0),
      unit: "percent",
      description: "Active members / Total members",
      status: getStatus(total > 0 ? (active / total) * 100 : 0, 70, 60),
      benchmark: 70,
    },
    agmParticipationRate: {
      value: total > 0 ? (agmAttended / total) * 100 : 0,
      formatted: formatPercent(total > 0 ? (agmAttended / total) * 100 : 0),
      unit: "percent",
      description: "Members attending AGM / Total members",
      status: getStatus(total > 0 ? (agmAttended / total) * 100 : 0, 50, 30),
      benchmark: 50,
    },
    womenMembersPercent: {
      value: total > 0 ? (women / total) * 100 : 0,
      formatted: formatPercent(total > 0 ? (women / total) * 100 : 0),
      unit: "percent",
      description: "Female members / Total members",
    },
    youthMembersPercent: {
      value: total > 0 ? (youth / total) * 100 : 0,
      formatted: formatPercent(total > 0 ? (youth / total) * 100 : 0),
      unit: "percent",
      description: "Youth members (<35) / Total members",
    },
    ruralMembersPercent: {
      value: total > 0 ? (rural / total) * 100 : 0,
      formatted: formatPercent(total > 0 ? (rural / total) * 100 : 0),
      unit: "percent",
      description: "Rural members / Total members",
    },
    womenInGovernancePercent: {
      value: boardTotal > 0 ? (boardWomen / boardTotal) * 100 : 0,
      formatted: formatPercent(boardTotal > 0 ? (boardWomen / boardTotal) * 100 : 0),
      unit: "percent",
      description: "Women in governance positions / Total board members",
    },
    youthInGovernancePercent: {
      value: boardTotal > 0 ? (boardYouth / boardTotal) * 100 : 0,
      formatted: formatPercent(boardTotal > 0 ? (boardYouth / boardTotal) * 100 : 0),
      unit: "percent",
      description: "Youth in governance positions / Total board members",
    },
  };
}

// ============================================================================
// SAVINGS KPI CALCULATIONS
// ============================================================================

export function calculateSavingsKPIs(
  savingsAccounts: SavingsAccount[],
  totalMembers: number,
): SavingsKPIs {
  const totalAccounts = savingsAccounts.length;
  const activeAccounts = savingsAccounts.filter((s) => s.accountStatus === "Active").length;
  const dormantAccounts = savingsAccounts.filter((s) => s.accountStatus === "Dormant").length;
  const zeroBalance = savingsAccounts.filter((s) => s.zeroBalanceFlag).length;
  const stableBalance = savingsAccounts.filter(
    (s) => s.balanceTrend === "Stable" || s.balanceTrend === "Increasing",
  ).length;
  const highWithdrawal = savingsAccounts.filter(
    (s) => s.withdrawalFrequencyCategory === "High",
  ).length;
  const emergencyWithdrawals = savingsAccounts.filter((s) => s.emergencyWithdrawalsFlag).length;
  const regularContributors = savingsAccounts.filter(
    (s) => s.contributionFrequency === "Monthly" || s.contributionFrequency === "Weekly",
  ).length;

  const avgInterest =
    savingsAccounts.reduce((sum, s) => sum + s.interestRate, 0) / (totalAccounts || 1);
  const totalBalance = savingsAccounts.reduce((sum, s) => sum + s.balance, 0);
  const top10Balance = savingsAccounts
    .sort((a, b) => b.balance - a.balance)
    .slice(0, Math.ceil(totalAccounts * 0.1))
    .reduce((sum, s) => sum + s.balance, 0);

  return {
    savingsPenetration: {
      value: totalMembers > 0 ? (totalAccounts / totalMembers) * 100 : 0,
      formatted: formatPercent(totalMembers > 0 ? (totalAccounts / totalMembers) * 100 : 0),
      unit: "percent",
      description: "Members with savings accounts / Total members",
      status: getStatus(totalMembers > 0 ? (totalAccounts / totalMembers) * 100 : 0, 70, 50),
      benchmark: 70,
    },
    activeSaversRatio: {
      value: totalAccounts > 0 ? (activeAccounts / totalAccounts) * 100 : 0,
      formatted: formatPercent(totalAccounts > 0 ? (activeAccounts / totalAccounts) * 100 : 0),
      unit: "percent",
      description: "Active savings accounts / Total savings accounts",
    },
    regularSaversRatio: {
      value: totalAccounts > 0 ? (regularContributors / totalAccounts) * 100 : 0,
      formatted: formatPercent(totalAccounts > 0 ? (regularContributors / totalAccounts) * 100 : 0),
      unit: "percent",
      description: "Accounts with regular contributions / Total accounts",
      status: getStatus(
        totalAccounts > 0 ? (regularContributors / totalAccounts) * 100 : 0,
        60,
        40,
      ),
      benchmark: 60,
    },
    dormantSavingsAccountsPercent: {
      value: totalAccounts > 0 ? (dormantAccounts / totalAccounts) * 100 : 0,
      formatted: formatPercent(totalAccounts > 0 ? (dormantAccounts / totalAccounts) * 100 : 0),
      unit: "percent",
      description: "Dormant savings accounts / Total savings accounts",
      status: getStatusInverse(
        totalAccounts > 0 ? (dormantAccounts / totalAccounts) * 100 : 0,
        20,
        30,
      ),
      benchmark: 20,
    },
    zeroBalanceAccountsPercent: {
      value: totalAccounts > 0 ? (zeroBalance / totalAccounts) * 100 : 0,
      formatted: formatPercent(totalAccounts > 0 ? (zeroBalance / totalAccounts) * 100 : 0),
      unit: "percent",
      description: "Zero-balance accounts / Total savings accounts",
    },
    stableBalanceRatio: {
      value: activeAccounts > 0 ? (stableBalance / activeAccounts) * 100 : 0,
      formatted: formatPercent(activeAccounts > 0 ? (stableBalance / activeAccounts) * 100 : 0),
      unit: "percent",
      description: "Accounts with stable/increasing balance / Active accounts",
    },
    highWithdrawalFrequencyPercent: {
      value: totalAccounts > 0 ? (highWithdrawal / totalAccounts) * 100 : 0,
      formatted: formatPercent(totalAccounts > 0 ? (highWithdrawal / totalAccounts) * 100 : 0),
      unit: "percent",
      description: "Accounts with high withdrawal frequency / Total accounts",
    },
    emergencyWithdrawalIncidence: {
      value: totalAccounts > 0 ? (emergencyWithdrawals / totalAccounts) * 100 : 0,
      formatted: formatPercent(
        totalAccounts > 0 ? (emergencyWithdrawals / totalAccounts) * 100 : 0,
      ),
      unit: "percent",
      description: "Accounts with emergency withdrawals / Total accounts",
    },
    averageInterestRate: {
      value: avgInterest,
      formatted: `${avgInterest.toFixed(2)}%`,
      unit: "percent",
      description: "Average interest rate on savings",
    },
    accountConcentration: {
      value: totalBalance > 0 ? (top10Balance / totalBalance) * 100 : 0,
      formatted: formatPercent(totalBalance > 0 ? (top10Balance / totalBalance) * 100 : 0),
      unit: "percent",
      description: "Top 10% accounts balance / Total savings balance",
    },
  };
}

// ============================================================================
// LOAN KPI CALCULATIONS
// ============================================================================

export function calculateLoanKPIs(
  loans: LoanRecord[],
  totalMembers: number,
  grossLoanPortfolio: number,
): LoanKPIs {
  const totalLoans = loans.length;
  const activeLoans = loans.filter(
    (l) => l.loanStatus === "Performing" || l.loanStatus === "Arrears",
  ).length;
  const performingLoans = loans.filter((l) => l.loanStatus === "Performing").length;
  const regularRepayment = loans.filter((l) => l.repaymentRegularity === "Regular").length;
  const arrearsLoans = loans.filter((l) => l.daysPastDueCategory !== "0").length;
  const restructured = loans.filter((l) => l.restructuredLoanFlag).length;
  const women = loans.filter((l) => l.womenBorrowerFlag).length;
  const youth = loans.filter((l) => l.youthBorrowerFlag).length;
  const rural = loans.filter((l) => l.ruralBorrowerFlag).length;
  const multipleLoans = loans.filter((l) => l.multipleLoansFlag).length;

  const avgLoanSize = totalLoans > 0 ? grossLoanPortfolio / totalLoans : 0;
  const avgInterest = loans.reduce((sum, l) => sum + l.interestRate, 0) / (totalLoans || 1);

  return {
    creditPenetration: {
      value: totalMembers > 0 ? (totalLoans / totalMembers) * 100 : 0,
      formatted: formatPercent(totalMembers > 0 ? (totalLoans / totalMembers) * 100 : 0),
      unit: "percent",
      description: "Members with active loans / Total members",
    },
    onTimeRepaymentRatio: {
      value: totalLoans > 0 ? (performingLoans / totalLoans) * 100 : 0,
      formatted: formatPercent(totalLoans > 0 ? (performingLoans / totalLoans) * 100 : 0),
      unit: "percent",
      description: "Performing loans / Active loans",
      status: getStatus(totalLoans > 0 ? (performingLoans / totalLoans) * 100 : 0, 75, 60),
      benchmark: 75,
    },
    loansInArrearsPercent: {
      value: totalLoans > 0 ? (arrearsLoans / totalLoans) * 100 : 0,
      formatted: formatPercent(totalLoans > 0 ? (arrearsLoans / totalLoans) * 100 : 0),
      unit: "percent",
      description: "Loans in arrears / Active loans",
      status: getStatusInverse(totalLoans > 0 ? (arrearsLoans / totalLoans) * 100 : 0, 20, 30),
      benchmark: 20,
    },
    restructuredLoansRatio: {
      value: totalLoans > 0 ? (restructured / totalLoans) * 100 : 0,
      formatted: formatPercent(totalLoans > 0 ? (restructured / totalLoans) * 100 : 0),
      unit: "percent",
      description: "Restructured loans / Active loans",
      status: getStatusInverse(totalLoans > 0 ? (restructured / totalLoans) * 100 : 0, 10, 15),
      benchmark: 10,
    },
    womenBorrowersPercent: {
      value: totalLoans > 0 ? (women / totalLoans) * 100 : 0,
      formatted: formatPercent(totalLoans > 0 ? (women / totalLoans) * 100 : 0),
      unit: "percent",
      description: "Loans to women / Total loans",
    },
    youthBorrowersPercent: {
      value: totalLoans > 0 ? (youth / totalLoans) * 100 : 0,
      formatted: formatPercent(totalLoans > 0 ? (youth / totalLoans) * 100 : 0),
      unit: "percent",
      description: "Loans to youth (<35) / Total loans",
    },
    ruralBorrowersPercent: {
      value: totalLoans > 0 ? (rural / totalLoans) * 100 : 0,
      formatted: formatPercent(totalLoans > 0 ? (rural / totalLoans) * 100 : 0),
      unit: "percent",
      description: "Loans to rural members / Total loans",
    },
    averageLoanSize: {
      value: avgLoanSize,
      formatted: formatCurrency(avgLoanSize),
      unit: "currency",
      description: "Average loan amount per borrower",
    },
    loansPerMember: {
      value: totalMembers > 0 ? totalLoans / totalMembers : 0,
      formatted: totalMembers > 0 ? (totalLoans / totalMembers).toFixed(2) : "0",
      unit: "ratio",
      description: "Total loans / Total members",
    },
    averageInterestRate: {
      value: avgInterest,
      formatted: `${avgInterest.toFixed(2)}%`,
      unit: "percent",
      description: "Average interest rate on loans",
    },
  };
}

// ============================================================================
// FIXED DEPOSIT KPI CALCULATIONS
// ============================================================================

export function calculateFixedDepositKPIs(
  fds: FixedDepositRecord[],
  totalMembers: number,
): FixedDepositKPIs {
  const totalFDs = fds.length;
  const longTermFDs = fds.filter(
    (f) => f.tenureCategory === "1-3y" || f.tenureCategory === ">3y",
  ).length;
  const maturedThisPeriod = fds.filter((f) => f.status === "Matured").length;
  const rolledOver = fds.filter((f) => f.rolloverAtMaturityFlag).length;
  const earlyWithdrawals = fds.filter((f) => f.earlyWithdrawalFlag).length;
  const largeDepositors = fds.filter((f) => f.singleDepositorDependencyFlag).length;

  const rolloverRate = maturedThisPeriod > 0 ? (rolledOver / maturedThisPeriod) * 100 : 0;

  return {
    fdPenetration: {
      value: totalMembers > 0 ? (totalFDs / totalMembers) * 100 : 0,
      formatted: formatPercent(totalMembers > 0 ? (totalFDs / totalMembers) * 100 : 0),
      unit: "percent",
      description: "Members with fixed deposits / Total members",
      status: getStatus(totalMembers > 0 ? (totalFDs / totalMembers) * 100 : 0, 20, 10),
      benchmark: 20,
    },
    longTermFdRatio: {
      value: totalFDs > 0 ? (longTermFDs / totalFDs) * 100 : 0,
      formatted: formatPercent(totalFDs > 0 ? (longTermFDs / totalFDs) * 100 : 0),
      unit: "percent",
      description: "Long-term FDs (>1 year) / Total FDs",
    },
    fdRolloverRate: {
      value: rolloverRate,
      formatted: formatPercent(rolloverRate),
      unit: "percent",
      description: "FDs rolled over / FDs matured",
      status: getStatus(rolloverRate, 60, 40),
      benchmark: 60,
    },
    earlyWithdrawalRate: {
      value: totalFDs > 0 ? (earlyWithdrawals / totalFDs) * 100 : 0,
      formatted: formatPercent(totalFDs > 0 ? (earlyWithdrawals / totalFDs) * 100 : 0),
      unit: "percent",
      description: "FDs withdrawn early / Total FDs",
      status: getStatusInverse(totalFDs > 0 ? (earlyWithdrawals / totalFDs) * 100 : 0, 15, 25),
      benchmark: 15,
    },
    concentrationRisk: {
      value: totalFDs > 0 ? (largeDepositors / totalFDs) * 100 : 0,
      formatted: formatPercent(totalFDs > 0 ? (largeDepositors / totalFDs) * 100 : 0),
      unit: "percent",
      description: "Large depositor accounts / Total FDs",
    },
  };
}

// ============================================================================
// COMPLIANCE SCORE CALCULATION
// ============================================================================

export interface ComplianceScoreComponents {
  timelySubmission: number; // 0-100
  dataQuality: number; // 0-100
  financialRatios: number; // 0-100
  documentation: number; // 0-100
}

export interface ComplianceScoreResult {
  overall: number; // 0-100
  status: "green" | "amber" | "red";
  components: ComplianceScoreComponents;
  summary: string;
}

export function calculateComplianceScore(
  components: ComplianceScoreComponents,
  weights = { timelySubmission: 0.3, dataQuality: 0.25, financialRatios: 0.25, documentation: 0.2 },
): ComplianceScoreResult {
  const overall =
    components.timelySubmission * weights.timelySubmission +
    components.dataQuality * weights.dataQuality +
    components.financialRatios * weights.financialRatios +
    components.documentation * weights.documentation;

  const status: "green" | "amber" | "red" =
    overall >= 95 ? "green" : overall >= 85 ? "amber" : "red";

  let summary = "";
  if (status === "green") {
    summary = "Cooperative is in good standing with all compliance requirements met.";
  } else if (status === "amber") {
    summary = "Cooperative needs attention in some areas. Review the detailed scores.";
  } else {
    summary = "Cooperative is non-compliant. Immediate action required.";
  }

  return {
    overall: Math.round(overall * 10) / 10,
    status,
    components,
    summary,
  };
}

// ============================================================================
// BENCHMARKING FUNCTIONS
// ============================================================================

export interface BenchmarkComparison {
  indicator: string;
  cooperativeValue: number;
  regionalAverage: number;
  sectorAverage: number;
  nationalAverage: number;
  percentile: number; // What percentile the cooperative falls in
  status: "above" | "at" | "below";
}

export function compareToBenchmarks(
  indicator: string,
  value: number,
  benchmarks: { regional: number; sector: number; national: number },
): BenchmarkComparison {
  const avg = (benchmarks.regional + benchmarks.sector + benchmarks.national) / 3;
  const percentile =
    value >= avg
      ? Math.min(75 + ((value - avg) / avg) * 25, 99)
      : Math.max(25 - ((avg - value) / avg) * 25, 1);
  const status: "above" | "at" | "below" =
    value >= benchmarks.national ? "above" : value >= benchmarks.national * 0.9 ? "at" : "below";

  return {
    indicator,
    cooperativeValue: value,
    regionalAverage: benchmarks.regional,
    sectorAverage: benchmarks.sector,
    nationalAverage: benchmarks.national,
    percentile: Math.round(percentile),
    status,
  };
}
