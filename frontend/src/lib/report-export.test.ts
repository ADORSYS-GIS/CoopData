import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  downloadCSV,
  formatCurrency,
  formatNumber,
  formatPercent,
  generateBalanceSheetCSV,
  generateCSV,
  generatePDFContent,
} from "./report-export";
import type { BalanceSheet } from "./financial-data";
import type { FinancialKPIs, LoanKPIs, MembershipKPIs } from "./kpi-calculations";
import type { ReportData } from "./report-export";

// ============================================================================
// Fixtures
// ============================================================================

import type { KPIResult } from "./kpi-calculations";

function kpi(
  value: number,
  formatted: string,
  unit = "%",
  status?: KPIResult["status"],
  benchmark?: number,
): KPIResult {
  return { value, formatted, unit, description: formatted, status, benchmark };
}

function makeBalanceSheet(overrides: Partial<BalanceSheet> = {}): BalanceSheet {
  return {
    reportingPeriod: "2026-08",
    cooperativeId: "coop-1",
    cooperativeName: "Test Coop",
    submissionDate: "2026-09-01",
    liquidAssets: {
      cashOnHand: 100,
      cashAtBankCurrent: 200,
      cashAtBankSavings: 0,
      shortTermInvestments: 0,
    },
    loanPortfolio: {
      performingLoanPortfolio: 1000,
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
      accountsReceivable: 10,
      prepaidExpenses: 0,
      fixedAssetsCost: 0,
      accumulatedDepreciation: 0,
      intangibleAssets: 0,
    },
    memberDeposits: {
      voluntarySavings: 500,
      mandatorySavings: 0,
      fixedTermDeposits: 0,
    },
    borrowings: { shortTermBorrowings: 0, longTermBorrowings: 0 },
    otherLiabilities: { accountsPayable: 0, accruedExpenses: 0, deferredIncome: 0 },
    memberShares: { permanentShareCapital: 400, withdrawableShares: 0 },
    reserves: { statutoryReserve: 0, generalReserve: 0, riskCapitalAdequacyReserve: 0 },
    retainedEarnings: { accumulatedSurplus: 0, currentYearSurplus: 0 },
    financialIncome: { interestIncomeLoans: 0, feesCommissionsIncome: 0 },
    otherIncome: { otherOperatingIncome: 0 },
    financialExpenses: { interestExpenseDeposits: 0, interestExpenseBorrowings: 0 },
    operatingExpenses: {
      personnelCosts: 0,
      administrativeExpenses: 0,
      governanceExpenses: 0,
      depreciationAmortization: 0,
    },
    creditLossExpense: 0,
    currency: "USD",
    accountingYear: "calendar",
    ...overrides,
  };
}

function makeFinancialKPIs(): FinancialKPIs {
  return {
    totalAssets: kpi(10000, "$10K", "USD", "green", 0),
    grossLoanPortfolio: kpi(6000, "$6K", "USD", "green", 0),
    netLoanPortfolio: kpi(5900, "$5.9K", "USD", "green", 0),
    totalMemberDeposits: kpi(500, "$500", "USD", "green", 0),
    totalEquity: kpi(4000, "$4K", "USD", "green", 0),
    par30: kpi(4.0, "4.0%", "%", "green", 5),
    par60: kpi(2.0, "2.0%", "%", "green", 3),
    par90: kpi(1.0, "1.0%", "%", "green", 2),
    nplRatio: kpi(1.0, "1.0%", "%", "green", 5),
    loanLossCoverage: kpi(150, "150.0%", "%", "green", 100),
    roa: kpi(4, "4.0%", "%", "green", 3),
    roe: kpi(10, "10.0%", "%", "green", 8),
    financialRevenueRatio: kpi(80, "80.0%", "%"),
    financialExpenseRatio: kpi(10, "10.0%", "%"),
    operatingExpenseRatio: kpi(30, "30.0%", "%", "green", 5),
    costOfFunds: kpi(5, "5.0%", "%"),
    yieldOnPortfolio: kpi(12, "12.0%", "%"),
    netInterestMargin: kpi(7, "7.0%", "%"),
    operationalSelfSufficiency: kpi(120, "120.0%", "%"),
    currentRatio: kpi(1.5, "1.50x", "x", "green", 1),
    cashRatio: kpi(0.3, "0.30x", "x"),
    capitalAdequacyRatio: kpi(40, "40.0%", "%", "green", 10),
    debtToEquity: kpi(1.5, "1.50x", "x", "green", 3),
    liquidFundsRatio: kpi(0.5, "0.50x", "x"),
    depositsToLoans: kpi(0.1, "0.10x", "x"),
    savingsToAssets: kpi(5, "5.0%", "%"),
    voluntarySavingsRatio: kpi(100, "100.0%", "%"),
  };
}

