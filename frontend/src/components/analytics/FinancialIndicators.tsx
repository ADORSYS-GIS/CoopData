import React, { useState, useMemo } from "react";
import { useComparativeStatements } from "@/hooks/analytics/useComparativeStatements";
import { accountValuesAt, provisionAmount, shareOf } from "@/lib/statement-grid";
import {
  useNationalOverview,
  type NationalOverviewParams,
} from "@/hooks/analytics/useNationalOverview";
import { FlatCard as Card } from "@/components/analytics/national/FlatCard";
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
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface FinancialIndicatorsProps {
  reportingYear: number;
  filterParams?: NationalOverviewParams;
}

interface IndicatorRow {
  key: string;
  label: string;
  isHeader?: boolean;
  unit: "%";
  compute: (accounts: Record<number, number>) => number | null;
}

const INCOME_ACCOUNT_CODES = [
  4101, 4102, 4201, 4999, 5101, 5102, 5201, 5202, 5203, 5204, 5301, 5999, 6999,
];

const hasIncomeData = (a: Record<number, number>): boolean =>
  INCOME_ACCOUNT_CODES.some((code) => (a[code] ?? 0) !== 0);

const sum = (a: Record<number, number>, codes: number[]): number =>
  codes.reduce((total, code) => total + (a[code] ?? 0), 0);

const totalIncome = (a: Record<number, number>): number =>
  a[4999] ? a[4999] : sum(a, [4101, 4102, 4201]);

const totalExpenses = (a: Record<number, number>): number =>
  a[5999] ? a[5999] : sum(a, [5101, 5102, 5201, 5202, 5203, 5204, 5301]);

const netSurplus = (a: Record<number, number>): number =>
  a[6999] ? a[6999] : totalIncome(a) - totalExpenses(a);

const arrears30 = (a: Record<number, number>): number => sum(a, [1203, 1204, 1205]);

const ifIncome =
  (fn: (a: Record<number, number>) => number | null) =>
  (a: Record<number, number>): number | null =>
    hasIncomeData(a) ? fn(a) : null;

const header = (key: string, label: string): IndicatorRow => ({
  key,
  label,
  isHeader: true,
  unit: "%",
  compute: () => null,
});

function buildIndicatorRows(t: TFunction): IndicatorRow[] {
  const row = (key: string, labelKey: string, compute: IndicatorRow["compute"]): IndicatorRow => ({
    key,
    label: t(labelKey),
    unit: "%",
    compute,
  });

  return [
    header("h1", t("analytics.indicatorPatrimonialSuff")),
    row("car", "analytics.indicatorCarEqAssets", (a) => shareOf(a[3999] ?? 0, a[1999] ?? 0)),
    header("h2", t("analytics.indicatorAssetStructure")),
    row("earning", "analytics.indicatorEarningAssets", (a) => shareOf(a[1200] ?? 0, a[1999] ?? 0)),
    row("earningLiab", "analytics.indicatorEarningLiabilities", (a) =>
      shareOf(a[1200] ?? 0, a[2100] ?? 0),
    ),
    header("h3", t("analytics.indicatorDelinquencyRatios")),
    row("npl", "analytics.indicatorTotalDelinquency", (a) => shareOf(a[1205] ?? 0, a[1200] ?? 0)),
    row("par30", "analytics.indicatorPar30", (a) => shareOf(arrears30(a), a[1200] ?? 0)),
    row("early", "analytics.indicatorProductiveDelinquency", (a) =>
      shareOf(sum(a, [1202, 1203, 1204]), a[1200] ?? 0),
    ),
    header("h4", t("analytics.indicatorProvisionCoverage")),
    row("coverage", "analytics.indicatorCoverageRatio", (a) =>
      shareOf(provisionAmount(a), arrears30(a)),
    ),
    header("h5", t("analytics.indicatorMicroeconomicEfficiency")),
    row(
      "opex",
      "analytics.indicatorOpexRatio",
      ifIncome((a) => shareOf(sum(a, [5201, 5202, 5203, 5204]), a[1999] ?? 0)),
    ),
    row(
      "opexMargin",
      "analytics.indicatorOpexMargin",
      ifIncome((a) =>
        shareOf(sum(a, [5201, 5202, 5203, 5204]), sum(a, [4101, 4102]) - sum(a, [5101, 5102])),
      ),
    ),
    header("h6", t("analytics.indicatorProfitability")),
    row(
      "roa",
      "analytics.indicatorRoa",
      ifIncome((a) => (a[1999] > 0 ? (netSurplus(a) / a[1999]) * 100 : null)),
    ),
    row(
      "roe",
      "analytics.indicatorRoe",
      ifIncome((a) => (a[3999] > 0 ? (netSurplus(a) / a[3999]) * 100 : null)),
    ),
    row(
      "oss",
      "analytics.indicatorOss",
      ifIncome((a) => shareOf(totalIncome(a), totalExpenses(a))),
    ),
    header("h7", t("analytics.indicatorIntermediationLiquidity")),
    row("liquid", "analytics.indicatorLiquidFunds", (a) => shareOf(a[1100] ?? 0, a[1999] ?? 0)),
    row("loansDeposits", "analytics.indicatorLoansDeposits", (a) =>
      shareOf(a[1200] ?? 0, a[2100] ?? 0),
    ),
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
    {
      reportingYear,
      cooperativeIds,
      periodType: filterParams?.periodType,
      periodValue: filterParams?.periodValue,
    },
    !!cooperativeIds,
  );

  const formatValue = (val: number | null) => (val === null ? "—" : `${val.toFixed(2)}%`);

  // Group line items by cooperative and sum values per account code
  const coopMatrices = useMemo(() => {
    if (!comparative?.grids) return [];

    return comparative.grids.map((grid) => {
      const values = accountValuesAt(grid.line_items || [], Number(selectedMonth));
      const map: Record<number, number> = values ?? {};

      return {
        id: grid.cooperative_id,
        name: grid.cooperative_name,
        codeValues: map,
        reported: values !== null,
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
        info={t("analytics.indicatorsGridInfo")}
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
                          <span className="inline-flex items-center gap-1.5">
                            {row.label}
                            {!row.isHeader && (
                              <InfoTooltip text={t(`analytics.indicatorTip.${row.key}`)} />
                            )}
                          </span>
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
                        <span className="inline-flex items-center gap-1.5">
                          {row.label}
                          {!row.isHeader && (
                            <InfoTooltip text={t(`analytics.indicatorTip.${row.key}`)} />
                          )}
                        </span>
                      </td>
                      {filteredMatrices.map((coop) => {
                        const val = coop.reported ? row.compute(coop.codeValues) : null;
                        return (
                          <td key={coop.id} className="py-2 px-4 text-right text-slate-700">
                            {formatValue(val)}
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
