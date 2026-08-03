import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fmt } from "./helpers";

interface MonthCol {
  name: string;
  nameKey: string;
  num: number;
}

interface GridRowConfig {
  code?: number;
  nameKey: string;
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

const BALANCE_SHEET_ROWS: GridRowConfig[] = [
  { nameKey: "assets", isHeader: true },
  { code: 1101, nameKey: "cashOnHand", indent: true },
  { code: 1102, nameKey: "cashAtBankCurrent", indent: true },
  { code: 1103, nameKey: "cashAtBankSavings", indent: true },
  { code: 1104, nameKey: "shortTermInvestments", indent: true },
  {
    code: 1100,
    nameKey: "totalLiquidAssets",
    isTotal: true,
    formula: (data, m) =>
      (data[1101]?.[m] || 0) +
      (data[1102]?.[m] || 0) +
      (data[1103]?.[m] || 0) +
      (data[1104]?.[m] || 0),
  },
  { code: 1201, nameKey: "performingLoanPortfolio", indent: true },
  { code: 1202, nameKey: "loansInArrears1_30", indent: true },
  { code: 1203, nameKey: "loansInArrears31_60", indent: true },
  { code: 1204, nameKey: "loansInArrears61_90", indent: true },
  { code: 1205, nameKey: "nonPerformingLoans90", indent: true },
  {
    code: 1200,
    nameKey: "grossLoanPortfolio",
    isTotal: true,
    formula: (data, m) =>
      (data[1201]?.[m] || 0) +
      (data[1202]?.[m] || 0) +
      (data[1203]?.[m] || 0) +
      (data[1204]?.[m] || 0) +
      (data[1205]?.[m] || 0),
  },
  { code: 1251, nameKey: "generalLoanLossProvision", indent: true },
  { code: 1252, nameKey: "specificLoanLossProvision", indent: true },
  {
    code: 1250,
    nameKey: "allowanceLoanLosses",
    isTotal: true,
    formula: (data, m) => (data[1251]?.[m] || 0) + (data[1252]?.[m] || 0),
  },
  {
    nameKey: "netLoanPortfolio",
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
  { code: 1301, nameKey: "accountsReceivable", indent: true },
  { code: 1302, nameKey: "prepaidExpenses", indent: true },
  { code: 1303, nameKey: "fixedAssetsCost", indent: true },
  { code: 1304, nameKey: "accumulatedDepreciation", indent: true },
  { code: 1305, nameKey: "intangibleAssets", indent: true },
  {
    code: 1300,
    nameKey: "totalOtherAssets",
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
    nameKey: "totalAssets",
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
  { nameKey: "liabilities", isHeader: true },
  { code: 2101, nameKey: "voluntarySavingsDeposits", indent: true },
  { code: 2102, nameKey: "mandatorySavingsDeposits", indent: true },
  { code: 2103, nameKey: "fixedTermDeposits", indent: true },
  {
    code: 2100,
    nameKey: "totalMemberDeposits",
    isTotal: true,
    formula: (data, m) => (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0),
  },
  { code: 2201, nameKey: "shortTermBorrowings", indent: true },
  { code: 2202, nameKey: "longTermBorrowings", indent: true },
  {
    code: 2200,
    nameKey: "totalBorrowings",
    isTotal: true,
    formula: (data, m) => (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0),
  },
  { code: 2301, nameKey: "accountsPayable", indent: true },
  { code: 2302, nameKey: "accruedExpenses", indent: true },
  { code: 2303, nameKey: "deferredIncome", indent: true },
  {
    code: 2300,
    nameKey: "totalOtherLiabilities",
    isTotal: true,
    formula: (data, m) => (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0),
  },
  {
    code: 2999,
    nameKey: "totalLiabilities",
    isTotal: true,
    formula: (data, m) => {
      const deposits = (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0);
      const borrowings = (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0);
      const other = (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0);
      return deposits + borrowings + other;
    },
  },
  { nameKey: "membersEquity", isHeader: true },
  { code: 3101, nameKey: "permanentShareCapital", indent: true },
  { code: 3102, nameKey: "withdrawableShares", indent: true },
  {
    code: 3100,
    nameKey: "totalMemberShares",
    isTotal: true,
    formula: (data, m) => (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0),
  },
  { code: 3201, nameKey: "statutoryReserve", indent: true },
  { code: 3202, nameKey: "generalReserve", indent: true },
  { code: 3203, nameKey: "riskCapitalAdequacyReserve", indent: true },
  {
    code: 3200,
    nameKey: "totalReserves",
    isTotal: true,
    formula: (data, m) => (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0),
  },
  { code: 3301, nameKey: "accumulatedSurplus", indent: true },
  { code: 3302, nameKey: "currentYearSurplus", indent: true },
  {
    code: 3300,
    nameKey: "totalRetainedEarnings",
    isTotal: true,
    formula: (data, m) => (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0),
  },
  {
    code: 3999,
    nameKey: "totalMembersEquity",
    isTotal: true,
    formula: (data, m) => {
      const shares = (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0);
      const reserves = (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0);
      const retained = (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0);
      return shares + reserves + retained;
    },
  },
  {
    nameKey: "totalLiabilitiesEquity",
    isTotal: true,
    formula: (data, m) => {
      const deposits = (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0);
      const borrowings = (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0);
      const other = (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0);
      const shares = (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0);
      const reserves = (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0);
      const retained = (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0);
      return deposits + borrowings + other + shares + reserves + retained;
    },
  },
  {
    nameKey: "balanceCheck",
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

      const deposits = (data[2101]?.[m] || 0) + (data[2102]?.[m] || 0) + (data[2103]?.[m] || 0);
      const borrowings = (data[2201]?.[m] || 0) + (data[2202]?.[m] || 0);
      const otherLiab = (data[2301]?.[m] || 0) + (data[2302]?.[m] || 0) + (data[2303]?.[m] || 0);
      const shares = (data[3101]?.[m] || 0) + (data[3102]?.[m] || 0);
      const reserves = (data[3201]?.[m] || 0) + (data[3202]?.[m] || 0) + (data[3203]?.[m] || 0);
      const retained = (data[3301]?.[m] || 0) + (data[3302]?.[m] || 0);
      const liabEquity = deposits + borrowings + otherLiab + shares + reserves + retained;

      return assets - liabEquity;
    },
  },
];

const INCOME_STATEMENT_ROWS: GridRowConfig[] = [
  { nameKey: "income", isHeader: true },
  { code: 4101, nameKey: "interestIncomeLoans", indent: true },
  { code: 4102, nameKey: "feesCommissionsIncome", indent: true },
  {
    code: 4100,
    nameKey: "totalFinancialIncome",
    isTotal: true,
    formula: (data, m) => (data[4101]?.[m] || 0) + (data[4102]?.[m] || 0),
  },
  { code: 4201, nameKey: "otherOperatingIncome", indent: true },
  {
    code: 4999,
    nameKey: "totalIncome",
    isTotal: true,
    formula: (data, m) => (data[4101]?.[m] || 0) + (data[4102]?.[m] || 0) + (data[4201]?.[m] || 0),
  },
  { nameKey: "expenses", isHeader: true },
  { code: 5101, nameKey: "interestExpenseMemberDeposits", indent: true },
  { code: 5102, nameKey: "interestExpenseBorrowings", indent: true },
  {
    code: 5100,
    nameKey: "totalFinancialExpenses",
    isTotal: true,
    formula: (data, m) => (data[5101]?.[m] || 0) + (data[5102]?.[m] || 0),
  },
  { code: 5201, nameKey: "personnelCosts", indent: true },
  { code: 5202, nameKey: "administrativeExpenses", indent: true },
  { code: 5203, nameKey: "governanceExpenses", indent: true },
  { code: 5204, nameKey: "depreciationAmortization", indent: true },
  {
    code: 5200,
    nameKey: "totalOperatingExpenses",
    isTotal: true,
    formula: (data, m) =>
      (data[5201]?.[m] || 0) +
      (data[5202]?.[m] || 0) +
      (data[5203]?.[m] || 0) +
      (data[5204]?.[m] || 0),
  },
  { code: 5301, nameKey: "loanLossProvisionExpense", indent: true },
  {
    code: 5999,
    nameKey: "totalExpenses",
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
    nameKey: "netSurplusDeficit",
    isTotal: true,
    formula: (data, m) => {
      const inc = (data[4101]?.[m] || 0) + (data[4102]?.[m] || 0) + (data[4201]?.[m] || 0);
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
  const { t } = useTranslation();
  const [helpField, setHelpField] = useState<{ title: string; desc: string } | null>(null);

  const monthSequence: MonthCol[] = useMemo(() => {
    if (accountingYear === "calendar") {
      return [
        { name: "Jan", nameKey: "jan", num: 1 },
        { name: "Feb", nameKey: "feb", num: 2 },
        { name: "Mar", nameKey: "mar", num: 3 },
        { name: "Apr", nameKey: "apr", num: 4 },
        { name: "May", nameKey: "may", num: 5 },
        { name: "Jun", nameKey: "jun", num: 6 },
        { name: "Jul", nameKey: "jul", num: 7 },
        { name: "Aug", nameKey: "aug", num: 8 },
        { name: "Sep", nameKey: "sep", num: 9 },
        { name: "Oct", nameKey: "oct", num: 10 },
        { name: "Nov", nameKey: "nov", num: 11 },
        { name: "Dec", nameKey: "dec", num: 12 },
      ];
    } else {
      return [
        { name: "Jul", nameKey: "jul", num: 7 },
        { name: "Aug", nameKey: "aug", num: 8 },
        { name: "Sep", nameKey: "sep", num: 9 },
        { name: "Oct", nameKey: "oct", num: 10 },
        { name: "Nov", nameKey: "nov", num: 11 },
        { name: "Dec", nameKey: "dec", num: 12 },
        { name: "Jan", nameKey: "jan", num: 1 },
        { name: "Feb", nameKey: "feb", num: 2 },
        { name: "Mar", nameKey: "mar", num: 3 },
        { name: "Apr", nameKey: "apr", num: 4 },
        { name: "May", nameKey: "may", num: 5 },
        { name: "Jun", nameKey: "jun", num: 6 },
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
              <th className="px-4 py-3 text-left w-24 border-r border-border/80">{t("financialExcelGrid.headers.code")}</th>
              <th className="px-4 py-3 text-left w-80 border-r border-border/80">{t("financialExcelGrid.headers.accountName")}</th>
              {monthSequence.map((m) => (
                <th
                  key={m.num}
                  className="px-3 py-3 text-right w-28 border-r border-border/80 last:border-r-0"
                >
                  {t(`financialExcelGrid.months.${m.nameKey}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowName = t(`financialExcelGrid.rowNames.${row.nameKey}`);

              if (row.isHeader) {
                return (
                  <tr key={index} className="bg-primary/10 font-bold border-b border-border/80">
                    <td
                      className="px-4 py-3 text-sm text-primary tracking-wider font-semibold"
                      colSpan={14}
                    >
                      {rowName}
                    </td>
                  </tr>
                );
              }

              const isFormula = !!row.formula;
              const isTotal = row.isTotal;
              const isCheckRow = row.nameKey === "balanceCheck";
              const explanation = row.code ? t(`financialExcelGrid.explanations.${row.code}`) : null;

              return (
                <tr
                  key={index}
                  className={`border-b border-border/60 transition-colors ${
                    isTotal ? "bg-muted/40 font-semibold" : "hover:bg-muted/10"
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
                      <span>{rowName}</span>
                      {explanation && (
                        <button
                          onClick={() => setHelpField({ title: rowName, desc: explanation })}
                          className="text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer focus:outline-none"
                          title={t("financialExcelGrid.explainFieldTooltip")}
                        >
                          <Info className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  {monthSequence.map((m) => {
                    let value = 0;
                    if (isFormula && row.formula) {
                      value = row.formula(financialData, m.num);
                    } else if (row.code) {
                      value = financialData[row.code]?.[m.num] || 0;
                    }

                    const formattedVal = isCheckRow
                      ? Math.abs(value) < 0.01
                        ? "—"
                        : fmt(value)
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
                          <span
                            className={isCheckRow && Math.abs(value) > 0.01 ? "text-danger" : ""}
                          >
                            {currency} {formattedVal}
                          </span>
                        ) : row.code ? (
                          <input
                            type="number"
                            value={value === 0 ? "" : value}
                            onChange={(e) => onChange(row.code!, m.num, Number(e.target.value))}
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
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">{helpField.desc}</p>
            <button
              onClick={() => setHelpField(null)}
              className="w-full inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none"
            >
              {t("financialExcelGrid.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
