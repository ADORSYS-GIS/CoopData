import React from "react";
import { ReportDataProps } from "./types";

const PEARLS_DEFINITIONS: Record<string, string> = {
  capital_adequacy_ratio: "Total equity divided by total assets.",
  roa: "Net surplus divided by total assets.",
  roe: "Net surplus divided by total equity.",
  operating_expense_ratio: "Administrative (operating) expenses divided by total assets.",
  operational_self_sufficiency: "Total income divided by total expenses (interest, operating and provision expenses).",
  liquid_funds_ratio: "Cash and short-term investments divided by total assets.",
  net_interest_margin: "Interest income less interest expense, divided by total assets.",
  deposits_to_loans: "Total member deposits divided by gross loan portfolio.",
  gross_loan_portfolio: "Outstanding principal balance of all loans.",
  total_assets: "Sum of all assets on the balance sheet.",
  net_surplus: "Total income less total expenses for the period.",
};

const statusBadge = (status?: string | null) => {
  if (status === "green") return <span className="rp-st rp-ok">Meets</span>;
  if (status === "red")   return <span className="rp-st rp-bad">Breach</span>;
  if (status === "amber") return <span className="rp-st rp-warn">Watch</span>;
  return <span className="rp-st rp-na">N/A</span>;
};

// ── Section 2: Prudential Ratio Scorecard (PEARLS-based) only.
// Annex B (Indicator Definitions) is rendered at the END of the document
// inside ReportNonFinancial to preserve the correct section numbering.
export const ReportBenchmarkComparison: React.FC<ReportDataProps> = ({
  kpisData,
  submission,
  submissionId,
  narratives,
}) => {
  const subRef = `SUB-${submission.reporting_year}-${submissionId.slice(0, 5).toUpperCase()}`;
  const kpis = kpisData.kpis ?? [];

  const groups: { label: string; keys: string[] }[] = [
    { label: "Capital Structure",           keys: ["capital_adequacy_ratio"] },
    { label: "Rates of Return & Costs",     keys: ["roa", "roe", "operating_expense_ratio"] },
    { label: "Liquidity & Intermediation",  keys: ["liquid_funds_ratio", "deposits_to_loans"] },
    { label: "Financial Position (Absolute)", keys: ["total_assets", "gross_loan_portfolio", "net_surplus"] },
  ];

  return (
    <section className="rp-page">
      <div className="rp-sec">
        <span className="rp-sec-no">2</span>
        <h2>Prudential Ratio Scorecard</h2>
        <span className="rp-sec-sub">PEARLS-based</span>
      </div>

      {narratives?.benchmark_comparison && (
        <div className="rp-opinion rp-keep">
          <div className="rp-lbl">Benchmark Analysis</div>
          <p style={{ margin: 0 }}>{narratives.benchmark_comparison}</p>
        </div>
      )}

      <p>
        The table below sets out each prudential indicator for FY {submission.reporting_year} against
        the prior year and the applicable benchmark. All ratios are recomputed from the submitted
        financial statements.
      </p>

      <table className="rp-tbl">
        <thead>
          <tr>
            <th>Indicator</th>
            <th>Formula / description</th>
            <th className="rp-num">Prior yr</th>
            <th className="rp-num">Current</th>
            <th className="rp-num">Benchmark</th>
            <th style={{ width: "22mm" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupKpis = group.keys
              .map((key) => kpis.find((k) => k.name === key))
              .filter(Boolean) as typeof kpis;
            if (groupKpis.length === 0) return null;
            return (
              <React.Fragment key={group.label}>
                <tr className="rp-grp">
                  <td colSpan={6}>{group.label}</td>
                </tr>
                {groupKpis.map((kpi) => {
                  const prior = kpisData.prior_year_kpis?.find((p) => p.name === kpi.name);
                  const bm =
                    kpi.benchmark != null
                      ? kpi.unit === "percent" ? `${kpi.benchmark}%` : String(kpi.benchmark)
                      : "—";
                  return (
                    <tr key={kpi.name}>
                      <td>{kpi.description ?? kpi.name.replace(/_/g, " ")}</td>
                      <td style={{ color: "var(--ink-2)", fontSize: "8pt" }}>
                        {PEARLS_DEFINITIONS[kpi.name] ?? "—"}
                      </td>
                      <td className="rp-num">{prior?.formatted?.replace('$', '') ?? "—"}</td>
                      <td className="rp-num">{kpi.formatted?.replace('$', '')}</td>
                      <td className="rp-num">{bm}</td>
                      <td>{statusBadge(kpi.status)}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <p className="rp-src" style={{ textAlign: "right" }}>{subRef}</p>
    </section>
  );
};

export default ReportBenchmarkComparison;
