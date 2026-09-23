import React, { useMemo } from "react";

import { Card } from "@/components/app-shell";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { MonthlyTrendResponse } from "@/hooks/analytics/useMonthlyTrend";
import { formatUsd } from "@/lib/currency";

interface NetworkFinancialPositionProps {
  networkTrend: Pick<MonthlyTrendResponse, "months"> | undefined;
}

interface PositionStat {
  label: string;
  value: number;
  info: string;
}

export const NetworkFinancialPosition: React.FC<NetworkFinancialPositionProps> = ({
  networkTrend,
}) => {
  const stats = useMemo<PositionStat[]>(() => {
    const months = networkTrend?.months ?? [];
    const latest = [...months].reverse().find((m) => m.assets !== 0 || (m.liabilities ?? 0) !== 0);
    if (!latest || latest.liabilities === undefined || latest.equity === undefined) return [];
    const note =
      "Read from the approved financial statement (most recent reporting month) and converted to USD at the admin-configured exchange rate. Open the submission's Financial Statement tab to see the original-currency figure and the same value in USD.";
    return [
      {
        label: "Total Assets",
        value: latest.assets,
        info: `Account 1999 (Total Assets): liquid assets + net loan portfolio + other assets. ${note}`,
      },
      {
        label: "Total Liabilities",
        value: latest.liabilities,
        info: `Account 2999 (Total Liabilities): member deposits/savings + borrowings + other liabilities. ${note}`,
      },
      {
        label: "Total Equity",
        value: latest.equity,
        info: `Account 3999 (Total Equity): member shares + reserves + retained earnings. It can be negative when accumulated losses exceed capital. ${note}`,
      },
      {
        label: "Equity / Assets",
        value: latest.assets !== 0 ? (latest.equity / latest.assets) * 100 : 0,
        info: "Capital adequacy proxy = Total Equity (3999) ÷ Total Assets (1999) × 100. Computed from the two figures beside it; a negative value means liabilities exceed assets.",
      },
    ];
  }, [networkTrend]);

  if (stats.length === 0) return null;

  return (
    <div className="space-y-6">
      {stats.length > 0 && (
        <Card
          title="Financial Position"
          subtitle="Balance-sheet totals from the approved financial statement (USD)"
          info="These totals come only from the financial statement submission, never from the non-financial sub-ledgers. Each figure is the statement's native-currency amount divided by the configured exchange rate, so it can be recomputed by hand from the submission."
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {s.label}
                  <InfoTooltip text={s.info} />
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {s.label === "Equity / Assets" ? `${s.value.toFixed(1)}%` : formatUsd(s.value, 0)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
