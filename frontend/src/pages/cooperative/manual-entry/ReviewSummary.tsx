import { CheckCircle2, AlertCircle, BarChart3, Send, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { fmt } from "./helpers";

interface ReviewSummaryProps {
  financialData: Record<number, Record<number, number>>;
  accountingYear: "calendar" | "fiscal";
  currency: string;
  onSubmitFinancial: () => void;
  isSubmitting: boolean;
}

export function ReviewSummary({
  financialData,
  accountingYear,
  currency,
  onSubmitFinancial,
  isSubmitting,
}: ReviewSummaryProps) {
  const { t } = useTranslation();
  // Balance sheet is a snapshot at the final month of the reporting year
  const finalMonth = accountingYear === "fiscal" ? 6 : 12;

  const getVal = (code: number) => financialData[code]?.[finalMonth] || 0;

  const totalAssets =
    getVal(1101) +
    getVal(1102) +
    getVal(1103) +
    getVal(1104) + // Liquid
    (getVal(1201) + getVal(1202) + getVal(1203) + getVal(1204) + getVal(1205)) - // Loan Portfolio
    (getVal(1251) + getVal(1252)) + // Provisions
    (getVal(1301) + getVal(1302) + getVal(1303) - Math.abs(getVal(1304)) + getVal(1305)); // Other

  const totalLiabilities =
    getVal(2101) +
    getVal(2102) +
    getVal(2103) + // Member Deposits
    (getVal(2201) + getVal(2202)) + // Borrowings
    (getVal(2301) + getVal(2302) + getVal(2303)); // Other

  const totalEquity =
    getVal(3101) +
    getVal(3102) + // Shares
    (getVal(3201) + getVal(3202) + getVal(3203)) + // Reserves
    (getVal(3301) + getVal(3302)); // Retained

  // Income statement totals are aggregated sums of all 12 months
  let totalIncome = 0;
  let totalExpenses = 0;
  for (let m = 1; m <= 12; m++) {
    totalIncome +=
      (financialData[4101]?.[m] || 0) +
      (financialData[4102]?.[m] || 0) +
      (financialData[4201]?.[m] || 0);

    totalExpenses +=
      (financialData[5101]?.[m] || 0) +
      (financialData[5102]?.[m] || 0) +
      (financialData[5201]?.[m] || 0) +
      (financialData[5202]?.[m] || 0) +
      (financialData[5203]?.[m] || 0) +
      (financialData[5204]?.[m] || 0) +
      (financialData[5301]?.[m] || 0);
  }
  const netSurplus = totalIncome - totalExpenses;

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  const cardItems = [
    { label: t("reviewSummary.labels.totalAssets"), value: totalAssets, key: "totalAssets" },
    { label: t("reviewSummary.labels.totalLiabilities"), value: totalLiabilities, key: "totalLiabilities" },
    { label: t("reviewSummary.labels.totalEquity"), value: totalEquity, key: "totalEquity" },
    { label: t("reviewSummary.labels.annualIncome"), value: totalIncome, key: "annualIncome" },
    { label: t("reviewSummary.labels.annualExpenses"), value: totalExpenses, key: "annualExpenses" },
    { label: t("reviewSummary.labels.netSurplus"), value: netSurplus, key: "netSurplus" },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Financial summary */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <BarChart3 className="size-4 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              {t("reviewSummary.title")}
            </h3>
          </div>
          {cardItems.map(({ label, value, key }) => (
            <div key={key} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span
                className={`font-mono font-semibold ${key === "netSurplus" && value < 0 ? "text-danger" : ""}`}
              >
                {currency} {fmt(value)}
              </span>
            </div>
          ))}
          <div
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg mt-2 ${
              isBalanced ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {isBalanced ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <AlertCircle className="size-3.5" />
            )}
            {isBalanced
              ? t("reviewSummary.balancedSuccess")
              : t("reviewSummary.balancedGap", { gap: fmt(Math.abs(totalAssets - totalLiabilities - totalEquity)) })}
          </div>
        </Card>

        {/* Info card */}
        <Card className="p-5 space-y-3 flex flex-col justify-center text-center">
          <CheckCircle2 className="size-10 mx-auto text-success/80 mb-1" />
          <h4 className="text-sm font-bold text-foreground">{t("reviewSummary.readyTitle")}</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {t("reviewSummary.readyDesc")}
          </p>
        </Card>
      </div>

      <button
        onClick={onSubmitFinancial}
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm animate-pulse-subtle"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {t("reviewSummary.submitBtn")}
      </button>
    </div>
  );
}
