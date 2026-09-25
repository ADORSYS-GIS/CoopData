import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/app-shell";
import { useChartText } from "@/components/analytics/basic/chart-config";
import {
  formatMoneyValue,
  minimumTone,
  parTone,
  sortRows,
  toneClass,
  type RankingKey,
} from "@/lib/basic-dashboard";
import type { CooperativeRow, DashboardThresholds } from "@/types/basic-dashboard";

interface CooperativeRankingTableProps {
  rows: CooperativeRow[];
  currency: string;
  thresholds: DashboardThresholds;
}

interface Column {
  key: RankingKey;
  labelKey: string;
  numeric: boolean;
}

const COLUMNS: Column[] = [
  { key: "name", labelKey: "cooperative", numeric: false },
  { key: "total_members", labelKey: "members", numeric: true },
  { key: "total_assets", labelKey: "assets", numeric: true },
  { key: "total_deposits", labelKey: "deposits", numeric: true },
  { key: "gross_loans", labelKey: "loans", numeric: true },
  { key: "par_gt_30_pct", labelKey: "par30", numeric: true },
  { key: "liquidity_ratio_pct", labelKey: "liquidity", numeric: true },
  { key: "institutional_capital_ratio_pct", labelKey: "capital", numeric: true },
  { key: "net_income", labelKey: "netIncome", numeric: true },
];

const pct = (value: number | null): string => (value === null ? "—" : `${value.toFixed(2)}%`);

export function CooperativeRankingTable({
  rows,
  currency,
  thresholds,
}: CooperativeRankingTableProps) {
  const { t } = useTranslation();
  const text = useChartText("ranking");
  const [sortKey, setSortKey] = useState<RankingKey>("total_assets");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => sortRows(rows, sortKey, direction), [rows, sortKey, direction]);
  if (rows.length === 0) return null;

  const onSort = (key: RankingKey) => {
    if (key === sortKey) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setDirection(key === "name" ? "asc" : "desc");
    }
  };
  const money = (value: number | null) =>
    value === null ? "—" : formatMoneyValue(value, currency);

  return (
    <Card
      title={text.title}
      subtitle={text.subtitle}
      info={text.info}
      className="!shadow-none hover:!shadow-none"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              {COLUMNS.map((column) => (
                <th key={column.key} className={`px-3 py-2 ${column.numeric ? "text-right" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="inline-flex items-center gap-1 font-bold hover:text-foreground"
                    aria-label={t("basicDashboard.table.sortBy", {
                      column: t(`basicDashboard.table.${column.labelKey}`),
                    })}
                  >
                    {t(`basicDashboard.table.${column.labelKey}`)}
                    {sortKey === column.key &&
                      (direction === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {sorted.map((row) => (
              <tr key={row.cooperative_id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-semibold text-foreground">{row.name}</td>
                <td className="px-3 py-2 text-right">
                  {Math.round(row.total_members).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">{money(row.total_assets)}</td>
                <td className="px-3 py-2 text-right">{money(row.total_deposits)}</td>
                <td className="px-3 py-2 text-right">{money(row.gross_loans)}</td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${toneClass(parTone(row.par_gt_30_pct))}`}
                >
                  {pct(row.par_gt_30_pct)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${toneClass(
                    minimumTone(row.liquidity_ratio_pct, thresholds.liquidity_minimum_pct),
                  )}`}
                >
                  {pct(row.liquidity_ratio_pct)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${toneClass(
                    minimumTone(
                      row.institutional_capital_ratio_pct,
                      thresholds.institutional_capital_minimum_pct,
                    ),
                  )}`}
                >
                  {pct(row.institutional_capital_ratio_pct)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    (row.net_income ?? 0) < 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {money(row.net_income)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
