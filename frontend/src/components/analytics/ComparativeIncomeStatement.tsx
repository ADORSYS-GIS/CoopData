import React, { useState, useMemo } from "react";
import { useComparativeStatements } from "@/hooks/analytics/useComparativeStatements";
import { Card } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Info } from "lucide-react";

interface ComparativeIncomeStatementProps {
  reportingYear: number;
}

const MONTH_OPTIONS = [
  { value: "1", label: "31. Jan " },
  { value: "2", label: "28. Feb " },
  { value: "3", label: "31. Mar " },
  { value: "4", label: "30. Apr " },
  { value: "5", label: "31. May " },
  { value: "6", label: "30. Jun " },
  { value: "7", label: "31. Jul " },
  { value: "8", label: "31. Aug " },
  { value: "9", label: "30. Sep " },
  { value: "10", label: "31. Oct " },
  { value: "11", label: "30. Nov " },
  { value: "12", label: "31. Dec " },
];

interface IncomeStatementRow {
  label: string;
  subLabel?: string;
  isHeader?: boolean;
  codes: number[];
  multiplier?: number;
  computeFormula?: (coopData: Record<number, number>) => number;
}

const INCOME_STATEMENT_ROWS: IncomeStatementRow[] = [
  { label: "FINANCIAL REVENUES", isHeader: true, codes: [] },
  { label: "Interest Earned on Loans", subLabel: "Code 4101", codes: [4101] },
  { label: "Interest Earned on Investments", subLabel: "Code 4102", codes: [4102] },
  { label: "Other Operating Revenues", subLabel: "Code 4201", codes: [4201] },
  {
    label: "TOTAL REVENUES",
    isHeader: true,
    codes: [],
    computeFormula: (coop) => (coop[4101] || 0) + (coop[4102] || 0) + (coop[4201] || 0),
  },
  { label: "FINANCIAL EXPENSES", isHeader: true, codes: [] },
  { label: "(-) Interest Paid on Member Deposits", subLabel: "Code 5101", codes: [5101], multiplier: -1 },
  { label: "(-) Interest Paid on Borrowings", subLabel: "Code 5102", codes: [5102], multiplier: -1 },
  {
    label: "NET INTEREST MARGIN",
    isHeader: true,
    codes: [],
    computeFormula: (coop) => {
      const inc = (coop[4101] || 0) + (coop[4102] || 0);
      const exp = (coop[5101] || 0) + (coop[5102] || 0);
      return inc - exp;
    },
  },
  { label: "OPERATING & GENERAL EXPENSES", isHeader: true, codes: [] },
  { label: "(-) Personnel & Staff Expenses", subLabel: "Code 5201", codes: [5201], multiplier: -1 },
  { label: "(-) Administrative & Rent Expenses", subLabel: "Code 5202", codes: [5202], multiplier: -1 },
  { label: "(-) Depreciation & Amortization", subLabel: "Code 5203", codes: [5203], multiplier: -1 },
  { label: "(-) Other General Expenses", subLabel: "Code 5204", codes: [5204], multiplier: -1 },
  { label: "(-) Provision for Credit Losses", subLabel: "Code 5301", codes: [5301], multiplier: -1 },
  {
    label: "NET SURPLUS / LOSS OF THE PERIOD",
    isHeader: true,
    codes: [],
    computeFormula: (coop) => {
      const revenues = (coop[4101] || 0) + (coop[4102] || 0) + (coop[4201] || 0);
      const expenses =
        (coop[5101] || 0) +
        (coop[5102] || 0) +
        (coop[5201] || 0) +
        (coop[5202] || 0) +
        (coop[5203] || 0) +
        (coop[5204] || 0) +
        (coop[5301] || 0);
      return revenues - expenses;
    },
  },
];

