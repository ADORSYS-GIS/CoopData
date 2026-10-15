import { describe, it, expect } from "vitest";
import { questionnaireKpis } from "./questionnaire-kpis";

const balances = {
  total_assets: 284_400_000,
  gross_loans: 200_000,
  member_deposits: 35_100_000,
  net_surplus: 15_700_000,
  par_30_pct: 12.5,
  capital_ratio_pct: 15.9,
  overdue_gt_30: 25_000,
  overdue_gt_90: 10_000,
};

describe("questionnaireKpis", () => {
  it("maps questionnaire balances onto the dashboard's KPI names", () => {
    const kpis = questionnaireKpis(balances, "SZL");
    const byName = Object.fromEntries(kpis.map((k) => [k.name, k]));

    expect(byName.total_assets?.formatted).toBe("SZL 284.4M");
    expect(byName.gross_loan_portfolio?.value).toBe(200_000);
    expect(byName.total_member_deposits?.formatted).toBe("SZL 35.1M");
    expect(byName.net_surplus?.unit).toBe("currency");
    expect(byName.par30?.formatted).toBe("12.5%");
    expect(byName.par90?.value).toBe(5);
    expect(byName.capital_ratio?.formatted).toBe("15.9%");
  });

  it("leaves out figures whose questions were not answered, instead of showing zero", () => {
    const kpis = questionnaireKpis(
      { ...balances, total_assets: null, gross_loans: null, capital_ratio_pct: null },
      "SZL",
    );
    const names = kpis.map((k) => k.name);

    expect(names).not.toContain("total_assets");
    expect(names).not.toContain("gross_loan_portfolio");
    expect(names).not.toContain("par90");
    expect(names).not.toContain("capital_ratio");
  });

  it("never carries a benchmark", () => {
    expect(questionnaireKpis(balances, "SZL").every((k) => k.benchmark === undefined)).toBe(true);
  });
});