function makeMembershipKPIs(): MembershipKPIs {
  return {
    totalMembers: kpi(1200, "1,200", "members"),
    membershipGrowthRate: kpi(5, "5.0%", "%", "green"),
    dormancyRate: kpi(8, "8.0%", "%", "amber", 5),
    exitRate: kpi(2, "2.0%", "%", "green", 5),
    activeMembersRatio: kpi(85, "85.0%", "%", "green", 80),
    agmParticipationRate: kpi(60, "60.0%", "%"),
    womenMembersPercent: kpi(55, "55.0%", "%"),
    youthMembersPercent: kpi(35, "35.0%", "%"),
    ruralMembersPercent: kpi(70, "70.0%", "%"),
    womenInGovernancePercent: kpi(40, "40.0%", "%"),
    youthInGovernancePercent: kpi(25, "25.0%", "%"),
  };
}

function makeLoanKPIs(): LoanKPIs {
  return {
    creditPenetration: kpi(45, "45.0%", "%"),
    onTimeRepaymentRatio: kpi(90, "90.0%", "%", "green", 75),
    loansInArrearsPercent: kpi(10, "10.0%", "%", "amber", 20),
    restructuredLoansRatio: kpi(3, "3.0%", "%"),
    womenBorrowersPercent: kpi(50, "50.0%", "%"),
    youthBorrowersPercent: kpi(30, "30.0%", "%"),
    ruralBorrowersPercent: kpi(65, "65.0%", "%"),
    averageLoanSize: kpi(800, "$800", "USD"),
    loansPerMember: kpi(1.1, "1.10", "loans"),
    averageInterestRate: kpi(12, "12.0%", "%"),
  };
}

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    cooperativeName: "Test Coop",
    reportingPeriod: "August 2026",
    generatedAt: "2026-09-16",
    balanceSheet: null,
    financialKPIs: null,
    membershipKPIs: null,
    loanKPIs: null,
    savingsKPIs: null,
    fdKPIs: null,
    ...overrides,
  };
}

// ============================================================================
// formatCurrency / formatPercent / formatNumber
// ============================================================================

