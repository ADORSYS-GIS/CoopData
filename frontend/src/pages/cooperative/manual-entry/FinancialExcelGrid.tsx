import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { fmt } from "./helpers";

interface MonthCol {
  name: string;
  num: number;
}

interface GridRowConfig {
  code?: number;
  name: string;
  isHeader?: boolean;
  isTotal?: boolean;
  indent?: boolean;
  formula?: (data: Record<number, Record<number, number>>, m: number) => number;
}

interface FinancialExcelGridProps {
  accountingYear: "calendar" | "fiscal";
  currency: string;
  financialData: Record<number, Record<number, number>>;
  onChange: (code: number, monthNum: number, value: number) => void;
}

const ACCOUNT_EXPLANATIONS: Record<number, string> = {
  1101: "Physical cash held in vaults, safes, and cash drawers.",
  1102: "Checking account balances held at commercial banks, immediately withdrawable.",
  1103: "Interest-bearing deposit account balances held at commercial banks.",
  1104: "Liquid financial assets maturing within one year, such as treasury bills or money market funds.",
  1201: "Outstanding principal balance of loans with regular repayments (0 days in arrears).",
  1202: "Loans where repayment is overdue between 1 and 30 days.",
  1203: "Loans where repayment is overdue between 31 and 60 days.",
  1204: "Loans where repayment is overdue between 61 and 90 days.",
  1205: "Impaired loans where repayment is overdue by more than 90 days.",
  1251: "Estimated allowance for potential loan losses across the general performing portfolio.",
  1252: "Allowance set aside for identified high-risk or non-performing loans.",
  1301: "Amounts owed to the cooperative by members or clients for goods/services delivered.",
  1302: "Advance payments made for expenses that will be incurred in future periods.",
  1303: "Capitalized cost of physical infrastructure, machinery, and equipment.",
  1304: "Total wear and tear written off against fixed assets over their lifetime.",
  1305: "Non-physical valuable assets like proprietary software licenses, trademarks, or patents.",
  2101: "Savings deposited by members that can be withdrawn at any time.",
  2102: "Compulsory member contributions required for cooperative membership or loan access.",
  2103: "Deposits held for a fixed duration at a locked interest rate with withdrawal restrictions.",
  2201: "Loans or credit lines payable by the cooperative within one year.",
  2202: "Debt obligations maturing in more than one year.",
  2301: "Outstanding payments owed to suppliers or vendors for goods and services.",
  2302: "Accumulated liabilities for expenses incurred but not yet invoiced (e.g. unpaid taxes, utilities).",
  2303: "Unearned revenue received in advance of providing services or goods.",
  3101: "Non-withdrawable equity capital contributed by members as ownership stake.",
  3102: "Member shares that can be redeemed or withdrawn upon membership termination.",
  3201: "Mandatory legal reserve funded from annual surplus as required by regulations.",
  3202: "Discretionary reserve set aside from surplus for general cooperative growth and security.",
  3203: "Reserves dedicated to meeting regulatory capital adequacy and risk coverage ratios.",
  3301: "Retained earnings from prior fiscal years.",
  3302: "Net earnings or surplus generated during the current reporting period.",
  4101: "Revenue generated from interest charged on member loans.",
  4102: "Revenue from application fees, service fees, or commissions.",
  4201: "Non-core revenue like dividends, rental income, or asset sales.",
  5101: "Interest payouts paid to members on voluntary, mandatory, or term deposits.",
  5102: "Interest payments paid to external financial institutions on borrowings.",
  5201: "Staff wages, salaries, allowances, and social security contributions.",
  5202: "Office rent, utilities, insurance, stationery, and other daily running costs.",
  5203: "Costs associated with board meetings, AGM, committee member fees, and audits.",
  5204: "Annual depreciation expense written off against fixed and intangible assets.",
  5301: "Annual P&L expense charge to fund the loan loss provision allowance."
};

