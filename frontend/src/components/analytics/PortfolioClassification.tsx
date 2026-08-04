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
import { Loader2, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

interface PortfolioClassificationProps {
  reportingYear: number;
  filterParams?: NationalOverviewParams;
}

interface ClassificationRow {
  label: string;
  isHeader?: boolean;
  codes: number[];
  multiplier?: number;
  computeFormula?: (coopData: Record<number, number>) => number;
}

function buildClassificationRows(t: TFunction): ClassificationRow[] {
  const b = (letter: string, days: string) => t("analytics.daysBucket", { letter, days });

  const productive = [
    b("a", t("analytics.days1to30")),
    b("a", t("analytics.days31to90")),
    b("a", t("analytics.days91to180")),
    b("a", t("analytics.days181to360")),
    b("a", t("analytics.daysMore360")),
  ];
  const consumption = [
    b("b", t("analytics.days1to30")),
    b("b", t("analytics.days31to90")),
    b("b", t("analytics.days91to180")),
    b("b", t("analytics.daysMore180")),
  ];
  const housing = [
    b("c", t("analytics.days1to30")),
    b("c", t("analytics.days31to90")),
    b("c", t("analytics.days91to360")),
    b("c", t("analytics.daysMore360")),
  ];
  const microcredit = [
    b("d", t("analytics.days1to30")),
    b("d", t("analytics.days31to90")),
    b("d", t("analytics.days91to180")),
    b("d", t("analytics.days181to360")),
    b("d", t("analytics.daysMore360")),
  ];
  const publicHousing = [
    b("h", t("analytics.days1to30")),
    b("h", t("analytics.days31to90")),
    b("h", t("analytics.days91to360")),
    b("h", t("analytics.daysMore360")),
  ];
  const educational = [
    b("i", t("analytics.days1to30")),
    b("i", t("analytics.days31to90")),
    b("i", t("analytics.days91to180")),
    b("i", t("analytics.days181to360")),
    b("i", t("analytics.daysMore360")),
  ];

  const mapBuckets = (letters: string[], source: string[]): string[] =>
    source.map((days) => b(letters[source.indexOf(days)], days));

  const rows: ClassificationRow[] = [];

  // 1. Performing
  rows.push({ label: t("analytics.pcTotalPerformingHeader"), isHeader: true, codes: [1201] });
  rows.push({ label: t("analytics.pcProductivePerforming"), isHeader: true, codes: [] });
  productive.forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcConsumptionPerforming"), isHeader: true, codes: [] });
  consumption.forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcHousingPerforming"), isHeader: true, codes: [] });
  housing.forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcMicrocreditPerforming"), isHeader: true, codes: [] });
  microcredit.forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcPublicHousingPerforming"), isHeader: true, codes: [] });
  publicHousing.forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcEducationalPerforming"), isHeader: true, codes: [] });
  educational.forEach((l) => rows.push({ label: l, codes: [] }));

  // 2. Non-Accrual
  rows.push({
    label: t("analytics.pcTotalNonAccrual"),
    isHeader: true,
    codes: [],
    computeFormula: () => 0,
  });
  rows.push({ label: t("analytics.pcProductiveNonAccrual"), isHeader: true, codes: [] });
  mapBuckets(["j", "j", "j", "j", "j"], productive).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );
  rows.push({ label: t("analytics.pcConsumptionNonAccrual"), isHeader: true, codes: [] });
  mapBuckets(["k", "k", "k", "k"], consumption).forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcHousingNonAccrual"), isHeader: true, codes: [] });
  mapBuckets(["l", "l", "l", "l"], housing).forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcMicrocreditNonAccrual"), isHeader: true, codes: [] });
  mapBuckets(["m", "m", "m", "m", "m"], microcredit).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );
  rows.push({ label: t("analytics.pcPublicHousingNonAccrual"), isHeader: true, codes: [] });
  mapBuckets(["p", "p", "p", "p"], publicHousing).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );
  rows.push({ label: t("analytics.pcEducationalNonAccrual"), isHeader: true, codes: [] });
  mapBuckets(["q", "q", "q", "q", "q"], educational).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );

  // 3. Arrears / Past Due
  rows.push({
    label: t("analytics.pcTotalArrearsHeader"),
    isHeader: true,
    codes: [],
    computeFormula: (coop) => (coop[1202] || 0) + (coop[1203] || 0) + (coop[1204] || 0),
  });
  rows.push({ label: t("analytics.pcProductivePastDue"), isHeader: true, codes: [] });
  mapBuckets(["r", "r", "r", "r", "r"], productive).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );
  rows.push({ label: t("analytics.pcConsumptionPastDue"), isHeader: true, codes: [] });
  mapBuckets(["s", "s", "s", "s"], consumption).forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcHousingPastDue"), isHeader: true, codes: [] });
  mapBuckets(["t", "t", "t", "t"], housing).forEach((l) => rows.push({ label: l, codes: [] }));
  rows.push({ label: t("analytics.pcMicrocreditPastDue"), isHeader: true, codes: [] });
  mapBuckets(["u", "u", "u", "u", "u"], microcredit).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );
  rows.push({ label: t("analytics.pcPublicHousingPastDue"), isHeader: true, codes: [] });
  mapBuckets(["y", "y", "y", "y"], publicHousing).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );
  rows.push({ label: t("analytics.pcEducationalPastDue"), isHeader: true, codes: [] });
  mapBuckets(["z", "z", "z", "z", "z"], educational).forEach((l) =>
    rows.push({ label: l, codes: [] }),
  );

  // 4. Non-Performing
  rows.push({
    label: t("analytics.pcTotalNonPerformingHeader"),
    isHeader: true,
    codes: [1205],
  });

  // 5. Total Gross
  rows.push({
    label: t("analytics.pcTotalGross"),
    isHeader: true,
    codes: [],
    computeFormula: (coop) =>
      (coop[1201] || 0) +
      (coop[1202] || 0) +
      (coop[1203] || 0) +
      (coop[1204] || 0) +
      (coop[1205] || 0),
  });

  // 6. Provisions
  rows.push({
    label: t("analytics.pcLoanLossProvisionsHeader"),
    isHeader: true,
    codes: [1250, 1251, 1252],
    multiplier: -1,
  });

  // 7. Total Net
  rows.push({
    label: t("analytics.pcTotalNet"),
    isHeader: true,
    codes: [],
    computeFormula: (coop) => {
      const gross =
        (coop[1201] || 0) +
        (coop[1202] || 0) +
        (coop[1203] || 0) +
        (coop[1204] || 0) +
        (coop[1205] || 0);
      const provs = (coop[1250] || 0) + (coop[1251] || 0) + (coop[1252] || 0);
      return gross - provs;
    },
  });

  return rows;
}

