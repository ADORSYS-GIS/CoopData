import { describe, it, expect } from "vitest";
import {
  calculateFinancialKPIs,
  calculateMembershipKPIs,
  calculateSavingsKPIs,
  calculateLoanKPIs,
  calculateFixedDepositKPIs,
} from "./kpi-calculations";
import {
  type BalanceSheet,
  type MemberRecord,
  type SavingsAccount,
  type LoanRecord,
  type FixedDepositRecord,
} from "./financial-data";
import { createEmptyBalanceSheet } from "./financial-data";

function createMinimalBalanceSheet(): BalanceSheet {
  return {
    reportingPeriod: "2024-12",
    cooperativeId: "coop-001",
    cooperativeName: "Test Cooperative",
    submissionDate: "2024-12-31",
    currency: "USD",
    accountingYear: "calendar",
    liquidAssets: {
      cashOnHand: 1000,
      cashAtBankCurrent: 5000,
      cashAtBankSavings: 10000,
      shortTermInvestments: 2000,
    },
    loanPortfolio: {
      performingLoanPortfolio: 50000,
      loansInArrears_1_30: 2000,
      loansInArrears_31_60: 1000,
      loansInArrears_61_90: 500,
      nonPerformingLoans: 500,
    },
    loanLossProvisions: {
      generalLoanLossProvision: 500,
      specificLoanLossProvision: 300,
    },
    otherAssets: {
      accountsReceivable: 1000,
      prepaidExpenses: 500,
      fixedAssetsCost: 20000,
      accumulatedDepreciation: 5000,
      intangibleAssets: 1000,
    },
    memberDeposits: {
      voluntarySavings: 30000,
      mandatorySavings: 10000,
      fixedTermDeposits: 5000,
    },
    borrowings: {
      shortTermBorrowings: 5000,
      longTermBorrowings: 10000,
    },
    otherLiabilities: {
      accountsPayable: 2000,
      accruedExpenses: 1000,
      deferredIncome: 500,
    },
    memberShares: {
      permanentShareCapital: 10000,
      withdrawableShares: 5000,
    },
    reserves: {
      statutoryReserve: 5000,
      generalReserve: 3000,
      riskCapitalAdequacyReserve: 2000,
    },
    retainedEarnings: {
      accumulatedSurplus: 10000,
      currentYearSurplus: 5000,
    },
    financialIncome: {
      interestIncomeLoans: 10000,
      feesCommissionsIncome: 2000,
    },
    otherIncome: {
      otherOperatingIncome: 1000,
    },
    financialExpenses: {
      interestExpenseDeposits: 3000,
      interestExpenseBorrowings: 1000,
    },
    operatingExpenses: {
      personnelCosts: 5000,
      administrativeExpenses: 2000,
      governanceExpenses: 500,
      depreciationAmortization: 1000,
    },
    creditLossExpense: 500,
  };
}

