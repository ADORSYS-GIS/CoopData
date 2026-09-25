import React from "react";
import { ReportDataProps } from "./types";
import { findKpi, getLineItem } from "./utils";

// ── 100 % stacked horizontal bar for membership profile ─────────────────
const MembershipStackedChart: React.FC<{
  rows: { label: string; segments: { label: string; value: number; color: string }[] }[];
}> = ({ rows }) => {
  const W = 530;
  const BAR_H = 14;
  const ROW_H = BAR_H + 10;
  const LABEL_W = 60;
  const H = rows.length * ROW_H + 16;
  const SHADES = ["#1f3159", "#c0392b", "#9aa3b5"];

  return (
    <div className="chart-wrap" style={{ marginTop: "20px" }}>
      <div className="chart-title">Membership profile by gender, age, location and status.</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ fontFamily: "sans-serif", overflow: "visible" }}
      >
        {rows.map((row, ri) => {
          const y = ri * ROW_H + 8;
          const total = row.segments.reduce((s, seg) => s + seg.value, 0) || 1;
          let left = LABEL_W;
          return (
            <g key={ri}>
              <text x={0} y={y + BAR_H - 2} fontSize={7.5} fill="#5b6478">{row.label}</text>
              {row.segments.map((seg, si) => {
                const barW = ((W - LABEL_W) * seg.value) / total;
                const pct = ((seg.value / total) * 100).toFixed(0);
                const fill = SHADES[si % SHADES.length];
                const rect = (
                  <g key={si}>
                    <rect x={left} y={y} width={barW} height={BAR_H} fill={fill} />
                    {barW > 24 && (
                      <text
                        x={left + barW / 2}
                        y={y + BAR_H / 2 + 2.5}
                        textAnchor="middle"
                        fontSize={7}
                        fill={si < 2 ? "#fff" : "#1e2a33"}
                      >
                        {seg.label} {pct}%
                      </text>
                    )}
                  </g>
                );
                left += barW;
                return rect;
              })}
            </g>
          );
        })}
        {/* X axis labels */}
        {[0, 25, 50, 75, 100].map((t) => {
          const x = LABEL_W + ((W - LABEL_W) * t) / 100;
          return (
            <g key={t}>
              <line x1={x} x2={x} y1={0} y2={H - 8} stroke="#e2e5ea" strokeWidth={0.5} />
              <text x={x} y={H} textAnchor="middle" fontSize={7} fill="#5b6478">{t}%</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const ReportNonFinancial: React.FC<ReportDataProps> = ({
  membershipData,
  portfolioData,
  kpiMap,
  submission,
  lineItemsData,
  narratives,
}) => {
  const y1 = submission.reporting_year;
  const y0 = submission.reporting_year - 1;

  const totalMembers = (membershipData.active_members ?? 0) + (membershipData.inactive_members ?? 0);
  const female = membershipData.female_members ?? 0;
  const male = membershipData.male_members ?? 0;
  const youth = membershipData.youth_members ?? 0;
  const agm = membershipData.agm_attendance ?? 0;

  const totalLoans = portfolioData.categories.reduce((acc, c) => acc + c.count, 0);
  const grossLoan = findKpi(kpiMap, "gross_loan_portfolio");

  // Stacked chart rows
  const chartRows = [
    {
      label: "Gender",
      segments: [
        { label: "Male", value: male, color: "#1f3159" },
        { label: "Female", value: female, color: "#c0392b" },
      ],
    },
    {
      label: "Age",
      segments: [
        { label: "Youth", value: youth, color: "#1f3159" },
        { label: "Other", value: Math.max(0, totalMembers - youth), color: "#c0392b" },
      ],
    },
    {
      label: "Status",
      segments: [
        { label: "Active", value: membershipData.active_members ?? 0, color: "#1f3159" },
        { label: "Dormant", value: membershipData.inactive_members ?? 0, color: "#c0392b" },
      ],
    },
    {
      label: "AGM",
      segments: [
        { label: "Attended", value: agm, color: "#1f3159" },
        { label: "Absent", value: Math.max(0, totalMembers - agm), color: "#9aa3b5" },
      ],
    },
  ];

  const getVal = (code: number, isPrior = false) => getLineItem(lineItemsData, code, isPrior) ?? 0;
  const sumCodes = (codes: number[], isPrior = false) => codes.reduce((acc, c) => acc + getVal(c, isPrior), 0);
  
  const currentSurplus = getVal(6999) || getVal(3302);
  const priorSurplus = getVal(6999, true) || getVal(3302, true);
  
  const currentNetInterest = sumCodes([4101, 4102]) - sumCodes([5101, 5102]);
  const priorNetInterest = sumCodes([4101, 4102], true) - sumCodes([5101, 5102], true);
  
  const currentOpSurplus = currentNetInterest + sumCodes([4201]) - sumCodes([5201, 5202, 5203, 5204]);
  const priorOpSurplus = priorNetInterest + sumCodes([4201], true) - sumCodes([5201, 5202, 5203, 5204], true);

  const currentEquity = getVal(3999) || sumCodes([3101, 3102, 3201, 3202, 3203, 3301, 3302]); 
  const priorEquity = getVal(3999, true) || sumCodes([3101, 3102, 3201, 3202, 3203, 3301, 3302], true);
  
  const currentAssets = getVal(1999) || (sumCodes([1101, 1102]) + sumCodes([1201, 1202]) + sumCodes([5301]) + sumCodes([1301]));
  const priorAssets = getVal(1999, true) || (sumCodes([1101, 1102], true) + sumCodes([1201, 1202], true) + sumCodes([5301], true) + sumCodes([1301], true));
  
  const currentSavings = getVal(2100) || sumCodes([2101, 2102, 2103]);
  const priorSavings = getVal(2100, true) || sumCodes([2101, 2102, 2103], true);
  
  const currentLoans = sumCodes([1201, 1202]); 
  const priorLoans = sumCodes([1201, 1202], true);

  const calcYoY = (cur: number, prior: number) => {
    if (prior === 0) return 0;
    return ((cur - prior) / Math.abs(prior)) * 100;
  };

  const growths = [
    { label: "Operating surplus", val: calcYoY(currentOpSurplus, priorOpSurplus), type: "is" },
    { label: "Surplus for the year", val: calcYoY(currentSurplus, priorSurplus), type: "is" },
    { label: "Net interest", val: calcYoY(currentNetInterest, priorNetInterest), type: "is" },
    { label: "Total equity", val: calcYoY(currentEquity, priorEquity), type: "bs" },
    { label: "Total assets", val: calcYoY(currentAssets, priorAssets), type: "bs" },
    { label: "Members savings", val: calcYoY(currentSavings, priorSavings), type: "bs" },
    { label: "Loans to members", val: calcYoY(currentLoans, priorLoans), type: "bs" },
  ].sort((a, b) => b.val - a.val);

  const maxGrowth = Math.max(100, ...growths.map(g => Math.abs(g.val)));

  return (
    <>
      {/* ============ PERFORMANCE RATIOS ============ */}
      <div className="rp-page">
        <div className="eyebrow">Performance Ratios</div>
        <h2 className="section-title">Year-on-year growth at a glance</h2>
        <p className="section-intro">
          Taken together, these ratios show a cooperative that grew its core lending business, kept costs proportionate, 
          and converted that growth into a materially larger surplus for members.
        </p>

        {narratives?.non_financial ? (
          <div className="box" style={{ marginBottom: "30px" }}>
            <h4>Performance Insights</h4>
            <p>{narratives.non_financial}</p>
          </div>
        ) : (
          <div className="box-row">
            <div className="box">
              <h4>Outlook</h4>
              <p>With reserves and equity both strengthening, the cooperative enters FY{y1 + 1} with more capacity to grow the loan book further while maintaining its capital buffer.</p>
            </div>
            <div className="box">
              <h4>For the Board's attention</h4>
              <p>Operating expenses and current liabilities remain a meaningful share of funding — worth monitoring alongside the pace of loan book growth.</p>
            </div>
          </div>
        )}

        <div className="chart-wrap">
          <div className="chart-title">Growth rate by line item, FY{y0} → FY{y1} — sorted highest to lowest</div>
          <svg viewBox="0 0 780 280" width="100%">
            <g fontFamily="sans-serif" fontSize="12" fill="#5b6478">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(pct => {
                const x = 220 + (pct / maxGrowth) * 500;
                if (pct > maxGrowth && pct !== 0) return null; // hide lines beyond max
                return (
                  <g key={pct}>
                    <line x1={x} y1="10" x2={x} y2="240" stroke="#e2e5ea" strokeWidth={1}/>
                    <text x={x} y="255" textAnchor="middle" fontSize="10">{pct}%</text>
                  </g>
                )
              })}
              
              <line x1="220" y1="10" x2="220" y2="240" stroke="#e2e5ea" strokeWidth={1}/>
              
              {growths.map((g, i) => {
                const yPos = 34 + i * 32;
                const width = (Math.abs(g.val) / maxGrowth) * 500;
                const isPos = g.val >= 0;
                const color = g.type === "is" ? "#c0392b" : "#1f3159";
                
                let xEnd = 220;
                if (g.val === 0) {
                  xEnd = 220;
                } else if (isPos) {
                  xEnd = 220 + width;
                } else {
                  xEnd = 220 - width;
                }

                return (
                  <g key={g.label}>
                    <text x="210" y={yPos + 4} textAnchor="end">{g.label}</text>
                    {width > 0 && <line x1="220" y1={yPos} x2={xEnd} y2={yPos} stroke={color} strokeWidth="2"/>}
                    {width > 0 && <circle cx={xEnd} cy={yPos} r="5.5" fill={color}/>}
                    <text x={isPos || g.val === 0 ? xEnd + 12 : xEnd - 12} y={yPos + 4} textAnchor={isPos || g.val === 0 ? "start" : "end"} fill={color} fontWeight="bold">
                      {g.val === 0 ? "0.0%" : `${isPos ? "+" : ""}${g.val.toFixed(1)}%`}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="legend" style={{marginTop: "10px", paddingLeft: "20px"}}>
            <span><i className="sw" style={{backgroundColor: "#c0392b"}}></i>Income statement</span>
            <span><i className="sw" style={{backgroundColor: "#1f3159"}}></i>Balance sheet</span>
          </div>
        </div>
        <footer>Cooperative Annual Report · FY {y1}</footer>
        <div className="pageno">6</div>
      </div>

      {/* ============ MEMBERSHIP & GOVERNANCE ============ */}
      <div className="rp-page">
        <div className="eyebrow">Membership &amp; Inclusion</div>
        <h2 className="section-title">Membership, Governance &amp; Inclusion</h2>
        <p className="section-intro">
          Membership profile breakdown as at 31 December {y1}.
        </p>

        {totalMembers > 0 && <MembershipStackedChart rows={chartRows} />}

        <div className="box-row" style={{ marginTop: "30px" }}>
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy)", fontFamily: "sans-serif" }}>Membership</h4>
            <table>
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th className="num">Number</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total members</td>
                  <td className="num">{totalMembers}</td>
                  <td className="num">100.0%</td>
                </tr>
                <tr>
                  <td>Active / dormant</td>
                  <td className="num">
                    {membershipData.active_members} / {membershipData.inactive_members}
                  </td>
                  <td className="num">
                    {totalMembers > 0
                      ? `${Math.round(((membershipData.active_members ?? 0) / totalMembers) * 100)} / ${Math.round(((membershipData.inactive_members ?? 0) / totalMembers) * 100)}%`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td>Women</td>
                  <td className="num">{female}</td>
                  <td className="num">
                    {totalMembers > 0 ? `${((female / totalMembers) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
                <tr>
                  <td>Youth (18–35)</td>
                  <td className="num">{youth}</td>
                  <td className="num">
                    {totalMembers > 0 ? `${((youth / totalMembers) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
                <tr>
                  <td>AGM attendance</td>
                  <td className="num">{agm}</td>
                  <td className="num">
                    {totalMembers > 0 ? `${((agm / totalMembers) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy)", fontFamily: "sans-serif" }}>Loan portfolio</h4>
            <table>
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th className="num">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total active loans</td>
                  <td className="num">{totalLoans}</td>
                </tr>
                <tr>
                  <td>Gross loan portfolio</td>
                  <td className="num">{grossLoan?.formatted?.replace('$', '') ?? "—"}</td>
                </tr>
                {portfolioData.categories.map((cat) => (
                  <tr key={cat.category}>
                    <td>{cat.category}</td>
                    <td className="num">{cat.count} loans</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Sign-off block */}
        <h3 style={{ marginTop: "40px", fontSize: "16px", fontFamily: "Georgia, serif" }}>Approval &amp; Sign-Off</h3>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
          <div>
            <div style={{ width: "200px", height: "40px", borderBottom: "1px solid #1f3159", marginBottom: "8px" }} />
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1f3159" }}>Prepared by</div>
            <div style={{ fontSize: "10px", color: "#5b6478" }}>Name, designation &amp; date</div>
          </div>
          <div>
            <div style={{ width: "200px", height: "40px", borderBottom: "1px solid #1f3159", marginBottom: "8px" }} />
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1f3159" }}>Reviewed by</div>
            <div style={{ fontSize: "10px", color: "#5b6478" }}>Name, designation &amp; date</div>
          </div>
          <div>
            <div style={{ width: "200px", height: "40px", borderBottom: "1px solid #1f3159", marginBottom: "8px" }} />
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1f3159" }}>Approved by</div>
            <div style={{ fontSize: "10px", color: "#5b6478" }}>Name, designation &amp; date</div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "60px", fontSize: "10px", color: "#9aa3b5", letterSpacing: "0.1em" }}>END OF REPORT</div>

        <footer>Cooperative Annual Report · FY {y1}</footer>
        <div className="pageno">7</div>
      </div>
    </>
  );
};

export default ReportNonFinancial;
