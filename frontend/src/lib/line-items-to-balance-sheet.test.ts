import { describe, it, expect } from "vitest";
import { lineItemsToBalanceSheet } from "@/lib/line-items-to-balance-sheet";
import type { LineItemResponse } from "@/hooks/submissions/useFinancialStatement";

function item(partial: Partial<LineItemResponse>): LineItemResponse {
  return {
    id: "id",
    financial_statement_id: "fs",
    account_category: "Assets",
    account_subcategory: "",
    account_name: "x",
    month: 1,
    ai_flagged: false,
    manually_edited: false,
    created_at: "",
    updated_at: "",
    ...partial,
  } as LineItemResponse;
}

describe("lineItemsToBalanceSheet", () => {
  it("maps account codes to the correct BalanceSheet fields", () => {
    const items = [
      item({ account_code: 1101, value: 1000 }),
      item({ account_code: 1201, value: 5000 }),
      item({ account_code: 2101, value: 3000 }),
      item({ account_code: 4101, value: 800 }),
      item({ account_code: 5201, value: 200 }),
    ];
    const bs = lineItemsToBalanceSheet(items);
    expect(bs.liquidAssets.cashOnHand).toBe(1000);
    expect(bs.loanPortfolio.performingLoanPortfolio).toBe(5000);
    expect(bs.memberDeposits.voluntarySavings).toBe(3000);
    expect(bs.financialIncome.interestIncomeLoans).toBe(800);
    expect(bs.operatingExpenses.personnelCosts).toBe(200);
  });

  it("defaults missing codes to zero", () => {
    const bs = lineItemsToBalanceSheet([item({ account_code: 1101, value: 100 })]);
    expect(bs.liquidAssets.cashAtBankCurrent).toBe(0);
    expect(bs.memberShares.permanentShareCapital).toBe(0);
  });

  it("ignores items without a code or value", () => {
    const bs = lineItemsToBalanceSheet([
      item({ account_code: null, value: 999 }),
      item({ account_code: 1101, value: null }),
    ]);
    expect(bs.liquidAssets.cashOnHand).toBe(0);
  });
});
