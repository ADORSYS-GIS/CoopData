import { describe, expect, it } from "vitest";

import { otherAssets, totalAssets } from "./balance";

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
