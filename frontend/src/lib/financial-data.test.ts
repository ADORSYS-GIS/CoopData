import { describe, it, expect } from "vitest";
import {
  calculateTotalLiquidAssets,
  calculateGrossLoanPortfolio,
  calculateTotalLoanLossProvisions,
  calculateNetLoanPortfolio,
  calculateTotalOtherAssets,
  calculateTotalAssets,
  calculateTotalMemberDeposits,
  calculateTotalBorrowings,
  calculateTotalOtherLiabilities,
  calculateTotalLiabilities,
  calculateTotalMemberShares,
  calculateTotalReserves,
  calculateTotalRetainedEarnings,
  calculateTotalEquity,
  calculateTotalFinancialIncome,
  calculateTotalOtherIncome,
  calculateTotalIncome,
  calculateTotalFinancialExpenses,
  calculateTotalOperatingExpenses,
  calculateTotalExpenses,
  calculateNetSurplus,
  validateBalanceSheet,
  createEmptyBalanceSheet,
  type BalanceSheet,
} from "./financial-data";

function createMinimalBalanceSheet(overrides: Partial<BalanceSheet> = {}): BalanceSheet {
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
    ...overrides,
  };
}

describe("calculateTotalLiquidAssets", () => {
  it("sums all liquid asset components", () => {
    const assets = {
      cashOnHand: 1000,
      cashAtBankCurrent: 5000,
      cashAtBankSavings: 10000,
      shortTermInvestments: 2000,
    };
    expect(calculateTotalLiquidAssets(assets)).toBe(18000);
  });

  it("returns 0 when all values are zero", () => {
    const assets = {
      cashOnHand: 0,
      cashAtBankCurrent: 0,
      cashAtBankSavings: 0,
      shortTermInvestments: 0,
    };
    expect(calculateTotalLiquidAssets(assets)).toBe(0);
  });
});

describe("calculateGrossLoanPortfolio", () => {
  it("sums all loan portfolio components", () => {
    const loans = {
      performingLoanPortfolio: 50000,
      loansInArrears_1_30: 2000,
      loansInArrears_31_60: 1000,
      loansInArrears_61_90: 500,
      nonPerformingLoans: 500,
    };
    expect(calculateGrossLoanPortfolio(loans)).toBe(54000);
  });

  it("returns 0 when all values are zero", () => {
    const loans = {
      performingLoanPortfolio: 0,
      loansInArrears_1_30: 0,
      loansInArrears_31_60: 0,
      loansInArrears_61_90: 0,
      nonPerformingLoans: 0,
    };
    expect(calculateGrossLoanPortfolio(loans)).toBe(0);
  });
});

describe("calculateTotalLoanLossProvisions", () => {
  it("sums general and specific provisions", () => {
    const provisions = {
      generalLoanLossProvision: 500,
      specificLoanLossProvision: 300,
    };
    expect(calculateTotalLoanLossProvisions(provisions)).toBe(800);
  });

  it("handles zero provisions", () => {
    const provisions = {
      generalLoanLossProvision: 0,
      specificLoanLossProvision: 0,
    };
    expect(calculateTotalLoanLossProvisions(provisions)).toBe(0);
  });
});

describe("calculateNetLoanPortfolio", () => {
  it("subtracts provisions from gross portfolio", () => {
    const loans = {
      performingLoanPortfolio: 50000,
      loansInArrears_1_30: 2000,
      loansInArrears_31_60: 1000,
      loansInArrears_61_90: 500,
      nonPerformingLoans: 500,
    };
    const provisions = {
      generalLoanLossProvision: 500,
      specificLoanLossProvision: 300,
    };
    expect(calculateNetLoanPortfolio(loans, provisions)).toBe(53200);
  });
});

