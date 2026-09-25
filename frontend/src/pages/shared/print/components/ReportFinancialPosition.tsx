import React from "react";
import { ReportDataProps } from "./types";
import { getLineItem, formatCurrency } from "./utils";

export const ReportFinancialPosition: React.FC<ReportDataProps> = ({
  submission,
  lineItemsData,
  narratives,
}) => {
  const getVal = (code: number, isPrior = false) => getLineItem(lineItemsData, code, isPrior) ?? 0;
  const sumCodes = (codes: number[], isPrior = false) => codes.reduce((acc, c) => acc + getVal(c, isPrior), 0);

  const y1 = submission.reporting_year;
  const y0 = submission.reporting_year - 1;

  // --- INCOME STATEMENT ---
  const finIncome1 = sumCodes([4101, 4102]); const finIncome0 = sumCodes([4101, 4102], true);
  const finExp1 = sumCodes([5101, 5102]); const finExp0 = sumCodes([5101, 5102], true);
  const netInt1 = finIncome1 - finExp1; const netInt0 = finIncome0 - finExp0;
  
  const otherInc1 = sumCodes([4201]); const otherInc0 = sumCodes([4201], true);
  const opExp1 = sumCodes([5201, 5202, 5203, 5204]); const opExp0 = sumCodes([5201, 5202, 5203, 5204], true);
  const prov1 = sumCodes([5301]); const prov0 = sumCodes([5301], true);
  
  const totalInc1 = getVal(4999) || (finIncome1 + otherInc1); 
  const totalInc0 = getVal(4999, true) || (finIncome0 + otherInc0);
  const totalExp1 = getVal(5999) || (finExp1 + opExp1 + prov1); 
  const totalExp0 = getVal(5999, true) || (finExp0 + opExp0 + prov0);
  const surplus1 = getVal(6999) || getVal(3302); 
  const surplus0 = getVal(6999, true) || getVal(3302, true);

  // --- ASSETS ---
  const cash1 = sumCodes([1101, 1102]); const cash0 = sumCodes([1101, 1102], true);
  const loans1 = sumCodes([1201, 1202]); const loans0 = sumCodes([1201, 1202], true);
  const otherAssets1 = sumCodes([1301]); const otherAssets0 = sumCodes([1301], true);
  const totalAssets1 = getVal(1999) || (cash1 + loans1 + prov1 + otherAssets1); 
  const totalAssets0 = getVal(1999, true) || (cash0 + loans0 + prov0 + otherAssets0);

  // --- LIABILITIES & EQUITY ---
  const deposits1 = getVal(2100) || sumCodes([2101, 2102, 2103]); 
  const deposits0 = getVal(2100, true) || sumCodes([2101, 2102, 2103], true);
  const otherLiab1 = sumCodes([2201]); const otherLiab0 = sumCodes([2201], true);
  const totalLiab1 = getVal(2999) || (deposits1 + otherLiab1); 
  const totalLiab0 = getVal(2999, true) || (deposits0 + otherLiab0);
  const equity1 = getVal(3999) || sumCodes([3101, 3102, 3201, 3202, 3203, 3301, 3302]); 
  const equity0 = getVal(3999, true) || sumCodes([3101, 3102, 3201, 3202, 3203, 3301, 3302], true);

  return (
    <>
      {/* ============ INCOME STATEMENT ============ */}
      <div className="rp-page">
        <div className="eyebrow">Statement of Comprehensive Income</div>
        <h2 className="section-title">Income and surplus</h2>
        <p className="section-intro">
          The statement below shows how the cooperative's income from loans and other sources converted 
          into an operating and overall surplus for members.
        </p>

        {narratives?.financial_position ? (
          <div className="box" style={{ marginBottom: "30px" }}>
            <h4>Financial Position Insights</h4>
            <p>{narratives.financial_position}</p>
          </div>
        ) : (
          <div className="box-row">
            <div className="box">
              <h4>Reading this statement</h4>
              <p>Financial income from the loan portfolio remains the primary driver of revenue, set against the cost of funding and operations.</p>
            </div>
            <div className="box">
              <h4>Watch point</h4>
              <p>Operating expenses and provisions for credit losses are key factors in determining the final net surplus generated.</p>
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr><th>Figures in Local Currency</th><th className="num">{y1}</th><th className="num">{y0}</th></tr>
          </thead>
          <tbody>
            <tr><td>Financial Income</td><td className="num">{formatCurrency(finIncome1)}</td><td className="num">{formatCurrency(finIncome0)}</td></tr>
            <tr><td>Financial Expenses</td><td className="num">({formatCurrency(finExp1)})</td><td className="num">({formatCurrency(finExp0)})</td></tr>
            <tr className="total"><td>Net Interest</td><td className="num">{formatCurrency(netInt1)}</td><td className="num">{formatCurrency(netInt0)}</td></tr>
            <tr><td>Other Income</td><td className="num">{formatCurrency(otherInc1)}</td><td className="num">{formatCurrency(otherInc0)}</td></tr>
            <tr><td>Operating Expenses</td><td className="num">({formatCurrency(opExp1)})</td><td className="num">({formatCurrency(opExp0)})</td></tr>
            <tr><td>Provisions / Credit Loss</td><td className="num">({formatCurrency(prov1)})</td><td className="num">({formatCurrency(prov0)})</td></tr>
            <tr className="total"><td>Surplus for the year</td><td className="num">{formatCurrency(surplus1)}</td><td className="num">{formatCurrency(surplus0)}</td></tr>
          </tbody>
        </table>

        <div className="chart-wrap">
          <div className="chart-title">Financial Income vs. Expenses (Local Currency)</div>
          <svg viewBox="0 0 780 190" width="100%">
            <line x1="60" y1="160" x2="760" y2="160" stroke="#e2e5ea"/>
            <g fontFamily="sans-serif" fontSize="11" fill="#5b6478">
              {(() => {
                const absInc0 = Math.abs(finIncome0);
                const absInc1 = Math.abs(finIncome1);
                const absExp0 = Math.abs(totalExp0);
                const absExp1 = Math.abs(totalExp1);
                const max = Math.max(absInc0, absInc1, absExp0, absExp1, 1);
                const scale = (v: number) => (120 * v) / max;
                return (
                  <>
                    <rect x="140" y={160 - scale(absInc0)} width="40" height={scale(absInc0)} fill="#1f3159"/>
                    <text x="160" y="180" textAnchor="middle">Income '{y0.toString().slice(2)}</text>
                    
                    <rect x="220" y={160 - scale(absInc1)} width="40" height={scale(absInc1)} fill="#1f3159"/>
                    <text x="240" y="180" textAnchor="middle">Income '{y1.toString().slice(2)}</text>
                    
                    <rect x="380" y={160 - scale(absExp0)} width="40" height={scale(absExp0)} fill="#c0392b"/>
                    <text x="400" y="180" textAnchor="middle">Expense '{y0.toString().slice(2)}</text>
                    
                    <rect x="460" y={160 - scale(absExp1)} width="40" height={scale(absExp1)} fill="#c0392b"/>
                    <text x="480" y="180" textAnchor="middle">Expense '{y1.toString().slice(2)}</text>
                  </>
                )
              })()}
            </g>
          </svg>
        </div>
        <footer>Cooperative Annual Report · FY {y1}</footer>
        <div className="pageno">3</div>
      </div>

      {/* ============ BALANCE SHEET - ASSETS ============ */}
      <div className="rp-page">
        <div className="eyebrow">Statement of Financial Position — Assets</div>
        <h2 className="section-title">What the Cooperative owns</h2>
        <p className="section-intro">
          The asset base is primarily composed of loans issued to members, supported by cash reserves and other assets held for liquidity and operations.
        </p>

        {!narratives?.financial_position && (
          <div className="box" style={{ marginBottom: "20px" }}>
            <h4>Reading this statement</h4>
            <p>Loans to members — the core earning asset — typically make up the vast majority of the balance sheet, acting as the primary engine behind total asset growth.</p>
          </div>
        )}

        <table>
          <thead>
            <tr><th>Figures in Local Currency</th><th className="num">{y1}</th><th className="num">{y0}</th></tr>
          </thead>
          <tbody>
            <tr><td>Cash and Liquid Assets</td><td className="num">{formatCurrency(cash1)}</td><td className="num">{formatCurrency(cash0)}</td></tr>
            <tr><td>Gross Loan Portfolio</td><td className="num">{formatCurrency(loans1)}</td><td className="num">{formatCurrency(loans0)}</td></tr>
            <tr><td>Other Assets</td><td className="num">{formatCurrency(otherAssets1)}</td><td className="num">{formatCurrency(otherAssets0)}</td></tr>
            <tr className="total"><td>Total Assets</td><td className="num">{formatCurrency(totalAssets1)}</td><td className="num">{formatCurrency(totalAssets0)}</td></tr>
          </tbody>
        </table>

        <div className="chart-wrap">
          <div className="chart-title">Asset composition, {y1}</div>
          <svg viewBox="0 0 780 60" width="100%">
            <g>
              {(() => {
                const total = Math.max(totalAssets1, 1);
                const wLoans = (loans1 / total) * 760;
                const wCash = (cash1 / total) * 760;
                const wOther = (otherAssets1 / total) * 760;
                return (
                  <>
                    <rect x="10" y="15" width={wLoans} height="28" fill="#1f3159"/>
                    <rect x={10 + wLoans} y="15" width={wCash} height="28" fill="#c0392b"/>
                    <rect x={10 + wLoans + wCash} y="15" width={wOther} height="28" fill="#9aa3b5"/>
                  </>
                )
              })()}
            </g>
            <g fontFamily="sans-serif" fontSize="10.5" fill="#5b6478">
              <text x="10" y="55">Loans: {((loans1 / Math.max(totalAssets1, 1))*100).toFixed(0)}%</text>
              <text x="400" y="55">Cash: {((cash1 / Math.max(totalAssets1, 1))*100).toFixed(0)}%</text>
              <text x="600" y="55">Other: {((otherAssets1 / Math.max(totalAssets1, 1))*100).toFixed(0)}%</text>
            </g>
          </svg>
        </div>
        <footer>Cooperative Annual Report · FY {y1}</footer>
        <div className="pageno">4</div>
      </div>

      {/* ============ BALANCE SHEET - EQUITY & LIABILITIES ============ */}
      <div className="rp-page">
        <div className="eyebrow">Statement of Financial Position — Equity &amp; Liabilities</div>
        <h2 className="section-title">How the Cooperative is funded</h2>
        <p className="section-intro">
          Growth is funded mainly by member savings and deposits, with equity providing the foundational capital base.
        </p>

        {!narratives?.financial_position && (
          <div className="box" style={{ marginBottom: "20px" }}>
            <h4>Reading this statement</h4>
            <p>A strong equity base relative to liabilities ensures the cooperative remains resilient and capable of absorbing potential shocks while meeting withdrawal demands.</p>
          </div>
        )}

        <table>
          <thead>
            <tr><th>Figures in Local Currency</th><th className="num">{y1}</th><th className="num">{y0}</th></tr>
          </thead>
          <tbody>
            <tr className="sub"><td>Equity</td><td className="num"></td><td className="num"></td></tr>
            <tr className="total"><td>Total Equity</td><td className="num">{formatCurrency(equity1)}</td><td className="num">{formatCurrency(equity0)}</td></tr>
            <tr className="sub"><td>Liabilities</td><td className="num"></td><td className="num"></td></tr>
            <tr><td>Total Member Deposits</td><td className="num">{formatCurrency(deposits1)}</td><td className="num">{formatCurrency(deposits0)}</td></tr>
            <tr><td>Other Liabilities</td><td className="num">{formatCurrency(otherLiab1)}</td><td className="num">{formatCurrency(otherLiab0)}</td></tr>
            <tr className="total"><td>Total Liabilities</td><td className="num">{formatCurrency(totalLiab1)}</td><td className="num">{formatCurrency(totalLiab0)}</td></tr>
            <tr className="total"><td>Total Equity &amp; Liabilities</td><td className="num">{formatCurrency(totalAssets1)}</td><td className="num">{formatCurrency(totalAssets0)}</td></tr>
          </tbody>
        </table>

        <div className="chart-wrap">
          <div className="chart-title">Equity vs. Liabilities, {y0} vs {y1}</div>
          <svg viewBox="0 0 780 200" width="100%">
            <line x1="60" y1="170" x2="760" y2="170" stroke="#e2e5ea"/>
            <g fontFamily="sans-serif" fontSize="11" fill="#5b6478">
              {(() => {
                const max = Math.max(equity0, equity1, totalLiab0, totalLiab1, 1);
                const scale = (v: number) => (150 * v) / max;
                return (
                  <>
                    <rect x="180" y={170 - scale(equity0)} width="46" height={scale(equity0)} fill="#1f3159"/>
                    <text x="203" y="185" textAnchor="middle">Equity '{y0.toString().slice(2)}</text>
                    
                    <rect x="260" y={170 - scale(equity1)} width="46" height={scale(equity1)} fill="#1f3159"/>
                    <text x="283" y="185" textAnchor="middle">Equity '{y1.toString().slice(2)}</text>
                    
                    <rect x="440" y={170 - scale(totalLiab0)} width="46" height={scale(totalLiab0)} fill="#c0392b"/>
                    <text x="463" y="185" textAnchor="middle">Liabilities '{y0.toString().slice(2)}</text>
                    
                    <rect x="520" y={170 - scale(totalLiab1)} width="46" height={scale(totalLiab1)} fill="#c0392b"/>
                    <text x="543" y="185" textAnchor="middle">Liabilities '{y1.toString().slice(2)}</text>
                  </>
                );
              })()}
            </g>
          </svg>
          <div className="legend"><span><i className="sw a"></i>Equity</span><span><i className="sw b"></i>Liabilities</span></div>
        </div>
        <footer>Cooperative Annual Report · FY {y1}</footer>
        <div className="pageno">5</div>
      </div>
    </>
  );
};

export default ReportFinancialPosition;
