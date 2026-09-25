import React from "react";
import { ReportDataProps } from "./types";
import { findKpi, formatCurrency } from "./utils";

export const ReportPortfolioQuality: React.FC<ReportDataProps> = ({
  portfolioData,
  kpiMap,
  kpisData,
  submission,
  submissionId,
  narratives,
}) => {
  const subRef = `SUB-${submission.reporting_year}-${submissionId.slice(0, 5).toUpperCase()}`;

  const npl         = findKpi(kpiMap, "non_performing_loans");
  const coverage    = findKpi(kpiMap, "loan_loss_coverage");
  const grossLoans  = findKpi(kpiMap, "gross_loan_portfolio");

  const priorCoverage = kpisData?.prior_year_kpis?.find((k) => k.name === "loan_loss_coverage");

  const totalPortfolioBalance = portfolioData.categories.reduce((a, c) => a + c.balance, 0);
  const totalPortfolioCount   = portfolioData.categories.reduce((a, c) => a + c.count, 0);

  const statusBadge = (status?: string | null) => {
    if (status === "green") return <span className="rp-st rp-ok">Meets</span>;
    if (status === "red")   return <span className="rp-st rp-bad">Breach</span>;
    if (status === "amber") return <span className="rp-st rp-warn">Watch</span>;
    return <span className="rp-st rp-na">Unverified</span>;
  };

  return (
    <section className="rp-page">
      <div className="rp-sec">
        <span className="rp-sec-no">5</span>
        <h2>Loan Portfolio Quality &amp; Credit Risk</h2>
        <span className="rp-sec-sub">As at 31 December {submission.reporting_year}</span>
      </div>

      {narratives?.portfolio_quality && (
        <div className="rp-opinion rp-keep">
          <div className="rp-lbl">Portfolio Quality Insights</div>
          <p style={{ margin: 0 }}>{narratives.portfolio_quality}</p>
        </div>
      )}

      {/* Two-column: GL indicators + register breakdown */}
      <div className="rp-two rp-keep">
        <div>
          <h3 style={{ marginTop: 0 }}>Portfolio-at-risk indicators</h3>
          <table className="rp-tbl">
            <thead>
              <tr>
                <th>Indicator</th>
                <th className="rp-num">Prior yr</th>
                <th className="rp-num">Current</th>
                <th className="rp-num">Limit</th>
                <th style={{ width: "20mm" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Loans in arrears</td>
                <td className="rp-num">—</td>
                <td className="rp-num">{npl?.formatted ?? "—"}</td>
                <td className="rp-num">—</td>
                <td><span className="rp-st rp-na">Info</span></td>
              </tr>
              <tr>
                <td>Gross loan portfolio</td>
                <td className="rp-num">—</td>
                <td className="rp-num">{grossLoans?.formatted ?? "—"}</td>
                <td className="rp-num">—</td>
                <td><span className="rp-st rp-na">Info</span></td>
              </tr>
              <tr className="rp-total">
                <td>Loan-loss coverage</td>
                <td className="rp-num">{priorCoverage?.formatted ?? "—"}</td>
                <td className="rp-num">{coverage?.formatted ?? "—"}</td>
                <td className="rp-num">100%</td>
                <td>{statusBadge(coverage?.status)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Portfolio by category (register)</h3>
          <table className="rp-tbl">
            <thead>
              <tr>
                <th>Category</th>
                <th className="rp-num">Count</th>
                <th className="rp-num">Balance</th>
                <th className="rp-num">% of portfolio</th>
              </tr>
            </thead>
            <tbody>
              {portfolioData.categories.length > 0 ? (
                <>
                  {portfolioData.categories.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className="rp-num">{c.count}</td>
                      <td className="rp-num">{formatCurrency(c.balance)}</td>
                      <td className="rp-num">
                        {totalPortfolioBalance > 0
                          ? `${((c.balance / totalPortfolioBalance) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="rp-total">
                    <td>Total</td>
                    <td className="rp-num">{totalPortfolioCount}</td>
                    <td className="rp-num">{formatCurrency(totalPortfolioBalance)}</td>
                    <td className="rp-num">100.0%</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", fontStyle: "italic", color: "var(--ink-3)" }}>
                    No portfolio register data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisory note if coverage is a breach */}
      {coverage?.status === "red" && (
        <div className="rp-note rp-keep">
          <b>Supervisory concern.</b> Loan-loss coverage is below the required 100% threshold.
          The cooperative must establish provisions in line with prudential standards.
        </div>
      )}

      <p className="rp-src" style={{ textAlign: "right", marginTop: "4mm" }}>{subRef}</p>
    </section>
  );
};

export default ReportPortfolioQuality;
