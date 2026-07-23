import React, { useState, useMemo } from "react";
import { useComparativeStatements } from "@/hooks/analytics/useComparativeStatements";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { Card } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Info } from "lucide-react";

interface FinancialIndicatorsProps {
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

interface IndicatorRow {
  label: string;
  isHeader?: boolean;
  unit: "%" | "SZL" | "ratio";
  computeFormula: (
    kpis: Record<string, any>,
    accounts: Record<number, number>
  ) => number | null;
}

const INDICATOR_ROWS: IndicatorRow[] = [
  // 1. Patrimonial Sufficiency
  { label: "PATRIMONIAL SUFFICIENCY (SUFICIENCIA PATRIMONIAL)", isHeader: true, unit: "%", computeFormula: () => null },
  {
    label: "  Capital Adequacy Ratio: Total Equity / Total Assets",
    unit: "%",
    computeFormula: (kpis) => kpis["capital_adequacy_ratio"]?.value ?? null,
  },

  // 2. Asset Quality
  { label: "ASSET STRUCTURE & QUALITY (ESTRUCTURA Y CALIDAD DE ACTIVOS)", isHeader: true, unit: "%", computeFormula: () => null },
  {
    label: "  Earning Assets / Total Assets",
    unit: "%",
    computeFormula: (kpis, accounts) => {
      const grossLoans = accounts[1200] || 0;
      const totalAssets = accounts[1999] || 0;
      return totalAssets > 0 ? (grossLoans / totalAssets) * 100 : null;
    },
  },
  {
    label: "  Earning Assets / Cost-Bearing Liabilities",
    unit: "%",
    computeFormula: (kpis, accounts) => {
      const grossLoans = accounts[1200] || 0;
      const deposits = accounts[2100] || 0;
      return deposits > 0 ? (grossLoans / deposits) * 100 : null;
    },
  },

  // 3. Delinquency
  { label: "DELINQUENCY RATIOS (INDICES DE MOROSIDAD)", isHeader: true, unit: "%", computeFormula: () => null },
  {
    label: "  Total Delinquency Ratio (NPL Ratio)",
    unit: "%",
    computeFormula: (kpis) => kpis["npl_ratio"]?.value ?? null,
  },
  {
    label: "  Portfolio at Risk > 30 Days (PAR 30)",
    unit: "%",
    computeFormula: (kpis) => kpis["par30"]?.value ?? null,
  },
  {
    label: "  Productive Loan Delinquency",
    unit: "%",
    computeFormula: (kpis, accounts) => {
      const arrears = (accounts[1202] || 0) + (accounts[1203] || 0) + (accounts[1204] || 0);
      const gross = accounts[1200] || 1;
      return arrears > 0 ? (arrears / gross) * 100 : 0;
    },
  },

  // 4. Provision Coverage
  { label: "PROVISION COVERAGE FOR ARREARS", isHeader: true, unit: "%", computeFormula: () => null },
  {
    label: "  Loan Loss Provisions / Total Arrears (Coverage)",
    unit: "%",
    computeFormula: (kpis) => kpis["loan_loss_coverage"]?.value ?? null,
  },

  // 5. Operating Efficiency
  { label: "MICROECONOMIC EFFICIENCY (EFICIENCIA MICROECONOMICA)", isHeader: true, unit: "%", computeFormula: () => null },
  {
    label: "  Operating Expense Ratio: Operating Expenses / Total Assets",
    unit: "%",
    computeFormula: (kpis) => kpis["operating_expense_ratio"]?.value ?? null,
  },
  {
    label: "  Operating Expenses / Net Interest Margin",
    unit: "%",
    computeFormula: (kpis, accounts) => {
      const opex = (accounts[5201] || 0) + (accounts[5202] || 0) + (accounts[5203] || 0) + (accounts[5204] || 0);
      const inc = (accounts[4101] || 0) + (accounts[4102] || 0);
      const exp = (accounts[5101] || 0) + (accounts[5102] || 0);
      const margin = inc - exp;
      return margin > 0 ? (opex / margin) * 100 : null;
    },
  },

  // 6. Profitability
  { label: "PROFITABILITY (RENTABILIDAD)", isHeader: true, unit: "%", computeFormula: () => null },
  {
    label: "  Return on Assets (ROA)",
    unit: "%",
    computeFormula: (kpis) => kpis["roa"]?.value ?? null,
  },
  {
    label: "  Return on Equity (ROE)",
    unit: "%",
    computeFormula: (kpis) => kpis["roe"]?.value ?? null,
  },
  {
    label: "  Operational Self-Sufficiency (OSS)",
    unit: "%",
    computeFormula: (kpis) => kpis["operational_self_sufficiency"]?.value ?? null,
  },

  // 7. Liquidity & Intermediation
  { label: "FINANCIAL INTERMEDIATION & LIQUIDITY (LIQUIDEZ)", isHeader: true, unit: "%", computeFormula: () => null },
  {
    label: "  Liquid Funds Ratio: Liquid Assets / Total Assets",
    unit: "%",
    computeFormula: (kpis) => kpis["liquid_funds_ratio"]?.value ?? null,
  },
  {
    label: "  Gross Loans / Member Deposits",
    unit: "%",
    computeFormula: (kpis, accounts) => {
      const grossLoans = accounts[1200] || 0;
      const deposits = accounts[2100] || 0;
      return deposits > 0 ? (grossLoans / deposits) * 100 : null;
    },
  },
];

export function FinancialIndicators({ reportingYear }: FinancialIndicatorsProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("12");
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([]);

  // Fetch KPI dataset
  const { data: overview, isLoading: isOverviewLoading } = useNationalOverview({ reportingYear });

  // Fetch raw comparative statement line items
  const { data: comparative, isLoading: isCompLoading } = useComparativeStatements({
    reportingYear,
  });

  const formatValue = (val: number | null, unit: string) => {
    if (val === null) return "-";
    if (unit === "%") return `${val.toFixed(2)}%`;
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Group line items by cooperative and sum values per account code
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

      // Match calculated KPIs from overview
      const overviewCoop = overview?.cooperatives.find(
        (c) => c.cooperative_id === grid.cooperative_id
      );
      const kpis = overviewCoop?.kpis || {};

      return {
        id: grid.cooperative_id,
        name: grid.cooperative_name,
        codeValues: map,
        kpis,
      };
    });
  }, [comparative, selectedMonth, overview]);

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

  if (isOverviewLoading || isCompLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading financial indicators...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Excel Blue Banner with Slicers */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Financial Indicators
          </h2>
          <p className="text-xs text-blue-200/80 mt-1 font-medium">
            Supervisory Audits, Financial Ratios & Performance Indicators ({reportingYear})
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
          <span className="font-bold block mb-1">Financial Ratios & Mappings:</span>
          This dashboard aggregates key prudential and efficiency ratios:
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>Capital Adequacy Ratio</strong>: Measures solvency by comparing institutional equity to total assets.</li>
            <li><strong>Delinquency / NPL</strong>: Outstanding loans in arrears past 90 days relative to gross portfolio.</li>
            <li><strong>ROA / ROE</strong>: Profitability metrics comparing net surplus to assets and equity.</li>
            <li><strong>Operating Efficiency</strong>: Operational overhead cost weight relative to interest spreads.</li>
          </ul>
        </div>
      </div>

      {/* Grid Comparative Table */}
      <Card
        title="Prudential & Financial Ratios Spreadsheet Grid"
        subtitle="Side-by-side indicator analysis"
      >
        {filteredMatrices.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 w-96 sticky left-0 bg-background border-r border-border z-10">
                    Financial Indicator / Key Ratios
                  </th>
                  {filteredMatrices.map((coop) => (
                    <th key={coop.id} className="py-3 px-4 text-right min-w-[160px] font-semibold text-foreground">
                      {coop.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-[11px]">
                {INDICATOR_ROWS.map((row, rIdx) => {
                  if (row.isHeader) {
                    return (
                      <tr key={`h-${rIdx}`} className="bg-muted/10 font-bold">
                        <td className="py-2.5 px-4 sticky left-0 bg-background border-r border-border font-sans font-bold text-primary uppercase text-[9px] tracking-wide">
                          {row.label}
                        </td>
                        {filteredMatrices.map((coop) => (
                          <td key={coop.id} className="py-2.5 px-4 text-right font-bold text-foreground">
                            {/* Empty value for categories */}
                            -
                          </td>
                        ))}
                      </tr>
                    );
                  }

                  return (
                    <tr key={`r-${rIdx}`} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2 px-4 sticky left-0 bg-background border-r border-border font-sans text-muted-foreground font-medium pl-6">
                        {row.label}
                      </td>
                      {filteredMatrices.map((coop) => {
                        const val = row.computeFormula(coop.kpis, coop.codeValues);
                        return (
                          <td key={coop.id} className="py-2 px-4 text-right text-slate-700">
                            {formatValue(val, row.unit)}
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
