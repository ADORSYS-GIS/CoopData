import React, { useState, useMemo } from "react";
import { useComparativeStatements } from "@/hooks/analytics/useComparativeStatements";
import {
  useNationalOverview,
  type NationalOverviewParams,
} from "@/hooks/analytics/useNationalOverview";
import { Card } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Spinner } from "@/components/ui/spinner";

interface FinancialIndicatorsProps {
  reportingYear: number;
  filterParams?: NationalOverviewParams;
}

interface IndicatorRow {
  label: string;
  isHeader?: boolean;
  unit: "%" | "SZL" | "ratio";
  computeFormula: (
    kpis: Record<string, { value: number }>,
    accounts: Record<number, number>,
  ) => number | null;
}

function buildIndicatorRows(t: TFunction): IndicatorRow[] {
  return [
    // 1. Patrimonial Sufficiency
    {
      label: t("analytics.indicatorPatrimonialSuff"),
      isHeader: true,
      unit: "%",
      computeFormula: () => null,
    },
    {
      label: t("analytics.indicatorCarEqAssets"),
      unit: "%",
      computeFormula: (kpis) => kpis["capital_adequacy_ratio"]?.value ?? null,
    },

    // 2. Asset Quality
    {
      label: t("analytics.indicatorAssetStructure"),
      isHeader: true,
      unit: "%",
      computeFormula: () => null,
    },
    {
      label: t("analytics.indicatorEarningAssets"),
      unit: "%",
      computeFormula: (kpis, accounts) => {
        const grossLoans = accounts[1200] || 0;
        const totalAssets = accounts[1999] || 0;
        return totalAssets > 0 ? (grossLoans / totalAssets) * 100 : null;
      },
    },
    {
      label: t("analytics.indicatorEarningLiabilities"),
      unit: "%",
      computeFormula: (kpis, accounts) => {
        const grossLoans = accounts[1200] || 0;
        const deposits = accounts[2100] || 0;
        return deposits > 0 ? (grossLoans / deposits) * 100 : null;
      },
    },

    // 3. Delinquency
    {
      label: t("analytics.indicatorDelinquencyRatios"),
      isHeader: true,
      unit: "%",
      computeFormula: () => null,
    },
    {
      label: t("analytics.indicatorTotalDelinquency"),
      unit: "%",
      computeFormula: (kpis) => kpis["npl_ratio"]?.value ?? null,
    },
    {
      label: t("analytics.indicatorPar30"),
      unit: "%",
      computeFormula: (kpis) => kpis["par30"]?.value ?? null,
    },
    {
      label: t("analytics.indicatorProductiveDelinquency"),
      unit: "%",
      computeFormula: (kpis, accounts) => {
        const arrears = (accounts[1202] || 0) + (accounts[1203] || 0) + (accounts[1204] || 0);
        const gross = accounts[1200] || 1;
        return arrears > 0 ? (arrears / gross) * 100 : 0;
      },
    },

    // 4. Provision Coverage
    {
      label: t("analytics.indicatorProvisionCoverage"),
      isHeader: true,
      unit: "%",
      computeFormula: () => null,
    },
    {
      label: t("analytics.indicatorCoverageRatio"),
      unit: "%",
      computeFormula: (kpis) => kpis["loan_loss_coverage"]?.value ?? null,
    },

    // 5. Operating Efficiency
    {
      label: t("analytics.indicatorMicroeconomicEfficiency"),
      isHeader: true,
      unit: "%",
      computeFormula: () => null,
    },
    {
      label: t("analytics.indicatorOpexRatio"),
      unit: "%",
      computeFormula: (kpis) => kpis["operating_expense_ratio"]?.value ?? null,
    },
    {
      label: t("analytics.indicatorOpexMargin"),
      unit: "%",
      computeFormula: (kpis, accounts) => {
        const opex =
          (accounts[5201] || 0) +
          (accounts[5202] || 0) +
          (accounts[5203] || 0) +
          (accounts[5204] || 0);
        const inc = (accounts[4101] || 0) + (accounts[4102] || 0);
        const exp = (accounts[5101] || 0) + (accounts[5102] || 0);
        const margin = inc - exp;
        return margin > 0 ? (opex / margin) * 100 : null;
      },
    },

    // 6. Profitability
    {
      label: t("analytics.indicatorProfitability"),
      isHeader: true,
      unit: "%",
      computeFormula: () => null,
    },
    {
      label: t("analytics.indicatorRoa"),
      unit: "%",
      computeFormula: (kpis) => kpis["roa"]?.value ?? null,
    },
    {
      label: t("analytics.indicatorRoe"),
      unit: "%",
      computeFormula: (kpis) => kpis["roe"]?.value ?? null,
    },
    {
      label: t("analytics.indicatorOss"),
      unit: "%",
      computeFormula: (kpis) => kpis["operational_self_sufficiency"]?.value ?? null,
    },

    // 7. Liquidity & Intermediation
    {
      label: t("analytics.indicatorIntermediationLiquidity"),
      isHeader: true,
      unit: "%",
      computeFormula: () => null,
    },
    {
      label: t("analytics.indicatorLiquidFunds"),
      unit: "%",
      computeFormula: (kpis) => kpis["liquid_funds_ratio"]?.value ?? null,
    },
    {
      label: t("analytics.indicatorLoansDeposits"),
      unit: "%",
      computeFormula: (kpis, accounts) => {
        const grossLoans = accounts[1200] || 0;
        const deposits = accounts[2100] || 0;
        return deposits > 0 ? (grossLoans / deposits) * 100 : null;
      },
    },
  ];
}

