import { useTranslation } from "react-i18next";

interface CoopKpiEntry {
  name: string;
  region?: string | null;
  kpis: Record<string, { value: number; formatted: string; status: string | null }>;
}

interface KpiChipGridProps {
  cooperatives: CoopKpiEntry[];
  kpiKeys: string[];
  maxRows?: number;
}

const kpiLabels: Record<string, string> = {
  par30: "PAR30",
  par90: "PAR90",
  npl_ratio: "NPL",
  roa: "ROA",
  roe: "ROE",
  capital_adequacy_ratio: "CAR",
  liquid_funds_ratio: "LFR",
  operating_expense_ratio: "OER",
  operational_self_sufficiency: "OSS",
  net_interest_margin: "NIM",
  deposits_to_loans: "D/L",
};

function statusDot(
  status: string | null,
  t: (key: string) => string,
): { bg: string; label: string } {
  switch (status) {
    case "green":
      return { bg: "#22c55e", label: t("analytics.healthy") };
    case "amber":
      return { bg: "var(--chart-3)", label: t("analytics.watch") };
    case "red":
      return { bg: "#ef4444", label: t("analytics.risk") };
    default:
      return { bg: "#94a3b8", label: t("analytics.noData") };
  }
}

export function KpiChipGrid({ cooperatives, kpiKeys, maxRows = 15 }: KpiChipGridProps) {
  const { t } = useTranslation();
  const visible = cooperatives.slice(0, maxRows);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
        <span className="text-sm font-semibold">{t("analytics.noCoopData")}</span>
        <span className="text-xs">{t("analytics.approvedSubmissionsHint")}</span>
      </div>
    );
  }

  const legendItems = [
    { color: "#22c55e", label: t("analytics.healthy") },
    { color: "var(--chart-3)", label: t("analytics.watch") },
    { color: "#ef4444", label: t("analytics.risk") },
    { color: "#94a3b8", label: t("analytics.noData") },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {legendItems.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      <table className="w-full text-xs min-w-[600px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 pr-4 w-44">
              {t("analytics.cooperative")}
            </th>
            {kpiKeys.map((k) => (
              <th
                key={k}
                className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 px-2"
                title={k.replace(/_/g, " ")}
              >
                {kpiLabels[k] ?? k.slice(0, 4).toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((coop) => (
            <tr
              key={coop.name}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              <td className="py-2 pr-4">
                <div
                  className="font-medium text-foreground truncate max-w-[160px]"
                  title={coop.name}
                >
                  {coop.name}
                </div>
                {coop.region && (
                  <div className="text-[10px] text-muted-foreground">{coop.region}</div>
                )}
              </td>
              {kpiKeys.map((k) => {
                const kpi = coop.kpis[k];
                const dot = statusDot(kpi?.status ?? null, t);
                return (
                  <td key={k} className="text-center py-2 px-2">
                    <span
                      className="inline-flex size-5 rounded-full items-center justify-center mx-auto cursor-default"
                      style={{ background: `${dot.bg}22` }}
                      title={kpi ? `${kpi.formatted} — ${dot.label}` : t("analytics.noData")}
                    >
                      <span className="size-2.5 rounded-full" style={{ background: dot.bg }} />
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {cooperatives.length > maxRows && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {t("analytics.showingOf", { shown: maxRows, total: cooperatives.length })}
        </p>
      )}
    </div>
  );
}