describe("calculateFinancialKPIs", () => {
  it("calculates total assets", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.totalAssets.value).toBeGreaterThan(0);
    expect(kpis.totalAssets.unit).toBe("currency");
  });

  it("calculates gross loan portfolio", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.grossLoanPortfolio.value).toBe(54000);
  });

  it("calculates net loan portfolio (gross - provisions)", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.netLoanPortfolio.value).toBe(53200);
  });

  it("calculates PAR30 correctly", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    const expectedPAR30 = ((1000 + 500 + 500) / 54000) * 100;
    expect(kpis.par30.value).toBeCloseTo(expectedPAR30, 2);
  });

  it("calculates PAR60 correctly", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    const expectedPAR60 = ((500 + 500) / 54000) * 100;
    expect(kpis.par60.value).toBeCloseTo(expectedPAR60, 2);
  });

  it("calculates PAR90 (NPL) correctly", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    const expectedPAR90 = (500 / 54000) * 100;
    expect(kpis.par90.value).toBeCloseTo(expectedPAR90, 2);
  });

  it("returns PAR30 = 0 when gross LP is 0", () => {
    const bs = createEmptyBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.par30.value).toBe(0);
  });

  it("calculates ROA (Return on Assets)", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.roa.value).toBeDefined();
    expect(kpis.roa.unit).toBe("percent");
  });

  it("calculates ROE (Return on Equity)", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.roe.value).toBeDefined();
    expect(kpis.roe.unit).toBe("percent");
  });

  it("calculates loan loss coverage", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.loanLossCoverage.value).toBeGreaterThan(0);
  });

  it("returns 100% loan loss coverage when arrears are 0", () => {
    const bs = createMinimalBalanceSheet();
    bs.loanPortfolio.loansInArrears_31_60 = 0;
    bs.loanPortfolio.loansInArrears_61_90 = 0;
    bs.loanPortfolio.nonPerformingLoans = 0;
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.loanLossCoverage.value).toBe(100);
  });

  it("calculates current ratio", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.currentRatio.value).toBeGreaterThan(0);
    expect(kpis.currentRatio.unit).toBe("ratio");
  });

  it("calculates capital adequacy ratio", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.capitalAdequacyRatio.value).toBeGreaterThan(0);
    expect(kpis.capitalAdequacyRatio.unit).toBe("percent");
  });

  it("calculates deposits to loans ratio", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.depositsToLoans.value).toBeGreaterThan(0);
  });

  it("calculates savings to assets ratio", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.savingsToAssets.value).toBeGreaterThan(0);
  });

  it("calculates operational self sufficiency", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.operationalSelfSufficiency.value).toBeGreaterThan(0);
  });

  it("returns PAR30 status 'green' when below benchmark", () => {
    const bs = createMinimalBalanceSheet();
    bs.loanPortfolio.loansInArrears_31_60 = 100;
    bs.loanPortfolio.loansInArrears_61_90 = 100;
    bs.loanPortfolio.nonPerformingLoans = 100;
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.par30.status).toBe("green");
  });

  it("returns PAR30 status 'red' when above warning threshold", () => {
    const bs = createMinimalBalanceSheet();
    bs.loanPortfolio.loansInArrears_31_60 = 10000;
    bs.loanPortfolio.loansInArrears_61_90 = 10000;
    bs.loanPortfolio.nonPerformingLoans = 10000;
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.par30.status).toBe("red");
  });

  it("formats currency values correctly", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.totalAssets.formatted).toMatch(/\$/);
  });

  it("formats percent values with % symbol", () => {
    const bs = createMinimalBalanceSheet();
    const kpis = calculateFinancialKPIs(bs);
    expect(kpis.par30.formatted).toMatch(/%/);
  });
});

describe("calculateMembershipKPIs", () => {
  const createMembers = (count: number, overrides: Partial<MemberRecord> = {}): MemberRecord[] => {
    return Array.from({ length: count }, (_, i) => ({
      memberId: `member-${i}`,
      joinDate: "2020-01-01",
      status: "Active" as const,
      exitDate: undefined,
      gender: i % 2 === 0 ? ("Female" as const) : ("Male" as const),
      ageGroup: i % 3 === 0 ? ("18-35" as const) : ("36-50" as const),
      region: "Shiselweni",
      urbanRural: "Rural" as const,
      agmAttendance: i % 2 === 0,
      leadershipRole: i === 0 ? "Chairperson" : undefined,
      votingExercised: true,
      shareBalance: 100,
      ...overrides,
    }));
  };

  it("calculates total members", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.totalMembers.value).toBe(10);
  });

  it("calculates women percentage", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.womenMembersPercent.value).toBe(50);
  });

  it("calculates youth percentage", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.youthMembersPercent.value).toBe(40);
  });

  it("calculates rural percentage", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.ruralMembersPercent.value).toBe(100);
  });

  it("calculates active members ratio", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.activeMembersRatio.value).toBe(100);
  });

  it("calculates dormancy rate", () => {
    const members = createMembers(10, { status: "Dormant" });
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.dormancyRate.value).toBe(100);
  });

  it("calculates exit rate", () => {
    const members = createMembers(10, { status: "Exited" });
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.exitRate.value).toBe(100);
  });

  it("calculates AGM participation rate", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.agmParticipationRate.value).toBe(50);
  });

  it("calculates membership growth rate", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members, 8);
    expect(kpis.membershipGrowthRate.value).toBe(25);
  });

  it("returns 0 growth rate when no previous period", () => {
    const members = createMembers(10);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.membershipGrowthRate.value).toBe(0);
  });

  it("calculates women in governance percentage", () => {
    const members = createMembers(10);
    const boardMembers = createMembers(4, { leadershipRole: "Board Member" });
    const kpis = calculateMembershipKPIs(members, undefined, undefined, undefined, boardMembers);
    expect(kpis.womenInGovernancePercent.value).toBe(50);
  });

  it("handles empty members array", () => {
    const members: MemberRecord[] = [];
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.totalMembers.value).toBe(0);
    expect(kpis.womenMembersPercent.value).toBe(0);
  });

  it("formats total members as number", () => {
    const members = createMembers(1000);
    const kpis = calculateMembershipKPIs(members);
    expect(kpis.totalMembers.unit).toBe("number");
  });
});

