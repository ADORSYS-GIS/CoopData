import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { buildKpiCards } from "@/components/analytics/national/kpiCards";
import type { components } from "@/openapi-client/api";

type Kpi = components["schemas"]["KpiItemResponse"];

const kpi = (name: string, value: number, formatted: string): Kpi =>
  ({
    name,
    value,
    formatted,
    unit: "percent",
    status: "green",
    benchmark: null,
    description: "English text",
  }) as Kpi;

const t = ((key: string, options?: { defaultValue?: string }) =>
  key.startsWith("analytics.kpiHelp.par30")
    ? "Texte traduit"
    : (options?.defaultValue ?? key)) as unknown as TFunction;

describe("buildKpiCards", () => {
  const kpis = [kpi("total_assets", 1000, "$1,000"), kpi("par30", 4, "4.0%")];

  it("uses the translated help text when one exists", () => {
    const card = buildKpiCards(kpis, t).find((c) => c.key === "par30");

    expect(card?.tooltip).toBe("Texte traduit");
  });

  it("falls back to the backend description for an unknown KPI", () => {
    const card = buildKpiCards([kpi("total_assets", 1000, "$1"), kpi("roa", 2, "2%")], t).find(
      (c) => c.key === "roa",
    );

    expect(card?.tooltip).toBe("English text");
  });

  it("reads not reported when there are no total assets", () => {
    const [card] = buildKpiCards([kpi("total_assets", 0, "$0"), kpi("par30", 0, "0%")], t);

    expect(card?.value).toBe("—");
  });
});
