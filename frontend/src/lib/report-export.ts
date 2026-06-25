import type { BalanceSheet } from "./financial-data";
import type {
  FinancialKPIs,
  MembershipKPIs,
  LoanKPIs,
  SavingsKPIs,
  FixedDepositKPIs,
} from "./kpi-calculations";

export interface ReportData {
  cooperativeName: string;
  reportingPeriod: string;
  generatedAt: string;
  balanceSheet: BalanceSheet | null;
  financialKPIs: FinancialKPIs | null;
  membershipKPIs: MembershipKPIs | null;
  loanKPIs: LoanKPIs | null;
  savingsKPIs: SavingsKPIs | null;
  fdKPIs: FixedDepositKPIs | null;
}

export function formatCurrency(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

export function generateCSV(data: ReportData): string {
  const rows: (string | number | undefined)[][] = [];

  // Header
  rows.push(["CoopData Financial Report"]);
  rows.push(["Cooperative", data.cooperativeName]);
  rows.push(["Reporting Period", data.reportingPeriod]);
  rows.push(["Generated", data.generatedAt]);
  rows.push([]);

  // Financial KPIs
  if (data.financialKPIs) {
    rows.push(["=== FINANCIAL KPIs ==="]);
    rows.push(["Metric", "Value", "Unit", "Status", "Benchmark"]);

    const kpi = data.financialKPIs;
    rows.push(["Total Assets", kpi.totalAssets.formatted, kpi.totalAssets.unit]);
    rows.push([
      "Gross Loan Portfolio",
      kpi.grossLoanPortfolio.formatted,
      kpi.grossLoanPortfolio.unit,
    ]);
    rows.push(["Net Loan Portfolio", kpi.netLoanPortfolio.formatted, kpi.netLoanPortfolio.unit]);
    rows.push(["Member Deposits", kpi.totalMemberDeposits.formatted, kpi.totalMemberDeposits.unit]);
    rows.push(["Total Equity", kpi.totalEquity.formatted, kpi.totalEquity.unit]);
    rows.push([]);

    rows.push(["--- Portfolio Quality ---"]);
    rows.push([
      "PAR 30",
      kpi.par30.formatted,
      kpi.par30.unit,
      kpi.par30.status,
      kpi.par30.benchmark?.toString(),
    ]);
    rows.push([
      "PAR 60",
      kpi.par60.formatted,
      kpi.par60.unit,
      kpi.par60.status,
      kpi.par60.benchmark?.toString(),
    ]);
    rows.push([
      "PAR 90",
      kpi.par90.formatted,
      kpi.par90.unit,
      kpi.par90.status,
      kpi.par90.benchmark?.toString(),
    ]);
    rows.push([
      "Loan Loss Coverage",
      kpi.loanLossCoverage.formatted,
      kpi.loanLossCoverage.unit,
      kpi.loanLossCoverage.status,
      kpi.loanLossCoverage.benchmark?.toString(),
    ]);
    rows.push([]);

    rows.push(["--- Profitability ---"]);
    rows.push([
      "ROA",
      kpi.roa.formatted,
      kpi.roa.unit,
      kpi.roa.status,
      kpi.roa.benchmark?.toString(),
    ]);
    rows.push([
      "ROE",
      kpi.roe.formatted,
      kpi.roe.unit,
      kpi.roe.status,
      kpi.roe.benchmark?.toString(),
    ]);
    rows.push([
      "Operating Expense Ratio",
      kpi.operatingExpenseRatio.formatted,
      kpi.operatingExpenseRatio.unit,
      kpi.operatingExpenseRatio.status,
      kpi.operatingExpenseRatio.benchmark?.toString(),
    ]);
    rows.push(["Net Interest Margin", kpi.netInterestMargin.formatted, kpi.netInterestMargin.unit]);
    rows.push([]);

    rows.push(["--- Liquidity ---"]);
    rows.push([
      "Current Ratio",
      kpi.currentRatio.formatted,
      kpi.currentRatio.unit,
      kpi.currentRatio.status,
      kpi.currentRatio.benchmark?.toString(),
    ]);
    rows.push([
      "Capital Adequacy",
      kpi.capitalAdequacyRatio.formatted,
      kpi.capitalAdequacyRatio.unit,
      kpi.capitalAdequacyRatio.status,
      kpi.capitalAdequacyRatio.benchmark?.toString(),
    ]);
    rows.push([]);
  }

  // Membership KPIs
  if (data.membershipKPIs) {
    rows.push(["=== MEMBERSHIP KPIs ==="]);
    const m = data.membershipKPIs;
    rows.push(["Total Members", m.totalMembers.formatted, m.totalMembers.unit]);
    rows.push([
      "Growth Rate",
      m.membershipGrowthRate.formatted,
      m.membershipGrowthRate.unit,
      m.membershipGrowthRate.status,
    ]);
    rows.push([
      "Dormancy Rate",
      m.dormancyRate.formatted,
      m.dormancyRate.unit,
      m.dormancyRate.status,
      m.dormancyRate.benchmark?.toString(),
    ]);
    rows.push([
      "Exit Rate",
      m.exitRate.formatted,
      m.exitRate.unit,
      m.exitRate.status,
      m.exitRate.benchmark?.toString(),
    ]);
    rows.push([
      "Active Members",
      m.activeMembersRatio.formatted,
      m.activeMembersRatio.unit,
      m.activeMembersRatio.status,
      m.activeMembersRatio.benchmark?.toString(),
    ]);
    rows.push(["Women Members", m.womenMembersPercent.formatted, m.womenMembersPercent.unit]);
    rows.push(["Youth Members", m.youthMembersPercent.formatted, m.youthMembersPercent.unit]);
    rows.push([]);
  }

  // Loan KPIs
  if (data.loanKPIs) {
    rows.push(["=== LOAN KPIs ==="]);
    const l = data.loanKPIs;
    rows.push(["Credit Penetration", l.creditPenetration.formatted, l.creditPenetration.unit]);
    rows.push([
      "On-Time Repayment",
      l.onTimeRepaymentRatio.formatted,
      l.onTimeRepaymentRatio.unit,
      l.onTimeRepaymentRatio.status,
      l.onTimeRepaymentRatio.benchmark?.toString(),
    ]);
    rows.push([
      "Loans in Arrears",
      l.loansInArrearsPercent.formatted,
      l.loansInArrearsPercent.unit,
      l.loansInArrearsPercent.status,
      l.loansInArrearsPercent.benchmark?.toString(),
    ]);
    rows.push(["Women Borrowers", l.womenBorrowersPercent.formatted, l.womenBorrowersPercent.unit]);
    rows.push(["Youth Borrowers", l.youthBorrowersPercent.formatted, l.youthBorrowersPercent.unit]);
    rows.push([]);
  }

  return rows.map((row) => row.join(",")).join("\n");
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function generatePDFContent(data: ReportData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Financial Report - ${data.cooperativeName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #4361ee; padding-bottom: 10px; }
    h2 { color: #4361ee; margin-top: 30px; }
    .meta { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px; }
    .kpi-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; }
    .kpi-label { font-size: 12px; color: #666; }
    .kpi-value { font-size: 24px; font-weight: bold; color: #1a1a2e; margin: 5px 0; }
    .kpi-unit { font-size: 14px; color: #888; }
    .status-green { color: #22c55e; }
    .status-amber { color: #f59e0b; }
    .status-red { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f8f9fa; font-weight: bold; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>Financial Report</h1>
  
  <div class="meta">
    <strong>Cooperative:</strong> ${data.cooperativeName}<br>
    <strong>Reporting Period:</strong> ${data.reportingPeriod}<br>
    <strong>Generated:</strong> ${data.generatedAt}
  </div>
  
  ${
    data.financialKPIs
      ? `
  <h2>Financial KPIs</h2>
  
  <h3>Size & Market Structure</h3>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Assets</div>
      <div class="kpi-value">${data.financialKPIs.totalAssets.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Gross Loan Portfolio</div>
      <div class="kpi-value">${data.financialKPIs.grossLoanPortfolio.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Member Deposits</div>
      <div class="kpi-value">${data.financialKPIs.totalMemberDeposits.formatted}</div>
    </div>
  </div>
  
  <h3>Portfolio Quality</h3>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">PAR 30 (>30 days)</div>
      <div class="kpi-value ${data.financialKPIs.par30.status === "green" ? "status-green" : data.financialKPIs.par30.status === "amber" ? "status-amber" : "status-red"}">${data.financialKPIs.par30.formatted}</div>
      <div class="kpi-unit">Target: &lt;5%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">PAR 90 (>90 days)</div>
      <div class="kpi-value ${data.financialKPIs.par90.status === "green" ? "status-green" : data.financialKPIs.par90.status === "amber" ? "status-amber" : "status-red"}">${data.financialKPIs.par90.formatted}</div>
      <div class="kpi-unit">Target: &lt;2%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Loan Loss Coverage</div>
      <div class="kpi-value ${data.financialKPIs.loanLossCoverage.status === "green" ? "status-green" : "status-amber"}">${data.financialKPIs.loanLossCoverage.formatted}</div>
      <div class="kpi-unit">Target: &gt;100%</div>
    </div>
  </div>
  
  <h3>Profitability</h3>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Return on Assets (ROA)</div>
      <div class="kpi-value ${data.financialKPIs.roa.status === "green" ? "status-green" : "status-amber"}">${data.financialKPIs.roa.formatted}</div>
      <div class="kpi-unit">Target: &gt;3%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Return on Equity (ROE)</div>
      <div class="kpi-value ${data.financialKPIs.roe.status === "green" ? "status-green" : "status-amber"}">${data.financialKPIs.roe.formatted}</div>
      <div class="kpi-unit">Target: &gt;8%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Operating Expense Ratio</div>
      <div class="kpi-value ${data.financialKPIs.operatingExpenseRatio.status === "green" ? "status-green" : "status-amber"}">${data.financialKPIs.operatingExpenseRatio.formatted}</div>
      <div class="kpi-unit">Target: &lt;5%</div>
    </div>
  </div>
  
  <h3>Liquidity & Solvency</h3>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Current Ratio</div>
      <div class="kpi-value ${data.financialKPIs.currentRatio.status === "green" ? "status-green" : "status-amber"}">${data.financialKPIs.currentRatio.formatted}</div>
      <div class="kpi-unit">Target: &gt;1.0</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Capital Adequacy Ratio</div>
      <div class="kpi-value ${data.financialKPIs.capitalAdequacyRatio.status === "green" ? "status-green" : "status-amber"}">${data.financialKPIs.capitalAdequacyRatio.formatted}</div>
      <div class="kpi-unit">Target: &gt;10%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Debt-to-Equity</div>
      <div class="kpi-value ${data.financialKPIs.debtToEquity.status === "green" ? "status-green" : "status-amber"}">${data.financialKPIs.debtToEquity.formatted}</div>
      <div class="kpi-unit">Target: &lt;3.0x</div>
    </div>
  </div>
  `
      : ""
  }
  
  ${
    data.membershipKPIs
      ? `
  <h2>Membership KPIs</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Members</div>
      <div class="kpi-value">${data.membershipKPIs.totalMembers.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Growth Rate</div>
      <div class="kpi-value ${data.membershipKPIs.membershipGrowthRate.status === "green" ? "status-green" : "status-amber"}">${data.membershipKPIs.membershipGrowthRate.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Dormancy Rate</div>
      <div class="kpi-value ${data.membershipKPIs.dormancyRate.status === "green" ? "status-green" : "status-amber"}">${data.membershipKPIs.dormancyRate.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Women Members</div>
      <div class="kpi-value">${data.membershipKPIs.womenMembersPercent.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Youth Members</div>
      <div class="kpi-value">${data.membershipKPIs.youthMembersPercent.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">AGM Participation</div>
      <div class="kpi-value">${data.membershipKPIs.agmParticipationRate.formatted}</div>
    </div>
  </div>
  `
      : ""
  }
  
  ${
    data.loanKPIs
      ? `
  <h2>Loan KPIs</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Credit Penetration</div>
      <div class="kpi-value">${data.loanKPIs.creditPenetration.formatted}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">On-Time Repayment</div>
      <div class="kpi-value ${data.loanKPIs.onTimeRepaymentRatio.status === "green" ? "status-green" : "status-amber"}">${data.loanKPIs.onTimeRepaymentRatio.formatted}</div>
      <div class="kpi-unit">Target: &gt;75%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Loans in Arrears</div>
      <div class="kpi-value ${data.loanKPIs.loansInArrearsPercent.status === "green" ? "status-green" : "status-amber"}">${data.loanKPIs.loansInArrearsPercent.formatted}</div>
      <div class="kpi-unit">Target: &lt;20%</div>
    </div>
  </div>
  `
      : ""
  }
  
  <div class="footer">
    <p>Generated by CoopData Platform - Ministry of Commerce & Cooperative Development, Eswatini</p>
    <p>This report is for internal use only and should be treated as confidential.</p>
  </div>
</body>
</html>
  `;
}

export function downloadPDF(htmlContent: string, filename: string): void {
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

export function generateBalanceSheetCSV(balanceSheet: BalanceSheet): string {
  const rows: (string | number | undefined)[][] = [];

  rows.push(["Balance Sheet", balanceSheet.cooperativeName]);
  rows.push(["Reporting Period", balanceSheet.reportingPeriod]);
  rows.push(["Generated", balanceSheet.submissionDate]);
  rows.push([]);

  rows.push(["=== ASSETS ==="]);
  rows.push([]);
  rows.push(["--- Liquid Assets (1100) ---"]);
  rows.push(["Cash on Hand (1101)", balanceSheet.liquidAssets.cashOnHand]);
  rows.push(["Cash at Bank - Current (1102)", balanceSheet.liquidAssets.cashAtBankCurrent]);
  rows.push(["Cash at Bank - Savings (1103)", balanceSheet.liquidAssets.cashAtBankSavings]);
  rows.push(["Short-term Investments (1104)", balanceSheet.liquidAssets.shortTermInvestments]);
  rows.push([]);

  rows.push(["--- Loans & Advances (1200) ---"]);
  rows.push(["Performing Loans (1201)", balanceSheet.loanPortfolio.performingLoanPortfolio]);
  rows.push(["Loans in Arrears 1-30 Days (1202)", balanceSheet.loanPortfolio.loansInArrears_1_30]);
  rows.push([
    "Loans in Arrears 31-60 Days (1203)",
    balanceSheet.loanPortfolio.loansInArrears_31_60,
  ]);
  rows.push([
    "Loans in Arrears 61-90 Days (1204)",
    balanceSheet.loanPortfolio.loansInArrears_61_90,
  ]);
  rows.push(["Non-Performing Loans (1205)", balanceSheet.loanPortfolio.nonPerformingLoans]);
  rows.push([]);

  rows.push([
    "Other Assets (1300)",
    balanceSheet.otherAssets.accountsReceivable +
      balanceSheet.otherAssets.prepaidExpenses +
      balanceSheet.otherAssets.fixedAssetsCost +
      balanceSheet.otherAssets.intangibleAssets,
  ]);
  rows.push([]);

  rows.push(["=== LIABILITIES ==="]);
  rows.push([]);
  rows.push(["--- Member Deposits (2100) ---"]);
  rows.push(["Voluntary Savings (2101)", balanceSheet.memberDeposits.voluntarySavings]);
  rows.push(["Mandatory Savings (2102)", balanceSheet.memberDeposits.mandatorySavings]);
  rows.push(["Fixed/Term Deposits (2103)", balanceSheet.memberDeposits.fixedTermDeposits]);
  rows.push([]);

  rows.push(["--- Borrowings (2200) ---"]);
  rows.push(["Short-term Borrowings (2201)", balanceSheet.borrowings.shortTermBorrowings]);
  rows.push(["Long-term Borrowings (2202)", balanceSheet.borrowings.longTermBorrowings]);
  rows.push([]);

  rows.push(["=== EQUITY ==="]);
  rows.push([]);
  rows.push(["--- Member Shares (3100) ---"]);
  rows.push(["Permanent Share Capital (3101)", balanceSheet.memberShares.permanentShareCapital]);
  rows.push(["Withdrawable Shares (3102)", balanceSheet.memberShares.withdrawableShares]);
  rows.push([]);

  rows.push(["--- Reserves (3200) ---"]);
  rows.push(["Statutory Reserve (3201)", balanceSheet.reserves.statutoryReserve]);
  rows.push(["General Reserve (3202)", balanceSheet.reserves.generalReserve]);
  rows.push(["Risk Capital Reserve (3203)", balanceSheet.reserves.riskCapitalAdequacyReserve]);
  rows.push([]);

  rows.push([
    "Retained Earnings (3300)",
    balanceSheet.retainedEarnings.accumulatedSurplus +
      balanceSheet.retainedEarnings.currentYearSurplus,
  ]);
  rows.push([]);

  rows.push(["=== INCOME STATEMENT ==="]);
  rows.push([]);
  rows.push(["Interest Income on Loans (4101)", balanceSheet.financialIncome.interestIncomeLoans]);
  rows.push(["Fees & Commissions (4102)", balanceSheet.financialIncome.feesCommissionsIncome]);
  rows.push(["Other Operating Income (4201)", balanceSheet.otherIncome.otherOperatingIncome]);
  rows.push([]);
  rows.push([
    "Interest Expense on Deposits (5101)",
    balanceSheet.financialExpenses.interestExpenseDeposits,
  ]);
  rows.push([
    "Interest Expense on Borrowings (5102)",
    balanceSheet.financialExpenses.interestExpenseBorrowings,
  ]);
  rows.push(["Personnel Costs (5201)", balanceSheet.operatingExpenses.personnelCosts]);
  rows.push([
    "Administrative Expenses (5202)",
    balanceSheet.operatingExpenses.administrativeExpenses,
  ]);
  rows.push(["Governance Expenses (5203)", balanceSheet.operatingExpenses.governanceExpenses]);
  rows.push(["Depreciation (5204)", balanceSheet.operatingExpenses.depreciationAmortization]);
  rows.push(["Credit Loss Expense (5301)", balanceSheet.creditLossExpense]);

  return rows.map((row) => row.join(",")).join("\n");
}