describe("calculateSavingsKPIs", () => {
  const createSavingsAccounts = (
    count: number,
    overrides: Partial<SavingsAccount> = {},
  ): SavingsAccount[] => {
    return Array.from({ length: count }, (_, i) => ({
      savingsAccountId: `savings-${i}`,
      memberId: `member-${i}`,
      accountType: "Voluntary" as const,
      accountOpeningDate: "2020-01-01",
      accountStatus: "Active" as const,
      contributionFrequency: "Monthly" as const,
      lastContributionDate: "2024-12-01",
      numberOfContributions: 12,
      balanceTrend: "Increasing" as const,
      zeroBalanceFlag: false,
      withdrawalFrequencyCategory: "Low" as const,
      emergencyWithdrawalsFlag: false,
      interestRate: 5,
      balance: 1000,
      ...overrides,
    }));
  };

  it("calculates savings penetration", () => {
    const accounts = createSavingsAccounts(10);
    const kpis = calculateSavingsKPIs(accounts, 100);
    expect(kpis.savingsPenetration.value).toBe(10);
  });

  it("calculates active savers ratio", () => {
    const accounts = createSavingsAccounts(10);
    const kpis = calculateSavingsKPIs(accounts, 10);
    expect(kpis.activeSaversRatio.value).toBe(100);
  });

  it("calculates dormant savings percentage", () => {
    const accounts = createSavingsAccounts(10, { accountStatus: "Dormant" });
    const kpis = calculateSavingsKPIs(accounts, 10);
    expect(kpis.dormantSavingsAccountsPercent.value).toBe(100);
  });

  it("calculates zero balance percentage", () => {
    const accounts = createSavingsAccounts(10, { zeroBalanceFlag: true });
    const kpis = calculateSavingsKPIs(accounts, 10);
    expect(kpis.zeroBalanceAccountsPercent.value).toBe(100);
  });

  it("handles empty accounts array", () => {
    const accounts: SavingsAccount[] = [];
    const kpis = calculateSavingsKPIs(accounts, 0);
    expect(kpis.savingsPenetration.value).toBe(0);
    expect(kpis.activeSaversRatio.value).toBe(0);
  });
});

