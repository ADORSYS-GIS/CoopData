import { describe, expect, it } from "vitest";

import type { SubmissionLineItemsResponse } from "@/hooks/submissions/useCooperativeKpis";
import {
  accountValue,
  buildStatement,
  changePct,
  fmtChange,
  fmtInt,
} from "@/pages/shared/print/coop/data";

const row = (code: number, value: number, month = 0, name = `Account ${code}`) => ({
  id: `${code}-${month}`,
  account_code: code,
  account_name: name,
  account_category: "x",
  month,
  value,
});

const data = (
  current: ReturnType<typeof row>[],
  prior: ReturnType<typeof row>[] = [],
): SubmissionLineItemsResponse => ({
  submission_id: "s",
  current_year: current,
  prior_year: prior,
});

describe("accountValue", () => {
  it("reads an annual figure stored at month 0", () => {
    expect(accountValue(data([row(1999, 500)]), 1999, "current")).toBe(500);
  });

  it("takes the latest month for a balance", () => {
    const d = data([row(1999, 400, 1), row(1999, 450, 12), row(1999, 420, 6)]);

    expect(accountValue(d, 1999, "current")).toBe(450);
  });

  it("sums the months of an income account", () => {
    const d = data([row(4101, 10, 1), row(4101, 12, 2), row(4101, 8, 3)]);

    expect(accountValue(d, 4101, "current")).toBe(30);
  });

  it("returns undefined for a missing account", () => {
    expect(accountValue(data([]), 1999, "current")).toBeUndefined();
  });
});

describe("buildStatement", () => {
  it("lists leaf accounts and falls back to their sum when a total is missing", () => {
    const s = buildStatement(data([row(1101, 100), row(1201, 300), row(1100, 999)]));

    expect(s.assets.map((l) => l.code)).toEqual([1101, 1201]);
    expect(s.totals.assets.current).toBe(400);
    expect(s.reported.assets.current).toBeUndefined();
  });

  it("prefers the reported total", () => {
    const s = buildStatement(data([row(1101, 100), row(1999, 150)]));

    expect(s.totals.assets.current).toBe(150);
  });

  it("derives the surplus from income and expenses when it is not reported", () => {
    const s = buildStatement(data([row(4101, 100), row(5101, -60)]));

    expect(s.totals.surplus.current).toBe(40);
  });

  it("drops accounts that are zero in both years", () => {
    const s = buildStatement(data([row(1101, 0)], [row(1101, 0)]));

    expect(s.assets).toEqual([]);
  });
});

describe("formatting", () => {
  it("shows negatives in brackets and missing values as a dash", () => {
    expect(fmtInt(-1500)).toBe("(1,500)");
    expect(fmtInt(undefined)).toBe("—");
    expect(fmtChange(-12.34)).toBe("(12.3%)");
    expect(changePct(110, 100)).toBeCloseTo(10, 5);
    expect(changePct(5, 0)).toBeNull();
  });
});
