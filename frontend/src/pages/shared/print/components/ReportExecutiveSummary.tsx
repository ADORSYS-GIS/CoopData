import React, { useMemo } from "react";
import { ReportDataProps } from "./types";
import { findKpi, getLineItem, calculateYoY, formatCurrency } from "./utils";

export const ReportExecutiveSummary: React.FC<ReportDataProps> = ({
  submission,
  kpiMap,
  kpisData,
  lineItemsData,
  narratives,
}) => {
  const getVal = (code: number, isPrior = false) => getLineItem(lineItemsData, code, isPrior) ?? 0;
  const sumCodes = (codes: number[], isPrior = false) => codes.reduce((acc, c) => acc + getVal(c, isPrior), 0);

  const currentAssets = getVal(1999) || (sumCodes([1101, 1102]) + sumCodes([1201, 1202]) + sumCodes([5301]) + sumCodes([1301]));
  const priorAssets = getVal(1999, true) || (sumCodes([1101, 1102], true) + sumCodes([1201, 1202], true) + sumCodes([5301], true) + sumCodes([1301], true));

  const currentEquity = getVal(3999) || sumCodes([3101, 3102, 3201, 3202, 3203, 3301, 3302]);
  const priorEquity = getVal(3999, true) || sumCodes([3101, 3102, 3201, 3202, 3203, 3301, 3302], true);

  const currentSavings = getVal(2100) || sumCodes([2101, 2102, 2103]);
  const priorSavings = getVal(2100, true) || sumCodes([2101, 2102, 2103], true);

  const currentSurplus = getVal(6999) || getVal(3302);
  const priorSurplus = getVal(6999, true) || getVal(3302, true);
  
  const currentNetInterest = sumCodes([4101, 4102]) - sumCodes([5101, 5102]);
  const priorNetInterest = sumCodes([4101, 4102], true) - sumCodes([5101, 5102], true);
  const currentOpSurplus = currentNetInterest + sumCodes([4201]) - sumCodes([5201, 5202, 5203, 5204]);
  const priorOpSurplus = priorNetInterest + sumCodes([4201], true) - sumCodes([5201, 5202, 5203, 5204], true);

  const surplusYoY = ((currentSurplus - priorSurplus) / (priorSurplus || 1)) * 100;
  const assetsYoY = ((currentAssets - priorAssets) / (priorAssets || 1)) * 100;
  const equityYoY = ((currentEquity - priorEquity) / (priorEquity || 1)) * 100;
  const savingsYoY = ((currentSavings - priorSavings) / (priorSavings || 1)) * 100;

  const chartData = [
    { label: "Net Interest", prior: priorNetInterest, current: currentNetInterest },
    { label: "Op. Surplus", prior: priorOpSurplus, current: currentOpSurplus },
    { label: "Yr Surplus", prior: priorSurplus, current: currentSurplus },
    { label: "Total Equity", prior: priorEquity, current: currentEquity },
  ];

  const maxVal = Math.max(...chartData.flatMap(d => [d.prior, d.current]), 1);
  const scale = (val: number) => (150 * val) / maxVal;

  return (
    <div className="rp-page">
      <div className="eyebrow">Executive Summary</div>
      <h2 className="section-title">Annual Performance Review</h2>
      <p className="section-intro">
        The cooperative closed the {submission.reporting_year} financial year with steady performance across major measures 
        including surplus, assets, member savings, and equity.
      </p>

      {narratives?.executive_summary ? (
        <div className="box" style={{ marginBottom: "30px" }}>
          <h4>Executive Summary Insights</h4>
          <p>{narratives.executive_summary}</p>
        </div>
      ) : (
        <div className="box-row">
          <div className="box">
            <h4>What drove it</h4>
            <p>Careful management of interest margins and operational efficiency played a key role in the overall financial outcome this year.</p>
          </div>
          <div className="box">
            <h4>What it means for members</h4>
            <p>Continued growth in reserves and equity strengthens the cooperative's capital buffer and ensures long-term stability.</p>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Surplus for the Year</div>
          <div className="kpi-val">{formatCurrency(currentSurplus)}</div>
          <div className={`kpi-delta ${surplusYoY < 0 ? 'neg' : ''}`}>
            {surplusYoY >= 0 ? '▲' : '▼'} {Math.abs(surplusYoY).toFixed(1)}% vs {submission.reporting_year - 1}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Assets</div>
          <div className="kpi-val">{formatCurrency(currentAssets)}</div>
          <div className={`kpi-delta ${assetsYoY < 0 ? 'neg' : ''}`}>
            {assetsYoY >= 0 ? '▲' : '▼'} {Math.abs(assetsYoY).toFixed(1)}% vs {submission.reporting_year - 1}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Equity</div>
          <div className="kpi-val">{formatCurrency(currentEquity)}</div>
          <div className={`kpi-delta ${equityYoY < 0 ? 'neg' : ''}`}>
            {equityYoY >= 0 ? '▲' : '▼'} {Math.abs(equityYoY).toFixed(1)}% vs {submission.reporting_year - 1}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Members' Savings</div>
          <div className="kpi-val">{formatCurrency(currentSavings)}</div>
          <div className={`kpi-delta ${savingsYoY < 0 ? 'neg' : ''}`}>
            {savingsYoY >= 0 ? '▲' : '▼'} {Math.abs(savingsYoY).toFixed(1)}% vs {submission.reporting_year - 1}
          </div>
        </div>
      </div>

      <div className="chart-wrap">
        <div className="chart-title">Key results, {submission.reporting_year - 1} vs {submission.reporting_year}</div>
        <svg viewBox="0 0 780 230" width="100%">
          <line x1="60" y1="190" x2="760" y2="190" stroke="#e2e5ea" strokeWidth="1"/>
          <g fontFamily="sans-serif" fontSize="11" fill="#5b6478">
            {chartData.map((d, i) => {
              const xBase = 100 + i * 160;
              const pH = scale(d.prior);
              const cH = scale(d.current);
              return (
                <g key={i}>
                  <rect x={xBase} y={190 - pH} width="26" height={pH} fill="#1f3159"/>
                  <rect x={xBase + 30} y={190 - cH} width="26" height={cH} fill="#c0392b"/>
                  <text x={xBase + 28} y="210" textAnchor="middle">{d.label}</text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="legend">
          <span><i className="sw a"></i>{submission.reporting_year - 1}</span>
          <span><i className="sw b"></i>{submission.reporting_year}</span>
        </div>
      </div>

      <footer>Cooperative Annual Report · FY {submission.reporting_year}</footer>
      <div className="pageno">2</div>
    </div>
  );
};

export default ReportExecutiveSummary;
