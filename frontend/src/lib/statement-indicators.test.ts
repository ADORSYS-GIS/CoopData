import { describe, expect, it } from "vitest";

import { buildStatementIndicators, type StatementPoint } from "@/lib/statement-indicators";

const point = (overrides: Partial<StatementPoint> = {}): StatementPoint => ({
  assets: 1000,
  loans: 500,
  liquid_assets: 90,
  savings: 600,
  liabilities: 800,
  equity: 200,
  total_income: 120,
  total_expenses: 80,
  net_income: 40,
  arrears_1_30: 10,
  arrears_31_60: 20,
  arrears_61_90: 10,
  non_performing: 20,
  provisions: 25,
  borrowings: 50,
  share_capital: 70,
  reserves: 60,
  statutory_reserve: 40,
  retained_earnings: 30,
  financial_income: 100,
  financial_expenses: 30,
  ...overrides,
});

const value = (list: ReturnType<typeof buildStatementIndicators>, key: string) =>
  list.find((i) => i.key === key)?.value;

describe("buildStatementIndicators", () => {
  const list = buildStatementIndicators(point());

  it("computes liquidity to member savings and its gap to the 15% minimum", () => {
    expect(value(list, "liquidityToSavings")).toBe(15);
    expect(value(list, "liquidityGap")).toBe(0);
  });

  it("computes institutional capital from reserves and retained earnings", () => {
    expect(value(list, "institutionalCapital")).toBe(90);
    expect(value(list, "institutionalCapitalToAssets")).toBe(9);
    expect(value(list, "capitalExcess")).toBe(1);
  });

  it("does not count the 1-30 day bucket in PAR > 30", () => {
    expect(value(list, "par30")).toBe(10);
    expect(value(list, "par60")).toBe(6);
    expect(value(list, "par90")).toBe(4);
    expect(value(list, "valueAtRisk")).toBe(50);
  });

  it("computes profitability ratios", () => {
    expect(value(list, "roa")).toBe(4);
    expect(value(list, "expensesToIncome")).toBeCloseTo(66.667, 2);
    expect(value(list, "selfSufficiency")).toBe(150);
    expect(value(list, "netInterestMargin")).toBeCloseTo(7, 5);
  });

  it("computes the balance sheet structure", () => {
    expect(value(list, "earningAssetRatio")).toBe(59);
    expect(value(list, "memberSavingsRatio")).toBe(60);
    expect(value(list, "loansToSavings")).toBeCloseTo(83.333, 2);
  });

  it("marks everything as not reported when the period has no statement", () => {
    const empty = buildStatementIndicators(undefined);

    expect(empty.every((i) => i.value === null)).toBe(true);
  });

  it("does not report a ratio with a zero denominator", () => {
    const noLoans = buildStatementIndicators(point({ loans: 0, non_performing: 0 }));

    expect(value(noLoans, "par90")).toBeNull();
  });

  it("reports relative change for money and points for ratios", () => {
    const changed = buildStatementIndicators(point({ assets: 1100, loans: 550 }), point());

    expect(changed.find((i) => i.key === "totalAssets")?.change).toBeCloseTo(10, 5);
    expect(changed.find((i) => i.key === "earningAssetRatio")?.change).toBeCloseTo(-0.818, 2);
  });

  it("has no change without a comparable previous period", () => {
    expect(list.find((i) => i.key === "netIncome")?.change).toBeNull();
  });
});
