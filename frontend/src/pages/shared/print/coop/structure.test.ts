import { describe, expect, it } from "vitest";

import { arrearsAgeOf, compositionOf } from "@/pages/shared/print/coop/structure";
import type { Statement, StatementLine } from "@/pages/shared/print/coop/data";

const line = (code: number, current: number): StatementLine => ({
  code,
  name: String(code),
  current,
  prior: undefined,
});

const statement = {
  assets: [
    line(1101, 100),
    line(1102, 50),
    line(1201, 700),
    line(1203, 50),
    line(1205, 50),
    line(1251, -20),
    line(1252, -30),
    line(1303, 300),
    line(1304, -50),
  ],
  liabilities: [line(2101, 400), line(2103, 100), line(2201, 200), line(2301, 50)],
  equity: [line(3101, 200), line(3302, 50)],
} as unknown as Statement;

describe("compositionOf", () => {
  it("splits assets into liquid assets, net loans and other assets", () => {
    const { assets } = compositionOf(statement);

    expect(assets).toEqual([
      { label: "Liquid assets", value: 150 },
      { label: "Net loans", value: 750 },
      { label: "Other assets", value: 250 },
    ]);
  });

  it("splits funding into savings, borrowings, other liabilities and equity", () => {
    const { funding } = compositionOf(statement);

    expect(funding.map((slice) => slice.value)).toEqual([500, 200, 50, 250]);
  });

  it("reconciles asset slices with the sum of the asset lines", () => {
    const { assets } = compositionOf(statement);

    expect(assets.reduce((sum, slice) => sum + slice.value, 0)).toBe(1150);
  });
});

describe("arrearsAgeOf", () => {
  it("reads each ageing bucket from its ledger line", () => {
    expect(arrearsAgeOf(statement).map((slice) => slice.value)).toEqual([700, 0, 50, 0, 50]);
  });
});
