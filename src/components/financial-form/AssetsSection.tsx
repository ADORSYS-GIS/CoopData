import type {
  LiquidAssets,
  LoanPortfolio,
  LoanLossProvisions,
  OtherAssets,
} from "@/lib/financial-data";
import { DollarSign, Calculator } from "lucide-react";

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
          Liquid Assets
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Cash on Hand (1101)
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
              Cash at Bank - Current (1102)
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
              Cash at Bank - Savings (1103)
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
              Short-term Investments (1104)
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
          <span className="text-muted-foreground">Total Liquid Assets:</span>
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
          Loans & Advances to Members
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Performing Loan Portfolio (1201)
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
              Loans in Arrears 1-30 Days (1202)
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
              Loans in Arrears 31-60 Days (1203)
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
              Loans in Arrears 61-90 Days (1204)
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
              Non-Performing Loans &gt;90 Days (1205)
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
          <span className="text-muted-foreground">Gross Loan Portfolio:</span>
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
          Allowance for Loan Losses
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              General Loan Loss Provision (1251)
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
              Specific Loan Loss Provision (1252)
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
          <span className="text-muted-foreground">Total Loan Loss Provisions:</span>
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
          Other Assets
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Accounts Receivable (1301)
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
              Prepaid Expenses (1302)
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
              Fixed Assets - Cost (1303)
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
              Accumulated Depreciation (1304)
              <span className="text-destructive ml-1">(negative)</span>
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
              Intangible Assets (1305)
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
          <span className="text-muted-foreground">Total Other Assets:</span>
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
          <span className="font-semibold text-foreground">TOTAL ASSETS</span>
        </div>
        <span className="text-xl font-bold text-foreground">
          ${formatNumber(totals.totalAssets)}
        </span>
      </div>
    </div>
  );
}
