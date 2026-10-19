import { CheckCircle2, AlertCircle, BarChart3, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { periodTotals } from "./balance";
import { fmt } from "./helpers";
import { Spinner } from "@/components/ui/spinner";

interface ReviewSummaryProps {
  financialData: Record<number, Record<number, number>>;
  /** Columns of the period being entered, in order (`[0]` for a yearly return). */
  activeMonths: readonly number[];
  currency: string;
  onSubmitFinancial: () => void;
  isSubmitting: boolean;
}

export function ReviewSummary({
  financialData,
  activeMonths,
  currency,
  onSubmitFinancial,
  isSubmitting,
}: ReviewSummaryProps) {
  const { t } = useTranslation();
  const { totalAssets, totalLiabilities, totalEquity, totalIncome, totalExpenses } = periodTotals(
    financialData,
    activeMonths,
  );
  const netSurplus = totalIncome - totalExpenses;

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  const cardItems = [
    { label: t("reviewSummary.labels.totalAssets"), value: totalAssets, key: "totalAssets" },
    {
      label: t("reviewSummary.labels.totalLiabilities"),
      value: totalLiabilities,
      key: "totalLiabilities",
    },
    { label: t("reviewSummary.labels.totalEquity"), value: totalEquity, key: "totalEquity" },
    { label: t("reviewSummary.labels.annualIncome"), value: totalIncome, key: "annualIncome" },
    {
      label: t("reviewSummary.labels.annualExpenses"),
      value: totalExpenses,
      key: "annualExpenses",
    },
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
            <h3 className="text-sm font-bold text-foreground">{t("reviewSummary.title")}</h3>
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
              : t("reviewSummary.balancedGap", {
                  gap: fmt(Math.abs(totalAssets - totalLiabilities - totalEquity)),
                })}
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
        {isSubmitting ? <Spinner size="sm" /> : <Send className="size-4" />}
        {t("reviewSummary.submitBtn")}
      </button>
    </div>
  );
}
