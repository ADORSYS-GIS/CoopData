import type { LineItemResponse } from "@/hooks/submissions/useFinancialStatement";
import { createEmptyBalanceSheet, type BalanceSheet } from "@/lib/financial-data";

/**
 * Maps extracted line items (account code → value) onto the BalanceSheet shape
 * used by the financial statement editor. Unknown / unmapped codes are ignored.
 */
export function lineItemsToBalanceSheet(
  lineItems: LineItemResponse[],
  overrides: Partial<BalanceSheet> = {},
): BalanceSheet {
  const bs = createEmptyBalanceSheet();
  const byCode = new Map<number, number>();
  for (const item of lineItems) {
    if (item.account_code != null && item.value != null) {
      byCode.set(item.account_code, item.value);
    }
  }

  const get = (code: number): number => byCode.get(code) ?? 0;

  bs.liquidAssets = {
    cashOnHand: get(1101),
    cashAtBankCurrent: get(1102),
    cashAtBankSavings: get(1103),
    shortTermInvestments: get(1104),
  };
  bs.loanPortfolio = {
    performingLoanPortfolio: get(1201),
    loansInArrears_1_30: get(1202),
    loansInArrears_31_60: get(1203),
    loansInArrears_61_90: get(1204),
    nonPerformingLoans: get(1205),
  };
  bs.loanLossProvisions = {
    generalLoanLossProvision: get(1251),
    specificLoanLossProvision: get(1252),
  };
  bs.otherAssets = {
    accountsReceivable: get(1301),
    prepaidExpenses: get(1302),
    fixedAssetsCost: get(1303),
    accumulatedDepreciation: get(1304),
    intangibleAssets: get(1305),
  };
  bs.memberDeposits = {
    voluntarySavings: get(2101),
    mandatorySavings: get(2102),
    fixedTermDeposits: get(2103),
  };
  bs.borrowings = {
    shortTermBorrowings: get(2201),
    longTermBorrowings: get(2202),
  };
  bs.otherLiabilities = {
    accountsPayable: get(2301),
    accruedExpenses: get(2302),
    deferredIncome: get(2303),
  };
  bs.memberShares = {
    permanentShareCapital: get(3101),
    withdrawableShares: get(3102),
  };
  bs.reserves = {
    statutoryReserve: get(3201),
    generalReserve: get(3202),
    riskCapitalAdequacyReserve: get(3203),
  };
  bs.retainedEarnings = {
    accumulatedSurplus: get(3301),
    currentYearSurplus: get(3302),
  };
  bs.financialIncome = {
    interestIncomeLoans: get(4101),
    feesCommissionsIncome: get(4102),
  };
  bs.otherIncome = {
    otherOperatingIncome: get(4201),
  };
  bs.financialExpenses = {
    interestExpenseDeposits: get(5101),
    interestExpenseBorrowings: get(5102),
  };
  bs.operatingExpenses = {
    personnelCosts: get(5201),
    administrativeExpenses: get(5202),
    governanceExpenses: get(5203),
    depreciationAmortization: get(5204),
  };
  bs.creditLossExpense = get(5301);

  return { ...bs, ...overrides };
}
