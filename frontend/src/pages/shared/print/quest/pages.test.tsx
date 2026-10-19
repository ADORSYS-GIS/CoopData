import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { QuestAnalysis } from "./data";
import { resiliencePage } from "./pages2";
import { performancePage } from "./pages3";

/** Analysis where only the listed indicators were reported. */
const analysis = (reported: Record<string, number>): QuestAnalysis =>
  ({
    props: { narratives: null, dashboard: { indicators: [], scope: { currency: "SZL" } } },
    period: "2025",
    num: (key: string) => reported[key] ?? null,
    text: (key: string) => (key in reported ? `${reported[key]}%` : "—"),
    line: () => ({ labels: [], values: [] }),
  }) as unknown as QuestAnalysis;

const textOf = (page: { render: () => React.ReactNode }) =>
  render(<>{page.render()}</>).container.textContent ?? "";

describe("questionnaire report narrative", () => {
  it("says reserve coverage is not reported instead of printing a dash", () => {
    const text = textOf(resiliencePage(analysis({}), "4"));

    expect(text).not.toMatch(/at —/);
    expect(text).toMatch(/not reported/);
  });

  it("states the reserve coverage when it is reported", () => {
    const text = textOf(resiliencePage(analysis({ monetary_reserve_coverage_pct: 80 }), "4"));

    expect(text).toMatch(/backed by actual bank funds at 80%/);
  });

  it("says the share distributed to members is not reported instead of printing a dash", () => {
    const text = textOf(
      performancePage(
        analysis({ main_activity_operating_margin_pct: 12.8, total_operating_margin_pct: 9.83 }),
        "5",
      ),
    );

    expect(text).not.toMatch(/— is distributed/);
    expect(text).toMatch(/distributed to members is not reported/);
  });
});
