import { describe, expect, it } from "vitest";

import { otherAssets, periodTotals, totalAssets } from "./balance";

/** Year-end assets of the 2025 SACCO reference return (docs/testing). */
const SACCO_ASSETS: Record<number, number> = {
  1101: 45_000,
  1102: 180_000,
  1103: 320_000,
  1104: 250_000,
  1201: 2_850_000,
  1202: 120_000,
  1203: 65_000,
  1204: 40_000,
  1205: 75_000,
  1251: 31_500,
  1252: 60_000,
  1301: 35_000,
  1302: 12_000,
  1303: 420_000,
  1304: 140_000,
  1305: 18_000,
};

const reader = (values: Record<number, number>) => (code: number) => values[code] ?? 0;

const negated = (codes: number[]) =>
  Object.fromEntries(
    Object.entries(SACCO_ASSETS).map(([code, value]) => [
      code,
      codes.includes(Number(code)) ? -value : value,
    ]),
  );

describe("totalAssets", () => {
  it("subtracts provisions and depreciation typed as positive figures", () => {
    expect(totalAssets(reader(SACCO_ASSETS))).toBe(4_198_500);
  });

  it("gives the same total when they are typed as negative figures", () => {
    expect(totalAssets(reader(negated([1251, 1252, 1304])))).toBe(4_198_500);
  });
});

describe("otherAssets", () => {
  it("takes accumulated depreciation off the other assets", () => {
    expect(otherAssets(reader(SACCO_ASSETS))).toBe(345_000);
  });
});

describe("periodTotals", () => {
  it("reads a yearly return from its Annual Total column", () => {
    const annual = (values: Record<number, number>) =>
      Object.fromEntries(Object.entries(values).map(([code, value]) => [code, { 0: value }]));
    const data = annual({
      ...SACCO_ASSETS,
      2101: 3_000_000,
      2201: 360_000,
      3101: 838_500,
      4101: 630_000,
      5101: 530_000,
    });

    expect(periodTotals(data, [0])).toEqual({
      totalAssets: 4_198_500,
      totalLiabilities: 3_360_000,
      totalEquity: 838_500,
      totalIncome: 630_000,
      totalExpenses: 530_000,
    });
  });

  it("takes the balance sheet from the last month and adds up income over all months", () => {
    const data = {
      1101: { 1: 100, 2: 150, 3: 200 },
      2101: { 1: 100, 2: 150, 3: 200 },
      4101: { 1: 10, 2: 20, 3: 30 },
    };

    const totals = periodTotals(data, [1, 2, 3]);

    expect(totals.totalAssets).toBe(200);
    expect(totals.totalLiabilities).toBe(200);
    expect(totals.totalIncome).toBe(60);
  });
});