describe("formatCurrency", () => {
  it("formats billions with B suffix", () => {
    expect(formatCurrency(2_500_000_000)).toBe("$2.50B");
  });

  it("formats millions with M suffix", () => {
    expect(formatCurrency(4_200_000)).toBe("$4.2M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCurrency(9_800)).toBe("$10K");
  });

  it("formats small values without suffix", () => {
    expect(formatCurrency(123)).toBe("$123");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });
});

describe("formatPercent", () => {
  it("formats with one decimal place", () => {
    expect(formatPercent(12.34)).toBe("12.3%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("formatNumber", () => {
  it("formats millions with one decimal", () => {
    expect(formatNumber(1_500_000)).toBe("1.5M");
  });

  it("formats thousands with one decimal", () => {
    expect(formatNumber(1_234)).toBe("1.2K");
  });

  it("formats small numbers with locale grouping", () => {
    expect(formatNumber(999)).toBe("999");
  });
});

// ============================================================================
// generateCSV
// ============================================================================

describe("generateCSV", () => {
  it("includes header metadata rows", () => {
    const csv = generateCSV(makeReportData());
    const lines = csv.split("\n");
    expect(lines[0]).toBe("CoopData Financial Report");
    expect(lines[1]).toBe("Cooperative,Test Coop");
    expect(lines[2]).toBe("Reporting Period,August 2026");
    expect(lines[3]).toBe("Generated,2026-09-16");
  });

  it("contains only the header when no KPI sections provided", () => {
    const csv = generateCSV(makeReportData());
    expect(csv).not.toContain("FINANCIAL KPIs");
    expect(csv).not.toContain("MEMBERSHIP KPIs");
    expect(csv).not.toContain("LOAN KPIs");
  });

  it("includes financial KPI rows when provided", () => {
    const csv = generateCSV(makeReportData({ financialKPIs: makeFinancialKPIs() }));
    expect(csv).toContain("=== FINANCIAL KPIs ===");
    expect(csv).toContain("Total Assets,$10K,USD");
    expect(csv).toContain("PAR 30,4.0%,%,green,5");
    expect(csv).toContain("ROE,10.0%,%,green,8");
  });

  it("includes membership KPI rows when provided", () => {
    const csv = generateCSV(makeReportData({ membershipKPIs: makeMembershipKPIs() }));
    expect(csv).toContain("=== MEMBERSHIP KPIs ===");
    expect(csv).toContain("Total Members,1,200,members");
    expect(csv).toContain("Dormancy Rate,8.0%,%,amber,5");
  });

  it("includes loan KPI rows when provided", () => {
    const csv = generateCSV(makeReportData({ loanKPIs: makeLoanKPIs() }));
    expect(csv).toContain("=== LOAN KPIs ===");
    expect(csv).toContain("Credit Penetration,45.0%,%");
    expect(csv).toContain("On-Time Repayment,90.0%,%,green,75");
  });

  it("omits sections that are null", () => {
    const csv = generateCSV(makeReportData({ financialKPIs: makeFinancialKPIs() }));
    expect(csv).not.toContain("MEMBERSHIP KPIs");
    expect(csv).not.toContain("LOAN KPIs");
  });

  it("uses empty status and benchmark when missing", () => {
    const data = makeReportData({
      financialKPIs: {
        ...makeFinancialKPIs(),
        par30: kpi(4, "4.0%", "%"),
      },
    });
    const csv = generateCSV(data);
    expect(csv).toContain("PAR 30,4.0%,%,,");
  });
});

// ============================================================================
// generatePDFContent
// ============================================================================

describe("generatePDFContent", () => {
  it("renders metadata and footer", () => {
    const html = generatePDFContent(makeReportData());
    expect(html).toContain("Financial Report - Test Coop");
    expect(html).toContain("<strong>Cooperative:</strong> Test Coop");
    expect(html).toContain("Reporting Period:</strong> August 2026");
    expect(html).toContain("Generated by CoopData Platform");
  });

  it("omits KPI sections that are null", () => {
    const html = generatePDFContent(makeReportData());
    expect(html).not.toContain("<h2>Financial KPIs</h2>");
    expect(html).not.toContain("<h2>Membership KPIs</h2>");
    expect(html).not.toContain("<h2>Loan KPIs</h2>");
  });

  it("renders financial KPI cards when provided", () => {
    const html = generatePDFContent(makeReportData({ financialKPIs: makeFinancialKPIs() }));
    expect(html).toContain("<h2>Financial KPIs</h2>");
    expect(html).toContain("$10K");
    expect(html).toContain("status-green");
  });

  it("renders red class for red-status KPIs", () => {
    const data = makeReportData({
      financialKPIs: {
        ...makeFinancialKPIs(),
        par30: kpi(9, "9.0%", "%", "red", 5),
      },
    });
    const html = generatePDFContent(data);
    expect(html).toContain("status-red");
  });

  it("renders amber class for amber-status KPIs", () => {
    const data = makeReportData({
      financialKPIs: {
        ...makeFinancialKPIs(),
        par30: kpi(4, "4.0%", "%", "amber", 5),
      },
    });
    const html = generatePDFContent(data);
    expect(html).toContain("status-amber");
  });

  it("renders membership section when provided", () => {
    const html = generatePDFContent(makeReportData({ membershipKPIs: makeMembershipKPIs() }));
    expect(html).toContain("<h2>Membership KPIs</h2>");
    expect(html).toContain("1,200");
  });

  it("renders loan section when provided", () => {
    const html = generatePDFContent(makeReportData({ loanKPIs: makeLoanKPIs() }));
    expect(html).toContain("<h2>Loan KPIs</h2>");
    expect(html).toContain("45.0%");
  });
});

// ============================================================================
// generateBalanceSheetCSV
// ============================================================================

describe("generateBalanceSheetCSV", () => {
  it("includes metadata and asset rows", () => {
    const csv = generateBalanceSheetCSV(makeBalanceSheet());
    expect(csv).toContain("Balance Sheet,Test Coop");
    expect(csv).toContain("Reporting Period,2026-08");
    expect(csv).toContain("Cash on Hand (1101),100");
    expect(csv).toContain("Performing Loans (1201),1000");
  });

  it("sums other assets from components", () => {
    const csv = generateBalanceSheetCSV(
      makeBalanceSheet({
        otherAssets: {
          accountsReceivable: 10,
          prepaidExpenses: 20,
          fixedAssetsCost: 30,
          accumulatedDepreciation: 0,
          intangibleAssets: 40,
        },
      }),
    );
    expect(csv).toContain("Other Assets (1300),100");
  });

  it("sums retained earnings from components", () => {
    const csv = generateBalanceSheetCSV(
      makeBalanceSheet({
        retainedEarnings: { accumulatedSurplus: 300, currentYearSurplus: 50 },
      }),
    );
    expect(csv).toContain("Retained Earnings (3300),350");
  });

  it("lists liability and equity rows", () => {
    const csv = generateBalanceSheetCSV(makeBalanceSheet());
    expect(csv).toContain("Voluntary Savings (2101),500");
    expect(csv).toContain("Permanent Share Capital (3101),400");
    expect(csv).toContain("Credit Loss Expense (5301),0");
  });
});

// ============================================================================
// downloadCSV / downloadPDF (browser APIs)
// ============================================================================

describe("downloadCSV", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    createObjectURL = vi.fn(() => "blob:url");
    revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(globalThis.URL, {
        createObjectURL,
        revokeObjectURL,
      }),
    );
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a blob link, clicks it, and revokes the URL", () => {
    downloadCSV("a,b\n1,2", "report");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:url");
  });
});