export function ComparativeIncomeStatement({ reportingYear }: ComparativeIncomeStatementProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("12");
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([]);

  const { data: comparative, isLoading } = useComparativeStatements({
    reportingYear,
  });

  const formatCurrency = (val: number) => {
    if (val === 0) return "-";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const coopMatrices = useMemo(() => {
    if (!comparative?.grids) return [];

    return comparative.grids.map((grid) => {
      const lineItems = grid.line_items || [];
      const filtered = lineItems.filter((item) => String(item.month) === selectedMonth);

      const map: Record<number, number> = {};
      filtered.forEach((item) => {
        if (item.account_code) {
          map[item.account_code] = (map[item.account_code] || 0) + item.value;
        }
      });

      return {
        id: grid.cooperative_id,
        name: grid.cooperative_name,
        codeValues: map,
      };
    });
  }, [comparative, selectedMonth]);

  const filteredMatrices = useMemo(() => {
    if (selectedCoopIds.length === 0) return coopMatrices;
    return coopMatrices.filter((m) => selectedCoopIds.includes(m.id));
  }, [coopMatrices, selectedCoopIds]);

  const handleCoopToggle = (id: string) => {
    if (id === "clear_all_custom_option") {
      setSelectedCoopIds([]);
      return;
    }
    setSelectedCoopIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading comparative income statement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Excel Blue Banner with Slicers */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Income Statement Comparison
          </h2>
          <p className="text-xs text-blue-200/80 mt-1 font-medium">
            Comparative Audit Spreadsheet Grid & Operational Surplus ({reportingYear})
          </p>
        </div>

        {/* Slicers Section */}
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[120px]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
              Date
            </span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full bg-white text-slate-900 border-0 h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs font-medium">
                    {m.label}
                    {reportingYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[200px]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
              Cooperatives
            </span>
            <div className="relative">
              <Select onValueChange={handleCoopToggle}>
                <SelectTrigger className="w-full bg-white text-slate-900 border-0 h-8 text-xs font-semibold">
                  <span>
                    {selectedCoopIds.length === 0
                      ? "All Cooperatives"
                      : `${selectedCoopIds.length} Selected`}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear_all_custom_option" className="text-xs font-bold text-red-600">
                    Reset Selection (All)
                  </SelectItem>
                  {coopMatrices.map((coop) => (
                    <SelectItem key={coop.id} value={coop.id} className="text-xs font-medium">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCoopIds.includes(coop.id)}
                          readOnly
                          className="rounded text-blue-600 size-3"
                        />
                        {coop.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Info Explanation Card */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex gap-3 text-xs leading-relaxed shadow-sm">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">Income Statement Mapping:</span>
          The cooperative's revenues and operational costs are mapped to standard account codes:
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>Total Revenues</strong>: Mapped to account code 4101 (Interest on Loans), 4102 (Interest on Investments), and 4201 (Other Revenues).</li>
            <li><strong>Financial Expenses</strong>: Mapped to account codes 5101 (Deposits Interest) and 5102 (Borrowing Interest).</li>
            <li><strong>Net Interest Margin</strong>: Net difference between Financial Revenues and Financial Expenses.</li>
            <li><strong>Operating Expenses</strong>: Mapped to account codes 5201 (Personnel), 5202 (Administrative), 5203 (Depreciation), 5204 (Other General), and 5301 (Provisions).</li>
          </ul>
        </div>
      </div>

      {/* Grid Comparative Table */}
      <Card
        title="Income Statement Spreadsheet Grid"
        subtitle="Side-by-side comparison sheet"
      >
        {filteredMatrices.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 w-96 sticky left-0 bg-background border-r border-border z-10">
                    Category
                  </th>
                  {filteredMatrices.map((coop) => (
                    <th key={coop.id} className="py-3 px-4 text-right min-w-[160px] font-semibold text-foreground">
                      {coop.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-[11px]">
                {INCOME_STATEMENT_ROWS.map((row, rIdx) => {
                  if (row.isHeader) {
                    return (
                      <tr key={`h-${rIdx}`} className="bg-muted/10 font-bold">
                        <td className="py-2.5 px-4 sticky left-0 bg-background border-r border-border font-sans font-bold text-primary uppercase text-[9px] tracking-wide">
                          {row.label}
                        </td>
                        {filteredMatrices.map((coop) => {
                          const val = row.computeFormula
                            ? row.computeFormula(coop.codeValues)
                            : row.codes.reduce((sum, code) => sum + (coop.codeValues[code] || 0), 0);
                          return (
                            <td key={coop.id} className="py-2.5 px-4 text-right font-bold text-foreground">
                              {formatCurrency(val)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  return (
                    <tr key={`r-${rIdx}`} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2 px-4 sticky left-0 bg-background border-r border-border font-sans text-muted-foreground font-medium pl-6">
                        {row.label}
                      </td>
                      {filteredMatrices.map((coop) => {
                        const rawSum = row.codes.reduce((sum, code) => sum + (coop.codeValues[code] || 0), 0);
                        const val = rawSum * (row.multiplier || 1);
                        return (
                          <td key={coop.id} className="py-2 px-4 text-right text-slate-700">
                            {formatCurrency(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-muted-foreground text-xs">
            No cooperative data found for this period.
          </div>
        )}
      </Card>
    </div>
  );
}
