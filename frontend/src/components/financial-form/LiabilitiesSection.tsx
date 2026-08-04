import type { MemberDeposits, Borrowings, OtherLiabilities } from "@/lib/financial-data";
import { DollarSign, Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LiabilitiesSectionProps {
  memberDeposits: MemberDeposits;
  borrowings: Borrowings;
  otherLiabilities: OtherLiabilities;
  onChange: (
    section: "memberDeposits" | "borrowings" | "otherLiabilities",
    field: string,
    value: number,
  ) => void;
  totals: {
    totalMemberDeposits: number;
    totalBorrowings: number;
    totalOtherLiabilities: number;
    totalLiabilities: number;
  };
}

export function LiabilitiesSection({
  memberDeposits,
  borrowings,
  otherLiabilities,
  onChange,
  totals,
}: LiabilitiesSectionProps) {
  const { t } = useTranslation();
  const formatNumber = (n: number) => n.toLocaleString();

  const handleNumberInput = (
    section: "memberDeposits" | "borrowings" | "otherLiabilities",
    field: string,
    value: string,
  ) => {
    const numValue = parseFloat(value.replace(/,/g, "")) || 0;
    onChange(section, field, numValue);
  };

  return (
    <div className="space-y-6">
      {/* Member Deposits */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-info/10 text-info grid place-items-center text-xs font-bold">
            2100
          </span>
          {t("financial.memberDepositsSavings")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.voluntarySavings")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(memberDeposits.voluntarySavings)}
                onChange={(e) =>
                  handleNumberInput("memberDeposits", "voluntarySavings", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.mandatorySavings")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(memberDeposits.mandatorySavings)}
                onChange={(e) =>
                  handleNumberInput("memberDeposits", "mandatorySavings", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.fixedTermDeposits")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(memberDeposits.fixedTermDeposits)}
                onChange={(e) =>
                  handleNumberInput("memberDeposits", "fixedTermDeposits", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <Calculator className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("financial.totalMemberDeposits")}:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalMemberDeposits)}
          </span>
        </div>
      </div>

      {/* Borrowings */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-warning/15 text-warning-foreground grid place-items-center text-xs font-bold">
            2200
          </span>
          {t("financial.borrowings")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.shortTermBorrowings")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(borrowings.shortTermBorrowings)}
                onChange={(e) =>
                  handleNumberInput("borrowings", "shortTermBorrowings", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.longTermBorrowings")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(borrowings.longTermBorrowings)}
                onChange={(e) =>
                  handleNumberInput("borrowings", "longTermBorrowings", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">{t("financial.totalBorrowings")}:</span>
          <span className="font-bold text-foreground">${formatNumber(totals.totalBorrowings)}</span>
        </div>
      </div>

      {/* Other Liabilities */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-success/10 text-success grid place-items-center text-xs font-bold">
            2300
          </span>
          {t("financial.otherLiabilities")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.accountsPayable")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherLiabilities.accountsPayable)}
                onChange={(e) =>
                  handleNumberInput("otherLiabilities", "accountsPayable", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.accruedExpenses")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherLiabilities.accruedExpenses)}
                onChange={(e) =>
                  handleNumberInput("otherLiabilities", "accruedExpenses", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.deferredIncome")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherLiabilities.deferredIncome)}
                onChange={(e) =>
                  handleNumberInput("otherLiabilities", "deferredIncome", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">{t("financial.totalOtherLiabilities")}:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalOtherLiabilities)}
          </span>
        </div>
      </div>

      {/* Total Liabilities */}
      <div className="flex items-center justify-between gap-2 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-destructive text-destructive-foreground grid place-items-center text-sm font-bold">
            2999
          </span>
          <span className="font-semibold text-foreground">{t("financial.totalLiabilities")}</span>
        </div>
        <span className="text-xl font-bold text-foreground">
          ${formatNumber(totals.totalLiabilities)}
        </span>
      </div>
    </div>
  );
}