describe("calculateTotalOtherAssets", () => {
  it("calculates net other assets", () => {
    const assets = {
      accountsReceivable: 1000,
      prepaidExpenses: 500,
      fixedAssetsCost: 20000,
      accumulatedDepreciation: 5000,
      intangibleAssets: 1000,
    };
    expect(calculateTotalOtherAssets(assets)).toBe(17500);
  });

  it("handles zero accumulated depreciation", () => {
    const assets = {
      accountsReceivable: 1000,
      prepaidExpenses: 500,
      fixedAssetsCost: 10000,
      accumulatedDepreciation: 0,
      intangibleAssets: 500,
    };
    expect(calculateTotalOtherAssets(assets)).toBe(12000);
  });
});

describe("calculateTotalAssets", () => {
  it("calculates total assets correctly", () => {
    const bs = createMinimalBalanceSheet();
    const totalAssets = calculateTotalAssets(bs);
    expect(totalAssets).toBeGreaterThan(0);
  });

  it("handles zero values", () => {
    const bs = createEmptyBalanceSheet();
    expect(calculateTotalAssets(bs)).toBe(0);
  });
});

describe("calculateTotalMemberDeposits", () => {
  it("sums all deposit types", () => {
    const deposits = {
      voluntarySavings: 30000,
      mandatorySavings: 10000,
      fixedTermDeposits: 5000,
    };
    expect(calculateTotalMemberDeposits(deposits)).toBe(45000);
  });
});

describe("calculateTotalBorrowings", () => {
  it("sums short and long term borrowings", () => {
    const borrowings = {
      shortTermBorrowings: 5000,
      longTermBorrowings: 10000,
    };
    expect(calculateTotalBorrowings(borrowings)).toBe(15000);
  });
});

describe("calculateTotalOtherLiabilities", () => {
  it("sums all other liability components", () => {
    const liabilities = {
      accountsPayable: 2000,
      accruedExpenses: 1000,
      deferredIncome: 500,
    };
    expect(calculateTotalOtherLiabilities(liabilities)).toBe(3500);
  });
});

describe("calculateTotalLiabilities", () => {
  it("calculates total liabilities", () => {
    const bs = createMinimalBalanceSheet();
    const totalLiabilities = calculateTotalLiabilities(bs);
    expect(totalLiabilities).toBe(63500);
  });
});

describe("calculateTotalMemberShares", () => {
  it("sums permanent and withdrawable shares", () => {
    const shares = {
      permanentShareCapital: 10000,
      withdrawableShares: 5000,
    };
    expect(calculateTotalMemberShares(shares)).toBe(15000);
  });
});

describe("calculateTotalReserves", () => {
  it("sums all reserve types", () => {
    const reserves = {
      statutoryReserve: 5000,
      generalReserve: 3000,
      riskCapitalAdequacyReserve: 2000,
    };
    expect(calculateTotalReserves(reserves)).toBe(10000);
  });
});

describe("calculateTotalRetainedEarnings", () => {
  it("sums accumulated and current year surplus", () => {
    const earnings = {
      accumulatedSurplus: 10000,
      currentYearSurplus: 5000,
    };
    expect(calculateTotalRetainedEarnings(earnings)).toBe(15000);
  });
});

describe("calculateTotalEquity", () => {
  it("calculates total equity", () => {
    const bs = createMinimalBalanceSheet();
    const totalEquity = calculateTotalEquity(bs);
    expect(totalEquity).toBe(40000);
  });
});

describe("calculateTotalFinancialIncome", () => {
  it("sums interest and fees income", () => {
    const income = {
      interestIncomeLoans: 10000,
      feesCommissionsIncome: 2000,
    };
    expect(calculateTotalFinancialIncome(income)).toBe(12000);
  });
});

describe("calculateTotalOtherIncome", () => {
  it("returns operating income", () => {
    const income = {
      otherOperatingIncome: 1000,
    };
    expect(calculateTotalOtherIncome(income)).toBe(1000);
  });
});

describe("calculateTotalIncome", () => {
  it("sums financial and other income", () => {
    const bs = createMinimalBalanceSheet();
    const totalIncome = calculateTotalIncome(bs);
    expect(totalIncome).toBe(13000);
  });
});

