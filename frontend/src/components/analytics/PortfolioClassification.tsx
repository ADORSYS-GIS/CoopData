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

interface PortfolioClassificationProps {
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

interface ClassificationRow {
  label: string;
  isHeader?: boolean;
  codes: number[];
  multiplier?: number;
  computeFormula?: (coopData: Record<number, number>) => number;
}

const CLASSIFICATION_ROWS: ClassificationRow[] = [
  // 1. Performing
  { label: "TOTAL PERFORMING LOANS", isHeader: true, codes: [1201] },
  { label: "PRODUCTIVE LOANS PERFORMING", isHeader: true, codes: [] },
  { label: "  a. 1 to 30 Days", codes: [] },
  { label: "  a. 31 to 90 Days", codes: [] },
  { label: "  a. 91 to 180 Days", codes: [] },
  { label: "  a. 181 to 360 Days", codes: [] },
  { label: "  a. More than 360 Days", codes: [] },
  { label: "CONSUMPTION LOANS PERFORMING", isHeader: true, codes: [] },
  { label: "  b. 1 to 30 Days", codes: [] },
  { label: "  b. 31 to 90 Days", codes: [] },
  { label: "  b. 91 to 180 Days", codes: [] },
  { label: "  b. More than 180 Days", codes: [] },
  { label: "HOUSING & REAL ESTATE LOANS PERFORMING", isHeader: true, codes: [] },
  { label: "  c. 1 to 30 Days", codes: [] },
  { label: "  c. 31 to 90 Days", codes: [] },
  { label: "  c. 91 to 360 Days", codes: [] },
  { label: "  c. More than 360 Days", codes: [] },
  { label: "MICROCREDIT LOANS PERFORMING", isHeader: true, codes: [] },
  { label: "  d. 1 to 30 Days", codes: [] },
  { label: "  d. 31 to 90 Days", codes: [] },
  { label: "  d. 91 to 180 Days", codes: [] },
  { label: "  d. 181 to 360 Days", codes: [] },
  { label: "  d. More than 360 Days", codes: [] },
  { label: "PUBLIC INTEREST HOUSING PERFORMING", isHeader: true, codes: [] },
  { label: "  h. 1 to 30 Days", codes: [] },
  { label: "  h. 31 to 90 Days", codes: [] },
  { label: "  h. 91 to 360 Days", codes: [] },
  { label: "  h. More than 360 Days", codes: [] },
  { label: "EDUCATIONAL LOANS PERFORMING", isHeader: true, codes: [] },
  { label: "  i. 1 to 30 Days", codes: [] },
  { label: "  i. 31 to 90 Days", codes: [] },
  { label: "  i. 91 to 180 Days", codes: [] },
  { label: "  i. 181 to 360 Days", codes: [] },
  { label: "  i. More than 360 Days", codes: [] },

  // 2. Non-Accrual
  { label: "TOTAL NON-ACCRUAL PORTFOLIO", isHeader: true, codes: [], computeFormula: () => 0 },
  { label: "PRODUCTIVE LOANS (NON-ACCRUAL)", isHeader: true, codes: [] },
  { label: "  j. 1 to 30 Days", codes: [] },
  { label: "  j. 31 to 90 Days", codes: [] },
  { label: "  j. 91 to 180 Days", codes: [] },
  { label: "  j. 181 to 360 Days", codes: [] },
  { label: "  j. More than 360 Days", codes: [] },
  { label: "CONSUMPTION LOANS (NON-ACCRUAL)", isHeader: true, codes: [] },
  { label: "  k. 1 to 30 Days", codes: [] },
  { label: "  k. 31 to 90 Days", codes: [] },
  { label: "  k. 91 to 180 Days", codes: [] },
  { label: "  k. More than 180 Days", codes: [] },
  { label: "HOUSING & REAL ESTATE LOANS (NON-ACCRUAL)", isHeader: true, codes: [] },
  { label: "  l. 1 to 30 Days", codes: [] },
  { label: "  l. 31 to 90 Days", codes: [] },
  { label: "  l. 91 to 360 Days", codes: [] },
  { label: "  l. More than 360 Days", codes: [] },
  { label: "MICROCREDIT LOANS (NON-ACCRUAL)", isHeader: true, codes: [] },
  { label: "  m. 1 to 30 Days", codes: [] },
  { label: "  m. 31 to 90 Days", codes: [] },
  { label: "  m. 91 to 180 Days", codes: [] },
  { label: "  m. 181 to 360 Days", codes: [] },
  { label: "  m. More than 360 Days", codes: [] },
  { label: "PUBLIC INTEREST HOUSING (NON-ACCRUAL)", isHeader: true, codes: [] },
  { label: "  p. 1 to 30 Days", codes: [] },
  { label: "  p. 31 to 90 Days", codes: [] },
  { label: "  p. 91 to 360 Days", codes: [] },
  { label: "  p. More than 360 Days", codes: [] },
  { label: "EDUCATIONAL LOANS (NON-ACCRUAL)", isHeader: true, codes: [] },
  { label: "  q. 1 to 30 Days", codes: [] },
  { label: "  q. 31 to 90 Days", codes: [] },
  { label: "  q. 91 to 180 Days", codes: [] },
  { label: "  q. 181 to 360 Days", codes: [] },
  { label: "  q. More than 360 Days", codes: [] },

  // 3. Arrears / Past Due
  {
    label: "TOTAL ARREARS / PAST DUE PORTFOLIO",
    isHeader: true,
    codes: [],
    computeFormula: (coop) => (coop[1202] || 0) + (coop[1203] || 0) + (coop[1204] || 0),
  },
  { label: "PRODUCTIVE LOANS (PAST DUE)", isHeader: true, codes: [] },
  { label: "  r. 1 to 30 Days", codes: [] },
  { label: "  r. 31 to 90 Days", codes: [] },
  { label: "  r. 91 to 180 Days", codes: [] },
  { label: "  r. 181 to 360 Days", codes: [] },
  { label: "  r. More than 360 Days", codes: [] },
  { label: "CONSUMPTION LOANS (PAST DUE)", isHeader: true, codes: [] },
  { label: "  s. 1 to 30 Days", codes: [] },
  { label: "  s. 31 to 90 Days", codes: [] },
  { label: "  s. 91 to 180 Days", codes: [] },
  { label: "  s. More than 180 Days", codes: [] },
  { label: "HOUSING & REAL ESTATE LOANS (PAST DUE)", isHeader: true, codes: [] },
  { label: "  t. 1 to 30 Days", codes: [] },
  { label: "  t. 31 to 90 Days", codes: [] },
  { label: "  t. 91 to 360 Days", codes: [] },
  { label: "  t. More than 360 Days", codes: [] },
  { label: "MICROCREDIT LOANS (PAST DUE)", isHeader: true, codes: [] },
  { label: "  u. 1 to 30 Days", codes: [] },
  { label: "  u. 31 to 90 Days", codes: [] },
  { label: "  u. 91 to 180 Days", codes: [] },
  { label: "  u. 181 to 360 Days", codes: [] },
  { label: "  u. More than 360 Days", codes: [] },
  { label: "PUBLIC INTEREST HOUSING (PAST DUE)", isHeader: true, codes: [] },
  { label: "  y. 1 to 30 Days", codes: [] },
  { label: "  y. 31 to 90 Days", codes: [] },
  { label: "  y. 91 to 360 Days", codes: [] },
  { label: "  y. More than 360 Days", codes: [] },
  { label: "EDUCATIONAL LOANS (PAST DUE)", isHeader: true, codes: [] },
  { label: "  z. 1 to 30 Days", codes: [] },
  { label: "  z. 31 to 90 Days", codes: [] },
  { label: "  z. 91 to 180 Days", codes: [] },
  { label: "  z. 181 to 360 Days", codes: [] },
  { label: "  z. More than 360 Days", codes: [] },

  // 4. Non-Performing
  { label: "TOTAL NON-PERFORMING / IMPAIRED PORTFOLIO", isHeader: true, codes: [1205] },

  // 5. Total Gross
  {
    label: "TOTAL GROSS PORTFOLIO",
    isHeader: true,
    codes: [],
    computeFormula: (coop) =>
      (coop[1201] || 0) + (coop[1202] || 0) + (coop[1203] || 0) + (coop[1204] || 0) + (coop[1205] || 0),
  },

  // 6. Provisions
  { label: "LOAN LOSS PROVISIONS", isHeader: true, codes: [1250, 1251, 1252], multiplier: -1 },

  // 7. Total Net
  {
    label: "TOTAL NET PORTFOLIO",
    isHeader: true,
    codes: [],
    computeFormula: (coop) => {
      const gross =
        (coop[1201] || 0) + (coop[1202] || 0) + (coop[1203] || 0) + (coop[1204] || 0) + (coop[1205] || 0);
      const provs = (coop[1250] || 0) + (coop[1251] || 0) + (coop[1252] || 0);
      return gross - provs;
    },
  },
];

export function PortfolioClassification({ reportingYear }: PortfolioClassificationProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("12");
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([]);

  const { data: comparative, isLoading } = useComparativeStatements({
    reportingYear,
  });

  const formatCurrency = (val: number) => {
    if (val === 0) return "-";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Group line items by cooperative and sum values per account code
  const coopMatrices = useMemo(() => {
    if (!comparative?.grids) return [];

    return comparative.grids.map((grid) => {
      const lineItems = grid.line_items || [];
      const filtered = lineItems.filter((item) => String(item.month) === selectedMonth);

      // Sum values per account code
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

  // Filter matrices by selected cooperatives (slicer)
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
        Loading portfolio classification grid...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Excel Blue Banner with Slicers */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Portfolio Classification Statistics
          </h2>
          <p className="text-xs text-blue-200/80 mt-1 font-medium">
            Maturity Aging Brackets & Category Breakdown ({reportingYear})
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
          <span className="font-bold block mb-1">Spreadsheet Account Mapping:</span>
          The cooperative's raw credit portfolio is mapped to the standard chart of accounts:
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>Total Performing Loans</strong>: Mapped to account code 1201.</li>
            <li><strong>Total Arrears / Past Due</strong>: Sum of account codes 1202 (1-30 days), 1203 (31-60 days), and 1204 (61-90 days).</li>
            <li><strong>Total Non-Performing</strong>: Mapped to account code 1205 (non-performing loans &gt; 90 days).</li>
            <li><strong>Loan Loss Provisions</strong>: Mapped to account code 1250.</li>
          </ul>
          Note: Product-specific subcategories (Productive, Consumption, Microcredit, etc.) are consolidated into the main category totals in the standard chart of accounts.
        </div>
      </div>

      {/* Grid Comparative Table */}
      <Card
        title="Portfolio Classification Spreadsheet Grid"
        subtitle="Side-by-side comparison sheet"
      >
        {filteredMatrices.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 w-96 sticky left-0 bg-background border-r border-border z-10">
                    Category & Maturity
                  </th>
                  {filteredMatrices.map((coop) => (
                    <th key={coop.id} className="py-3 px-4 text-right min-w-[160px] font-semibold text-foreground">
                      {coop.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-[11px]">
                {CLASSIFICATION_ROWS.map((row, rIdx) => {
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
