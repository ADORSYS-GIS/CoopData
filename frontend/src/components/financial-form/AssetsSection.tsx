import type {
  LiquidAssets,
  LoanPortfolio,
  LoanLossProvisions,
  OtherAssets,
} from "@/lib/financial-data";
import { DollarSign, Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AssetsSectionProps {
  liquidAssets: LiquidAssets;
  loanPortfolio: LoanPortfolio;
  loanLossProvisions: LoanLossProvisions;
  otherAssets: OtherAssets;
  onChange: (
    section: "liquidAssets" | "loanPortfolio" | "loanLossProvisions" | "otherAssets",
    field: string,
    value: number,
  ) => void;
  totals: {
    totalLiquidAssets: number;
    grossLoanPortfolio: number;
    totalLoanLossProvisions: number;
    totalOtherAssets: number;
    totalAssets: number;
  };
}

export function AssetsSection({
  liquidAssets,
  loanPortfolio,
  loanLossProvisions,
  otherAssets,
  onChange,
  totals,
}: AssetsSectionProps) {
  const { t } = useTranslation();
  const formatNumber = (n: number) => n.toLocaleString();

  const handleNumberInput = (
    section: "liquidAssets" | "loanPortfolio" | "loanLossProvisions" | "otherAssets",
    field: string,
    value: string,
  ) => {
    const numValue = parseFloat(value.replace(/,/g, "")) || 0;
    onChange(section, field, numValue);
  };

  return (
    <div className="space-y-6">
      {/* Liquid Assets */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-accent/10 text-accent grid place-items-center text-xs font-bold">
            1100
          </span>
          {t("financial.liquidAssets")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.cashOnHand")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(liquidAssets.cashOnHand)}
                onChange={(e) => handleNumberInput("liquidAssets", "cashOnHand", e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.cashAtBankCurrent")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(liquidAssets.cashAtBankCurrent)}
                onChange={(e) =>
                  handleNumberInput("liquidAssets", "cashAtBankCurrent", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.cashAtBankSavings")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(liquidAssets.cashAtBankSavings)}
                onChange={(e) =>
                  handleNumberInput("liquidAssets", "cashAtBankSavings", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.shortTermInvestments")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(liquidAssets.shortTermInvestments)}
                onChange={(e) =>
                  handleNumberInput("liquidAssets", "shortTermInvestments", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">{t("financial.totalLiquidAssets")}:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalLiquidAssets)}
          </span>
        </div>
      </div>

      {/* Loan Portfolio */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-info/10 text-info grid place-items-center text-xs font-bold">
            1200
          </span>
          {t("financial.loansAdvancesToMembers")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.performingLoanPortfolio")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(loanPortfolio.performingLoanPortfolio)}
                onChange={(e) =>
                  handleNumberInput("loanPortfolio", "performingLoanPortfolio", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.loansInArrears1_30")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(loanPortfolio.loansInArrears_1_30)}
                onChange={(e) =>
                  handleNumberInput("loanPortfolio", "loansInArrears_1_30", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.loansInArrears31_60")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(loanPortfolio.loansInArrears_31_60)}
                onChange={(e) =>
                  handleNumberInput("loanPortfolio", "loansInArrears_31_60", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.loansInArrears61_90")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(loanPortfolio.loansInArrears_61_90)}
                onChange={(e) =>
                  handleNumberInput("loanPortfolio", "loansInArrears_61_90", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.nonPerformingLoans")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(loanPortfolio.nonPerformingLoans)}
                onChange={(e) =>
                  handleNumberInput("loanPortfolio", "nonPerformingLoans", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <Calculator className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("financial.grossLoanPortfolio")}:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.grossLoanPortfolio)}
          </span>
        </div>
      </div>

      {/* Loan Loss Provisions */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-warning/15 text-warning-foreground grid place-items-center text-xs font-bold">
            1250
          </span>
          {t("financial.allowanceForLoanLosses")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.generalLoanLossProvision")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(loanLossProvisions.generalLoanLossProvision)}
                onChange={(e) =>
                  handleNumberInput(
                    "loanLossProvisions",
                    "generalLoanLossProvision",
                    e.target.value,
                  )
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.specificLoanLossProvision")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(loanLossProvisions.specificLoanLossProvision)}
                onChange={(e) =>
                  handleNumberInput(
                    "loanLossProvisions",
                    "specificLoanLossProvision",
                    e.target.value,
                  )
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">{t("financial.totalLoanLossProvisions")}:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalLoanLossProvisions)}
          </span>
        </div>
      </div>

      {/* Other Assets */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-success/10 text-success grid place-items-center text-xs font-bold">
            1300
          </span>
          {t("financial.otherAssets")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.accountsReceivable")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherAssets.accountsReceivable)}
                onChange={(e) =>
                  handleNumberInput("otherAssets", "accountsReceivable", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.prepaidExpenses")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherAssets.prepaidExpenses)}
                onChange={(e) =>
                  handleNumberInput("otherAssets", "prepaidExpenses", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.fixedAssetsCost")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherAssets.fixedAssetsCost)}
                onChange={(e) =>
                  handleNumberInput("otherAssets", "fixedAssetsCost", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.accumulatedDepreciation")}
              <span className="text-destructive ml-1">({t("financial.negative")})</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(Math.abs(otherAssets.accumulatedDepreciation))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(/,/g, "")) || 0;
                  onChange("otherAssets", "accumulatedDepreciation", -val);
                }}
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("financial.intangibleAssets")}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherAssets.intangibleAssets)}
                onChange={(e) =>
                  handleNumberInput("otherAssets", "intangibleAssets", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">{t("financial.totalOtherAssets")}:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalOtherAssets)}
          </span>
        </div>
      </div>

      {/* Total Assets */}
      <div className="flex items-center justify-between gap-2 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm font-bold">
            1999
          </span>
          <span className="font-semibold text-foreground">{t("financial.totalAssets")}</span>
        </div>
        <span className="text-xl font-bold text-foreground">
          ${formatNumber(totals.totalAssets)}
        </span>
      </div>
    </div>
  );
}