export function PortfolioClassification({
  reportingYear,
  filterParams,
}: PortfolioClassificationProps) {
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

  const classificationRows = useMemo(() => buildClassificationRows(t), [t]);

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

  const isLoading = isOverviewLoading || isCompLoading;

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
        {t("analytics.loadingPortfolioClassification")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Excel Blue Banner with Slicers */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t("analytics.portfolioClassificationTitle")}
          </h2>
          <p className="text-xs text-blue-200/80 mt-1 font-medium">
            {t("analytics.portfolioClassificationSubtitle", { year: reportingYear })}
          </p>
        </div>

        {/* Slicers Section */}
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[120px]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
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
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
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
                    className="text-xs font-bold text-red-600"
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
          <span className="font-bold block mb-1">{t("analytics.spreadsheetAccountMapping")}</span>
          {t("analytics.spreadsheetAccountMappingDesc")}
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li>
              <strong>{t("analytics.pcTotalPerformingLoans")}</strong>:{" "}
              {t("analytics.pcTotalPerformingCode")}
            </li>
            <li>
              <strong>{t("analytics.pcTotalArrears")}</strong>: {t("analytics.pcTotalArrearsCode")}
            </li>
            <li>
              <strong>{t("analytics.pcTotalNonPerforming")}</strong>:{" "}
              {t("analytics.pcTotalNonPerformingCode")}
            </li>
            <li>
              <strong>{t("analytics.pcLoanLossProvisions")}</strong>:{" "}
              {t("analytics.pcLoanLossProvisionsCode")}
            </li>
          </ul>
          {t("analytics.pcNote")}
        </div>
      </div>

      {/* Grid Comparative Table */}
      <Card title={t("analytics.pcGridTitle")} subtitle={t("analytics.sideBySideComparison")}>
        {filteredMatrices.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 w-96 sticky left-0 bg-background border-r border-border z-10">
                    {t("analytics.categoryMaturity")}
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
              <tbody className="divide-y divide-border font-mono text-[11px]">
                {classificationRows.map((row, rIdx) => {
                  if (row.isHeader) {
                    return (
                      <tr key={`h-${rIdx}`} className="bg-muted/10 font-bold">
                        <td className="py-2.5 px-4 sticky left-0 bg-background border-r border-border font-sans font-bold text-primary uppercase text-[9px] tracking-wide">
                          {row.label}
                        </td>
                        {filteredMatrices.map((coop) => {
                          const val = row.computeFormula
                            ? row.computeFormula(coop.codeValues)
                            : row.codes.reduce(
                                (sum, code) => sum + (coop.codeValues[code] || 0),
                                0,
                              );
                          return (
                            <td
                              key={coop.id}
                              className="py-2.5 px-4 text-right font-bold text-foreground"
                            >
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
                        const rawSum = row.codes.reduce(
                          (sum, code) => sum + (coop.codeValues[code] || 0),
                          0,
                        );
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
            {t("analytics.noCoopDataForPeriod")}
          </div>
        )}
      </Card>
    </div>
  );
}
