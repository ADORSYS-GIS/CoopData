import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/app-shell";
import { useChartText } from "@/components/analytics/basic/chart-config";
import { parTone, sortRows, toneClass, type RankingKey } from "@/lib/basic-dashboard";
import type { CooperativeRow } from "@/types/basic-dashboard";

interface CooperativeRankingTableProps {
  rows: CooperativeRow[];
}

interface Column {
  key: RankingKey;
  labelKey: string;
  numeric: boolean;
}

const COLUMNS: Column[] = [
  { key: "name", labelKey: "cooperative", numeric: false },
  { key: "total_members", labelKey: "members", numeric: true },
  { key: "active_members_pct", labelKey: "activeMembers", numeric: true },
  { key: "women_members_pct", labelKey: "womenMembers", numeric: true },
  { key: "par_gt_30_pct", labelKey: "par30", numeric: true },
  { key: "total_operating_margin_pct", labelKey: "operatingMargin", numeric: true },
  { key: "monetary_reserve_coverage_pct", labelKey: "reserveCoverage", numeric: true },
];

const pct = (value: number | null | undefined): string =>
  value == null ? "—" : `${value.toFixed(2)}%`;

export function CooperativeRankingTable({ rows }: CooperativeRankingTableProps) {
  const { t } = useTranslation();
  const text = useChartText("ranking");
  const [sortKey, setSortKey] = useState<RankingKey>("total_members");
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
                <td className="px-3 py-2 text-right">{pct(row.active_members_pct)}</td>
                <td className="px-3 py-2 text-right">{pct(row.women_members_pct)}</td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${toneClass(parTone(row.par_gt_30_pct))}`}
                >
                  {pct(row.par_gt_30_pct)}
                </td>
                <td className="px-3 py-2 text-right">{pct(row.total_operating_margin_pct)}</td>
                <td className="px-3 py-2 text-right">{pct(row.monetary_reserve_coverage_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