describe("calculateLoanKPIs", () => {
  const createLoans = (count: number, overrides: Partial<LoanRecord> = {}): LoanRecord[] => {
    return Array.from({ length: count }, (_, i) => ({
      loanId: `loan-${i}`,
      memberId: `member-${i}`,
      loanProductType: "Standard",
      loanStartDate: "2024-01-01",
      loanMaturityDate: "2024-12-31",
      loanStatus: "Performing" as const,
      borrowerType: "Individual",
      youthBorrowerFlag: i % 3 === 0,
      womenBorrowerFlag: i % 2 === 0,
      ruralBorrowerFlag: i % 2 === 0,
      repaymentRegularity: "Regular" as const,
      daysPastDueCategory: "0" as const,
      missedInstallmentsCount: 0,
      restructuredLoanFlag: false,
      numberOfRestructurings: 0,
      earlySettlementFlag: false,
      multipleLoansFlag: false,
      largeBorrowerFlag: false,
      interestRate: 12,
      balance: 5000,
      loanAmount: 5000,
      ...overrides,
    }));
  };

  it("calculates credit penetration", () => {
    const loans = createLoans(10);
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.creditPenetration.value).toBe(10);
  });

  it("calculates on-time repayment ratio", () => {
    const loans = createLoans(10);
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.onTimeRepaymentRatio.value).toBe(100);
  });

  it("calculates loans in arrears percentage", () => {
    const loans = createLoans(10, { daysPastDueCategory: "31-60" });
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.loansInArrearsPercent.value).toBe(100);
  });

  it("calculates women borrowers percentage", () => {
    const loans = createLoans(10);
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.womenBorrowersPercent.value).toBe(50);
  });

  it("calculates youth borrowers percentage", () => {
    const loans = createLoans(10);
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.youthBorrowersPercent.value).toBe(40);
  });

  it("calculates rural borrowers percentage", () => {
    const loans = createLoans(10);
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.ruralBorrowersPercent.value).toBe(50);
  });

  it("calculates average loan size", () => {
    const loans = createLoans(10, { balance: 5000 });
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.averageLoanSize.value).toBe(5000);
  });

  it("calculates loans per member", () => {
    const loans = createLoans(10);
    const kpis = calculateLoanKPIs(loans, 5, 50000);
    expect(kpis.loansPerMember.value).toBe(2);
  });

  it("handles empty loans array", () => {
    const loans: LoanRecord[] = [];
    const kpis = calculateLoanKPIs(loans, 100, 50000);
    expect(kpis.creditPenetration.value).toBe(0);
    expect(kpis.averageLoanSize.value).toBe(0);
  });
});

describe("calculateFixedDepositKPIs", () => {
  const createFixedDeposits = (
    count: number,
    overrides: Partial<FixedDepositRecord> = {},
  ): FixedDepositRecord[] => {
    return Array.from({ length: count }, (_, i) => ({
      fixedDepositId: `fd-${i}`,
      memberId: `member-${i}`,
      depositType: "Medium-term" as const,
      startDate: "2024-01-01",
      maturityDate: "2024-12-31",
      status: "Active" as const,
      tenureCategory: "3-6m" as const,
      originalTenureSelected: "6 months",
      earlyWithdrawalFlag: false,
      rolloverAtMaturityFlag: false,
      numberOfRenewals: 0,
      changeInTenureAtRenewal: false,
      singleDepositorDependencyFlag: false,
      interestRate: 8,
      balance: 10000,
      ...overrides,
    }));
  };

  it("calculates FD penetration", () => {
    const deposits = createFixedDeposits(10);
    const kpis = calculateFixedDepositKPIs(deposits, 100);
    expect(kpis.fdPenetration.value).toBe(10);
  });

  it("calculates long-term FD ratio", () => {
    const deposits = createFixedDeposits(10, { tenureCategory: "1-3y" });
    const kpis = calculateFixedDepositKPIs(deposits, 100);
    expect(kpis.longTermFdRatio.value).toBe(100);
  });

  it("calculates early withdrawal rate", () => {
    const deposits = createFixedDeposits(10, { earlyWithdrawalFlag: true });
    const kpis = calculateFixedDepositKPIs(deposits, 100);
    expect(kpis.earlyWithdrawalRate.value).toBe(100);
  });

  it("calculates FD rollover rate", () => {
    const deposits = createFixedDeposits(10, { rolloverAtMaturityFlag: true, status: "Matured" });
    const kpis = calculateFixedDepositKPIs(deposits, 100);
    expect(kpis.fdRolloverRate.value).toBe(100);
  });

  it("handles empty deposits array", () => {
    const deposits: FixedDepositRecord[] = [];
    const kpis = calculateFixedDepositKPIs(deposits, 100);
    expect(kpis.fdPenetration.value).toBe(0);
    expect(kpis.longTermFdRatio.value).toBe(0);
  });
});
