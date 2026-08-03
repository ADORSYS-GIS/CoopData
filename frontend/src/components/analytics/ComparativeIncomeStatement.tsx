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

interface ComparativeIncomeStatementProps {
  reportingYear: number;
  filterParams?: NationalOverviewParams;
}


interface IncomeStatementRow {
  label: string;
  subLabel?: string;
  isHeader?: boolean;
  codes: number[];
  multiplier?: number;
  computeFormula?: (coopData: Record<number, number>) => number;
}

function buildIncomeStatementRows(t: TFunction): IncomeStatementRow[] {
  return [
    { label: t("analytics.financialRevenues"), isHeader: true, codes: [] },
    {
      label: t("analytics.interestOnLoans"),
      subLabel: t("analytics.codeX", { code: "4101" }),
      codes: [4101],
    },
    {
      label: t("analytics.interestOnInvestments"),
      subLabel: t("analytics.codeX", { code: "4102" }),
      codes: [4102],
    },
    {
      label: t("analytics.otherOperatingRevenues"),
      subLabel: t("analytics.codeX", { code: "4201" }),
      codes: [4201],
    },
    {
      label: t("analytics.totalRevenuesHeader"),
      isHeader: true,
      codes: [],
      computeFormula: (coop) => (coop[4101] || 0) + (coop[4102] || 0) + (coop[4201] || 0),
    },
    { label: t("analytics.financialExpensesHeader"), isHeader: true, codes: [] },
    {
      label: t("analytics.interestOnMemberDeposits"),
      subLabel: t("analytics.codeX", { code: "5101" }),
      codes: [5101],
      multiplier: -1,
    },
    {
      label: t("analytics.interestOnBorrowings"),
      subLabel: t("analytics.codeX", { code: "5102" }),
      codes: [5102],
      multiplier: -1,
    },
    {
      label: t("analytics.netInterestMarginHeader"),
      isHeader: true,
      codes: [],
      computeFormula: (coop) => {
        const inc = (coop[4101] || 0) + (coop[4102] || 0);
        const exp = (coop[5101] || 0) + (coop[5102] || 0);
        return inc - exp;
      },
    },
    { label: t("analytics.operatingGeneralExpenses"), isHeader: true, codes: [] },
    {
      label: t("analytics.personnelStaffExpenses"),
      subLabel: t("analytics.codeX", { code: "5201" }),
      codes: [5201],
      multiplier: -1,
    },
    {
      label: t("analytics.adminRentExpenses"),
      subLabel: t("analytics.codeX", { code: "5202" }),
      codes: [5202],
      multiplier: -1,
    },
    {
      label: t("analytics.depreciationAmortization"),
      subLabel: t("analytics.codeX", { code: "5203" }),
      codes: [5203],
      multiplier: -1,
    },
    {
      label: t("analytics.otherGeneralExpenses"),
      subLabel: t("analytics.codeX", { code: "5204" }),
      codes: [5204],
      multiplier: -1,
    },
    {
      label: t("analytics.provisionCreditLosses"),
      subLabel: t("analytics.codeX", { code: "5301" }),
      codes: [5301],
      multiplier: -1,
    },
    {
      label: t("analytics.netSurplusLoss"),
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
}

export function ComparativeIncomeStatement({
  reportingYear,
  filterParams,
}: ComparativeIncomeStatementProps) {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string>("12");

  const monthOptions = useMemo(() => [
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
  ], [t]);
  const [selectedCoopIds, setSelectedCoopIds] = useState<string[]>([]);

  const { data: overview, isLoading: isOverviewLoading } = useNationalOverview({
    reportingYear,
    ...filterParams,
  });

  const cooperativeIds = useMemo(() => {
    if (!overview?.cooperatives?.length) return undefined;
    return overview.cooperatives.map((c) => c.cooperative_id).join(",");
  }, [overview?.cooperatives]);

  const { data: comparative, isLoading: isCompLoading } = useComparativeStatements(
    { reportingYear, cooperativeIds },
    !!cooperativeIds,
  );

  const isLoading = isOverviewLoading || isCompLoading;

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
        {t("analytics.loadingComparativeStatement")}
      </div>
    );
  }

  const rows = buildIncomeStatementRows(t);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {t("analytics.incomeStatementComparison")}
          </h2>
          <p className="text-xs text-blue-200/80 mt-1 font-medium">
            {t("analytics.comparativeAuditSubtitle", { year: reportingYear })}
          </p>
        </div>

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

      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex gap-3 text-xs leading-relaxed shadow-sm">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">{t("analytics.incomeStatementMapping")}</span>
          {t("analytics.incomeStatementMappingDesc")}
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li>
              <strong>{t("analytics.totalRevenues")}</strong>: {t("analytics.totalRevenuesDesc")}
            </li>
            <li>
              <strong>{t("analytics.financialExpenses")}</strong>:{" "}
              {t("analytics.financialExpensesDesc")}
            </li>
            <li>
              <strong>{t("analytics.netInterestMargin")}</strong>:{" "}
              {t("analytics.netInterestMarginDesc")}
            </li>
            <li>
              <strong>{t("analytics.operatingExpenses")}</strong>:{" "}
              {t("analytics.operatingExpensesDesc")}
            </li>
          </ul>
        </div>
      </div>

      <Card
        title={t("analytics.incomeStatementGrid")}
        subtitle={t("analytics.sideBySideComparison")}
      >
        {filteredMatrices.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 w-96 sticky left-0 bg-background border-r border-border z-10">
                    {t("analytics.category")}
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
                {rows.map((row, rIdx) => {
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
                        {row.subLabel && (
                          <span className="block text-[9px] text-muted-foreground/60">
                            {row.subLabel}
                          </span>
                        )}
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
