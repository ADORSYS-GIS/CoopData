import type { FinancialIncome, OtherIncome } from "@/lib/financial-data";
import { DollarSign, Calculator } from "lucide-react";

interface IncomeSectionProps {
  financialIncome: FinancialIncome;
  otherIncome: OtherIncome;
  onChange: (section: "financialIncome" | "otherIncome", field: string, value: number) => void;
  totals: {
    totalFinancialIncome: number;
    totalOtherIncome: number;
    totalIncome: number;
  };
}

export function IncomeSection({
  financialIncome,
  otherIncome,
  onChange,
  totals,
}: IncomeSectionProps) {
  const formatNumber = (n: number) => n.toLocaleString();

  const handleNumberInput = (
    section: "financialIncome" | "otherIncome",
    field: string,
    value: string,
  ) => {
    const numValue = parseFloat(value.replace(/,/g, "")) || 0;
    onChange(section, field, numValue);
  };

  return (
    <div className="space-y-6">
      {/* Financial Income */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-success/10 text-success grid place-items-center text-xs font-bold">
            4100
          </span>
          Financial Income
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Interest Income on Loans (4101)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(financialIncome.interestIncomeLoans)}
                onChange={(e) =>
                  handleNumberInput("financialIncome", "interestIncomeLoans", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Fees & Commissions Income (4102)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(financialIncome.feesCommissionsIncome)}
                onChange={(e) =>
                  handleNumberInput("financialIncome", "feesCommissionsIncome", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <Calculator className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Total Financial Income:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalFinancialIncome)}
          </span>
        </div>
      </div>

      {/* Other Income */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-info/10 text-info grid place-items-center text-xs font-bold">
            4200
          </span>
          Other Income
        </h4>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Other Operating Income (4201)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(otherIncome.otherOperatingIncome)}
                onChange={(e) =>
                  handleNumberInput("otherIncome", "otherOperatingIncome", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">Total Other Income:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalOtherIncome)}
          </span>
        </div>
      </div>

      {/* Total Income */}
      <div className="flex items-center justify-between gap-2 p-4 rounded-xl bg-success/5 border border-success/20">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-success text-success-foreground grid place-items-center text-sm font-bold">
            4999
          </span>
          <span className="font-semibold text-foreground">TOTAL INCOME</span>
        </div>
        <span className="text-xl font-bold text-success">${formatNumber(totals.totalIncome)}</span>
      </div>
    </div>
  );
}