const BALANCE_SHEET_ROWS: GridRowConfig[] = [
  { name: "ASSETS", isHeader: true },
  { code: 1101, name: "Cash on Hand", indent: true },
  { code: 1102, name: "Cash at Bank – Current Account", indent: true },
  { code: 1103, name: "Cash at Bank – Savings Account", indent: true },
  { code: 1104, name: "Short-Term Investments", indent: true },
  {
    code: 1100,
    name: "Total Liquid Assets",
    isTotal: true,
    formula: (data, m) =>
      (data[1101]?.[m] || 0) +
      (data[1102]?.[m] || 0) +
      (data[1103]?.[m] || 0) +
      (data[1104]?.[m] || 0),
  },
  { code: 1201, name: "Performing Loan Portfolio", indent: true },
  { code: 1202, name: "Loans in Arrears (1-30 days)", indent: true },
  { code: 1203, name: "Loans in Arrears (31-60 days)", indent: true },
  { code: 1204, name: "Loans in Arrears (61-90 days)", indent: true },
  { code: 1205, name: "Non-Performing Loans (>90 days)", indent: true },
  {
    code: 1200,
    name: "Gross Loan Portfolio",
    isTotal: true,
    formula: (data, m) =>
      (data[1201]?.[m] || 0) +
      (data[1202]?.[m] || 0) +
      (data[1203]?.[m] || 0) +
      (data[1204]?.[m] || 0) +
      (data[1205]?.[m] || 0),
  },
  { code: 1251, name: "General Loan Loss Provision", indent: true },
  { code: 1252, name: "Specific Loan Loss Provision", indent: true },
  {
    code: 1250,
    name: "Allowance for Loan Losses",
    isTotal: true,
    formula: (data, m) => (data[1251]?.[m] || 0) + (data[1252]?.[m] || 0),
  },
  {
    name: "Net Loan Portfolio",
    isTotal: true,
    formula: (data, m) => {
      const gross =
        (data[1201]?.[m] || 0) +
        (data[1202]?.[m] || 0) +
        (data[1203]?.[m] || 0) +
        (data[1204]?.[m] || 0) +
        (data[1205]?.[m] || 0);
      const allowance = (data[1251]?.[m] || 0) + (data[1252]?.[m] || 0);
      return gross - allowance;
    },
  },
  { code: 1301, name: "Accounts Receivable", indent: true },
  { code: 1302, name: "Prepaid Expenses", indent: true },
  { code: 1303, name: "Fixed Assets (at Cost)", indent: true },
  { code: 1304, name: "Accumulated Depreciation", indent: true },
  { code: 1305, name: "Intangible Assets", indent: true },
  {
    code: 1300,
    name: "Total Other Assets",
    isTotal: true,
    formula: (data, m) =>
      (data[1301]?.[m] || 0) +
      (data[1302]?.[m] || 0) +
      (data[1303]?.[m] || 0) -
      Math.abs(data[1304]?.[m] || 0) +
      (data[1305]?.[m] || 0),
  },
  {
    code: 1999,
    name: "TOTAL ASSETS",
    isTotal: true,
    formula: (data, m) => {
      const liquid =
        (data[1101]?.[m] || 0) +
        (data[1102]?.[m] || 0) +
        (data[1103]?.[m] || 0) +
        (data[1104]?.[m] || 0);
      const gross =
        (data[1201]?.[m] || 0) +
        (data[1202]?.[m] || 0) +
        (data[1203]?.[m] || 0) +
        (data[1204]?.[m] || 0) +
        (data[1205]?.[m] || 0);
      const allowance = (data[1251]?.[m] || 0) + (data[1252]?.[m] || 0);
      const other =
        (data[1301]?.[m] || 0) +
        (data[1302]?.[m] || 0) +
        (data[1303]?.[m] || 0) -
        Math.abs(data[1304]?.[m] || 0) +
        (data[1305]?.[m] || 0);
      return liquid + gross - allowance + other;
    },
  },
  { name: "LIABILITIES", isHeader: true },
  { code: 2101, name: "Voluntary Savings Deposits", indent: true },
  { code: 2102, name: "Mandatory Savings Deposits", indent: true },
  { code: 2103, name: "Fixed Term Deposits", indent: true },
  {
    code: 2100,
    name: "Total Member Deposits",
    isTotal: true,
    formula: (data, m) =>
      (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0),
  },
  { code: 2201, name: "Short-Term Borrowings", indent: true },
  { code: 2202, name: "Long-Term Borrowings", indent: true },
  {
    code: 2200,
    name: "Total Borrowings",
    isTotal: true,
    formula: (data, m) => (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0),
  },
  { code: 2301, name: "Accounts Payable", indent: true },
  { code: 2302, name: "Accrued Expenses", indent: true },
  { code: 2303, name: "Deferred Income", indent: true },
  {
    code: 2300,
    name: "Total Other Liabilities",
    isTotal: true,
    formula: (data, m) =>
      (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0),
  },
  {
    code: 2999,
    name: "TOTAL LIABILITIES",
    isTotal: true,
    formula: (data, m) => {
      const deposits =
        (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0);
      const borrowings = (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0);
      const other =
        (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0);
      return deposits + borrowings + other;
    },
  },
  { name: "MEMBERS' EQUITY", isHeader: true },
  { code: 3101, name: "Permanent Share Capital", indent: true },
  { code: 3102, name: "Withdrawable Shares", indent: true },
  {
    code: 3100,
    name: "Total Member Shares",
    isTotal: true,
    formula: (data, m) => (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0),
  },
  { code: 3201, name: "Statutory Reserve", indent: true },
  { code: 3202, name: "General Reserve", indent: true },
  { code: 3203, name: "Risk / Capital Adequacy Reserve", indent: true },
  {
    code: 3200,
    name: "Total Reserves",
    isTotal: true,
    formula: (data, m) =>
      (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0),
  },
  { code: 3301, name: "Accumulated Surplus", indent: true },
  { code: 3302, name: "Current Year Surplus", indent: true },
  {
    code: 3300,
    name: "Total Retained Earnings",
    isTotal: true,
    formula: (data, m) => (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0),
  },
  {
    code: 3999,
    name: "TOTAL MEMBERS' EQUITY",
    isTotal: true,
    formula: (data, m) => {
      const shares = (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0);
      const reserves =
        (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0);
      const retained = (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0);
      return shares + reserves + retained;
    },
  },
  {
    name: "TOTAL LIABILITIES & EQUITY",
    isTotal: true,
    formula: (data, m) => {
      const deposits =
        (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0);
      const borrowings = (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0);
      const other =
        (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0);
      const shares = (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0);
      const reserves =
        (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0);
      const retained = (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0);
      return deposits + borrowings + other + shares + reserves + retained;
    },
  },
  {
    name: "Balance Check (Assets - Liabilities - Equity)",
    isTotal: true,
    formula: (data, m) => {
      const liquid =
        (data[1101]?.[m] || 0) +
        (data[1102]?.[m] || 0) +
        (data[1103]?.[m] || 0) +
        (data[1104]?.[m] || 0);
      const gross =
        (data[1201]?.[m] || 0) +
        (data[1202]?.[m] || 0) +
        (data[1203]?.[m] || 0) +
        (data[1204]?.[m] || 0) +
        (data[1205]?.[m] || 0);
      const allowance = (data[1251]?.[m] || 0) + (data[1252]?.[m] || 0);
      const other =
        (data[1301]?.[m] || 0) +
        (data[1302]?.[m] || 0) +
        (data[1303]?.[m] || 0) -
        Math.abs(data[1304]?.[m] || 0) +
        (data[1305]?.[m] || 0);
      const assets = liquid + gross - allowance + other;

      const deposits =
        (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0);
      const borrowings = (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0);
      const otherLiab =
        (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0);
      const shares = (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0);
      const reserves =
        (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0);
      const retained = (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0);
      const liabEquity = deposits + borrowings + otherLiab + shares + reserves + retained;

      return assets - liabEquity;
    },
  },
];

