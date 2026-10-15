import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import { buildSavingsMetrics } from "./ledgerMetrics";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";

const t = ((key: string, opts?: { amount?: string }) =>
  key === "analytics.netAvg" ? `Avg: ${opts?.amount}` : key) as unknown as TFunction;

describe("ledger metrics", () => {
  it("shows the average savings balance in the cooperative's currency", () => {
    const reported = { total_balance: 2_630_000, average_balance: 131_500 };
    const savings = new Proxy(reported, {
      get: (target, key) => (target as Record<string | symbol, number>)[key] ?? 0,
    }) as unknown as NfStatisticsResponse["savings"];

    const card = buildSavingsMetrics(savings, t).find((m) => m.key === "memberLedgerSavings");

    expect(card?.trendValue).toBe("Avg: SZL 132K");
  });
});