describe("calculateTotalFinancialExpenses", () => {
  it("sums deposit and borrowing interest expenses", () => {
    const expenses = {
      interestExpenseDeposits: 3000,
      interestExpenseBorrowings: 1000,
    };
    expect(calculateTotalFinancialExpenses(expenses)).toBe(4000);
  });
});

describe("calculateTotalOperatingExpenses", () => {
  it("sums all operating expense components", () => {
    const expenses = {
      personnelCosts: 5000,
      administrativeExpenses: 2000,
      governanceExpenses: 500,
      depreciationAmortization: 1000,
    };
    expect(calculateTotalOperatingExpenses(expenses)).toBe(8500);
  });
});

describe("calculateTotalExpenses", () => {
  it("sums financial, operating, and credit loss expenses", () => {
    const bs = createMinimalBalanceSheet();
    const totalExpenses = calculateTotalExpenses(bs);
    expect(totalExpenses).toBe(13000);
  });
});

describe("calculateNetSurplus", () => {
  it("calculates net surplus correctly", () => {
    const bs = createMinimalBalanceSheet();
    const netSurplus = calculateNetSurplus(bs);
    expect(netSurplus).toBe(0);
  });

  it("returns positive surplus when income exceeds expenses", () => {
    const bs = createMinimalBalanceSheet();
    bs.financialIncome.interestIncomeLoans = 50000;
    const netSurplus = calculateNetSurplus(bs);
    expect(netSurplus).toBeGreaterThan(0);
  });

  it("returns negative surplus (deficit) when expenses exceed income", () => {
    const bs = createMinimalBalanceSheet();
    bs.operatingExpenses.personnelCosts = 100000;
    const netSurplus = calculateNetSurplus(bs);
    expect(netSurplus).toBeLessThan(0);
  });
});

describe("validateBalanceSheet", () => {
  it("returns error when balance sheet does not balance", () => {
    const bs = createMinimalBalanceSheet();
    bs.liquidAssets.cashOnHand = 100000;
    const result = validateBalanceSheet(bs);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "balance")).toBe(true);
  });

  it("returns error for negative loan portfolio", () => {
    const bs = createMinimalBalanceSheet();
    bs.loanPortfolio.performingLoanPortfolio = -100000;
    const result = validateBalanceSheet(bs);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "loanPortfolio")).toBe(true);
  });

  it("returns error for negative cash on hand", () => {
    const bs = createMinimalBalanceSheet();
    bs.liquidAssets.cashOnHand = -100;
    const result = validateBalanceSheet(bs);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "liquidAssets.cashOnHand")).toBe(true);
  });

  it("returns warning for zero total assets", () => {
    const bs = createEmptyBalanceSheet();
    const result = validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.field === "assets")).toBe(true);
  });

  it("returns warning for negative net surplus", () => {
    const bs = createMinimalBalanceSheet();
    bs.operatingExpenses.personnelCosts = 100000;
    const result = validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.field === "surplus")).toBe(true);
  });

  it("returns warning for PAR > 20%", () => {
    const bs = createMinimalBalanceSheet();
    bs.loanPortfolio.loansInArrears_31_60 = 10000;
    bs.loanPortfolio.loansInArrears_61_90 = 10000;
    bs.loanPortfolio.nonPerformingLoans = 10000;
    const result = validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.field === "loanPortfolio")).toBe(true);
  });
});

describe("createEmptyBalanceSheet", () => {
  it("creates a balance sheet with all zero values", () => {
    const bs = createEmptyBalanceSheet();
    expect(bs.liquidAssets.cashOnHand).toBe(0);
    expect(bs.loanPortfolio.performingLoanPortfolio).toBe(0);
    expect(bs.memberDeposits.voluntarySavings).toBe(0);
  });

  it("sets default currency to USD", () => {
    const bs = createEmptyBalanceSheet();
    expect(bs.currency).toBe("USD");
  });

  it("sets default accounting year to calendar", () => {
    const bs = createEmptyBalanceSheet();
    expect(bs.accountingYear).toBe("calendar");
  });
});