export function FinancialIndicators({ reportingYear, filterParams }: FinancialIndicatorsProps) {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string>("12");

  const monthOptions = useMemo(
    () => [
      { value: "1", label: t("common.months.jan", "31. Jan ") },
      { value: "2", label: t("common.months.feb", "28. Feb ") },
      { value: "3", label: t("common.months.mar", "31. Mar ") },
      { value: "4", label: t("common.months.apr", "30. Apr ") },
      { value: "5", label: t("common.months.may", "31. May ") },
      { value: "6", label: t("common.months.jun", "30. Jun ") },
      { value: "7", label: t("common.months.jul", "31. Jul ") },
      { value: "8", label: t("common.months.aug", "31. Aug ") },
      { value: "9", label: t("common.months.sep", "30. Sep ") },
      { value: "10", label: t("common.months.oct", "31. Oct ") },
      { value: "11", label: t("common.months.nov", "30. Nov ") },
      { value: "12", label: t("common.months.dec", "31. Dec ") },
    ],
    [t],
  );
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([]);

  const indicatorRows = useMemo(() => buildIndicatorRows(t), [t]);

  // Fetch KPI dataset scoped by filters
  const { data: overview, isLoading: isOverviewLoading } = useNationalOverview({
    reportingYear,
    ...filterParams,
  });

  // Derive cooperative IDs from filtered overview for line-item fetch
  const cooperativeIds = useMemo(() => {
    if (!overview?.cooperatives?.length) return undefined;
    return overview.cooperatives.map((c) => c.cooperative_id).join(",");
  }, [overview?.cooperatives]);

  // Fetch raw comparative statement line items (scoped to filtered coops)
  const { data: comparative, isLoading: isCompLoading } = useComparativeStatements(
    { reportingYear, cooperativeIds },
    !!cooperativeIds,
  );

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
        (c) => c.cooperative_id === grid.cooperative_id,
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
        <Spinner size="md" className="mr-2 h-5 w-5 text-primary" />
        {t("analytics.loadingFinancialIndicators")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Excel Blue Banner with Slicers */}
      <div className="bg-gradient-to-r from-primary via-primary to-primary text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-primary">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t("analytics.financialIndicatorsTitle")}
          </h2>
          <p className="text-xs text-primary-foreground/80 mt-1 font-medium">
            {t("analytics.financialIndicatorsSubtitle", { year: reportingYear })}
          </p>
        </div>

        {/* Slicers Section */}
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[120px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/80 block mb-1">
              {t("analytics.date")}
            </span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full bg-white text-slate-900 border-0 h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs font-medium">
                    {m.label}
                    {reportingYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[200px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/80 block mb-1">
              {t("analytics.cooperativesLabel")}
            </span>
            <div className="relative">
              <Select onValueChange={handleCoopToggle}>
                <SelectTrigger className="w-full bg-white text-slate-900 border-0 h-8 text-xs font-semibold">
                  <span>
                    {selectedCoopIds.length === 0
                      ? t("analytics.allCooperatives")
                      : t("analytics.selectedCount", { count: selectedCoopIds.length })}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="clear_all_custom_option"
                    className="text-xs font-bold text-destructive"
                  >
                    {t("analytics.resetSelection")}
                  </SelectItem>
                  {coopMatrices.map((coop) => (
                    <SelectItem key={coop.id} value={coop.id} className="text-xs font-medium">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCoopIds.includes(coop.id)}
                          readOnly
                          className="rounded text-accent size-3"
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
      <div className="bg-accent/5 border border-accent/10 text-accent rounded-xl p-4 flex gap-3 text-xs leading-relaxed shadow-sm">
        <Info className="size-4 text-accent shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">{t("analytics.financialRatiosMappings")}</span>
          {t("analytics.financialRatiosMappingsDesc")}
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li>
              <strong>{t("analytics.capitalAdequacyRatioLabel")}</strong>:{" "}
              {t("analytics.ratiosCarInfo")}
            </li>
            <li>
              <strong>{t("analytics.delinquencyNplLabel")}</strong>:{" "}
              {t("analytics.ratiosDelinquencyInfo")}
            </li>
            <li>
              <strong>{t("analytics.roaRoeLabel")}</strong>: {t("analytics.ratiosRoaRoeInfo")}
            </li>
            <li>
              <strong>{t("analytics.operatingEfficiencyLabel")}</strong>:{" "}
              {t("analytics.ratiosOperatingEfficiencyInfo")}
            </li>
          </ul>
        </div>
      </div>

      {/* Grid Comparative Table */}
      <Card
        title={t("analytics.prudentialGridTitle")}
        subtitle={t("analytics.sideBySideIndicatorAnalysis")}
      >
        {filteredMatrices.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 w-96 sticky left-0 bg-background border-r border-border z-10">
                    {t("analytics.financialIndicatorKeyRatios")}
                  </th>
                  {filteredMatrices.map((coop) => (
                    <th
                      key={coop.id}
                      className="py-3 px-4 text-right min-w-[160px] font-semibold text-foreground"
                    >
                      {coop.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {indicatorRows.map((row, rIdx) => {
                  if (row.isHeader) {
                    return (
                      <tr key={`h-${rIdx}`} className="bg-muted/10 font-bold">
                        <td className="py-2.5 px-4 sticky left-0 bg-background border-r border-border font-sans font-bold text-primary uppercase text-[10px] tracking-wide">
                          {row.label}
                        </td>
                        {filteredMatrices.map((coop) => (
                          <td
                            key={coop.id}
                            className="py-2.5 px-4 text-right font-bold text-foreground"
                          >
                            {/* Empty value for categories */}-
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
            {t("analytics.noCoopDataForPeriod")}
          </div>
        )}
      </Card>
    </div>
  );
}