const INCOME_STATEMENT_ROWS: GridRowConfig[] = [
  { name: "INCOME", isHeader: true },
  { code: 4101, name: "Interest Income on Loans", indent: true },
  { code: 4102, name: "Fees and Commissions Income", indent: true },
  {
    code: 4100,
    name: "Total Financial Income",
    isTotal: true,
    formula: (data, m) => (data[4101]?.[m] || 0) + (data[4102]?.[m] || 0),
  },
  { code: 4201, name: "Other Operating Income", indent: true },
  {
    code: 4999,
    name: "TOTAL INCOME",
    isTotal: true,
    formula: (data, m) =>
      (data[4101]?.[m] || 0) + (data[4102]?.[m] || 0) + (data[4201]?.[m] || 0),
  },
  { name: "EXPENSES", isHeader: true },
  { code: 5101, name: "Interest Expense on Member Deposits", indent: true },
  { code: 5102, name: "Interest Expense on Borrowings", indent: true },
  {
    code: 5100,
    name: "Total Financial Expenses",
    isTotal: true,
    formula: (data, m) => (data[5101]?.[m] || 0) + (data[5102]?.[m] || 0),
  },
  { code: 5201, name: "Personnel Costs", indent: true },
  { code: 5202, name: "Administrative Expenses", indent: true },
  { code: 5203, name: "Governance Expenses", indent: true },
  { code: 5204, name: "Depreciation and Amortization", indent: true },
  {
    code: 5200,
    name: "Total Operating Expenses",
    isTotal: true,
    formula: (data, m) =>
      (data[5201]?.[m] || 0) +
      (data[5202]?.[m] || 0) +
      (data[5203]?.[m] || 0) +
      (data[5204]?.[m] || 0),
  },
  { code: 5301, name: "Loan Loss Provision Expense", indent: true },
  {
    code: 5999,
    name: "TOTAL EXPENSES",
    isTotal: true,
    formula: (data, m) => {
      const fin = (data[5101]?.[m] || 0) + (data[5102]?.[m] || 0);
      const opt =
        (data[5201]?.[m] || 0) +
        (data[5202]?.[m] || 0) +
        (data[5203]?.[m] || 0) +
        (data[5204]?.[m] || 0);
      const prov = data[5301]?.[m] || 0;
      return fin + opt + prov;
    },
  },
  {
    code: 6999,
    name: "NET SURPLUS/(DEFICIT)",
    isTotal: true,
    formula: (data, m) => {
      const inc =
        (data[4101]?.[m] || 0) + (data[4102]?.[m] || 0) + (data[4201]?.[m] || 0);
      const exp =
        (data[5101]?.[m] || 0) +
        (data[5102]?.[m] || 0) +
        (data[5201]?.[m] || 0) +
        (data[5202]?.[m] || 0) +
        (data[5203]?.[m] || 0) +
        (data[5204]?.[m] || 0) +
        (data[5301]?.[m] || 0);
      return inc - exp;
    },
  },
];

export function FinancialExcelGrid({
  accountingYear,
  currency,
  financialData,
  onChange,
}: FinancialExcelGridProps) {
  const [helpField, setHelpField] = useState<{ title: string; desc: string } | null>(null);

  const monthSequence: MonthCol[] = useMemo(() => {
    if (accountingYear === "calendar") {
      return [
        { name: "Jan", num: 1 },
        { name: "Feb", num: 2 },
        { name: "Mar", num: 3 },
        { name: "Apr", num: 4 },
        { name: "May", num: 5 },
        { name: "Jun", num: 6 },
        { name: "Jul", num: 7 },
        { name: "Aug", num: 8 },
        { name: "Sep", num: 9 },
        { name: "Oct", num: 10 },
        { name: "Nov", num: 11 },
        { name: "Dec", num: 12 },
      ];
    } else {
      return [
        { name: "Jul", num: 7 },
        { name: "Aug", num: 8 },
        { name: "Sep", num: 9 },
        { name: "Oct", num: 10 },
        { name: "Nov", num: 11 },
        { name: "Dec", num: 12 },
        { name: "Jan", num: 1 },
        { name: "Feb", num: 2 },
        { name: "Mar", num: 3 },
        { name: "Apr", num: 4 },
        { name: "May", num: 5 },
        { name: "Jun", num: 6 },
      ];
    }
  }, [accountingYear]);

  const rows = useMemo(() => [...BALANCE_SHEET_ROWS, ...INCOME_STATEMENT_ROWS], []);

  return (
    <div className="relative font-sans">
      <div className="overflow-x-auto border border-border/80 rounded-xl bg-background shadow-md">
        <table className="w-full border-collapse text-sm min-w-[1300px]">
          <thead>
            <tr className="bg-muted border-b border-border text-xs font-semibold text-muted-foreground">
              <th className="px-4 py-3 text-left w-24 border-r border-border/80">Code</th>
              <th className="px-4 py-3 text-left w-80 border-r border-border/80">Account Name</th>
              {monthSequence.map(m => (
                <th key={m.num} className="px-3 py-3 text-right w-28 border-r border-border/80 last:border-r-0">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              if (row.isHeader) {
                return (
                  <tr key={index} className="bg-primary/10 font-bold border-b border-border/80">
                    <td className="px-4 py-3 text-sm text-primary tracking-wider font-semibold" colSpan={14}>
                      {row.name}
                    </td>
                  </tr>
                );
              }

              const isFormula = !!row.formula;
              const isTotal = row.isTotal;
              const isCheckRow = row.name.includes("Check");
              const explanation = row.code ? ACCOUNT_EXPLANATIONS[row.code] : null;

              return (
                <tr
                  key={index}
                  className={`border-b border-border/60 transition-colors ${
                    isTotal
                      ? "bg-muted/40 font-semibold"
                      : "hover:bg-muted/10"
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground border-r border-border/50">
                    {row.code || ""}
                  </td>
                  <td
                    className={`px-4 py-2.5 border-r border-border/50 text-foreground text-sm ${
                      row.indent ? "pl-8 text-foreground/80 font-normal" : "font-semibold"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{row.name}</span>
                      {explanation && (
                        <button
                          onClick={() => setHelpField({ title: row.name, desc: explanation })}
                          className="text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer focus:outline-none"
                          title="Click to explain this field"
                        >
                          <Info className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  {monthSequence.map(m => {
                    let value = 0;
                    if (isFormula && row.formula) {
                      value = row.formula(financialData, m.num);
                    } else if (row.code) {
                      value = financialData[row.code]?.[m.num] || 0;
                    }

                    const formattedVal = isCheckRow 
                      ? (Math.abs(value) < 0.01 ? "—" : fmt(value))
                      : fmt(value);

                    return (
                      <td
                        key={m.num}
                        className={`px-3 py-2 border-r border-border/50 last:border-r-0 text-right font-mono text-sm ${
                          isFormula ? "font-bold text-foreground bg-muted/20" : ""
                        } ${
                          isCheckRow
                            ? Math.abs(value) < 0.01
                              ? "text-success font-bold"
                              : "text-danger font-bold bg-danger/5"
                            : ""
                        }`}
                      >
                        {isFormula ? (
                          <span className={isCheckRow && Math.abs(value) > 0.01 ? "text-danger" : ""}>
                            {currency} {formattedVal}
                          </span>
                        ) : row.code ? (
                          <input
                            type="number"
                            value={value === 0 ? "" : value}
                            onChange={e => onChange(row.code!, m.num, Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-transparent text-right outline-none border-none focus:bg-primary/10 focus:ring-1 focus:ring-primary rounded px-2 py-1 font-mono text-sm text-foreground placeholder-muted-foreground/30 min-h-[28px]"
                          />
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Account Info Explanation Modal */}
      {helpField && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] grid place-items-center p-4">
          <div className="bg-popover border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in-50 zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Info className="size-5 text-primary" />
              {helpField.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {helpField.desc}
            </p>
            <button
              onClick={() => setHelpField(null)}
              className="w-full inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
