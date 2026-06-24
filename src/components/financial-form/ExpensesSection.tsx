import type { FinancialExpenses, OperatingExpenses } from "@/lib/financial-data";
import { DollarSign, Calculator } from "lucide-react";

interface ExpensesSectionProps {
  financialExpenses: FinancialExpenses;
  operatingExpenses: OperatingExpenses;
  creditLossExpense: number;
  onChange: (
    section: "financialExpenses" | "operatingExpenses" | "creditLossExpense",
    field: string,
    value: number,
  ) => void;
  totals: {
    totalFinancialExpenses: number;
    totalOperatingExpenses: number;
    totalExpenses: number;
  };
}

export function ExpensesSection({
  financialExpenses,
  operatingExpenses,
  creditLossExpense,
  onChange,
  totals,
}: ExpensesSectionProps) {
  const formatNumber = (n: number) => n.toLocaleString();

  const handleNumberInput = (
    section: "financialExpenses" | "operatingExpenses" | "creditLossExpense",
    field: string,
    value: string,
  ) => {
    const numValue = parseFloat(value.replace(/,/g, "")) || 0;
    onChange(section, field, numValue);
  };

  return (
    <div className="space-y-6">
      {/* Financial Expenses */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-destructive/10 text-destructive grid place-items-center text-xs font-bold">
            5100
          </span>
          Financial Expenses
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Interest Expense on Deposits (5101)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(financialExpenses.interestExpenseDeposits)}
                onChange={(e) =>
                  handleNumberInput("financialExpenses", "interestExpenseDeposits", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Interest Expense on Borrowings (5102)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(financialExpenses.interestExpenseBorrowings)}
                onChange={(e) =>
                  handleNumberInput(
                    "financialExpenses",
                    "interestExpenseBorrowings",
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
          <Calculator className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Total Financial Expenses:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalFinancialExpenses)}
          </span>
        </div>
      </div>

      {/* Operating Expenses */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-warning/15 text-warning-foreground grid place-items-center text-xs font-bold">
            5200
          </span>
          Operating Expenses
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Personnel Costs (5201)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(operatingExpenses.personnelCosts)}
                onChange={(e) =>
                  handleNumberInput("operatingExpenses", "personnelCosts", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Administrative Expenses (5202)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(operatingExpenses.administrativeExpenses)}
                onChange={(e) =>
                  handleNumberInput("operatingExpenses", "administrativeExpenses", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Governance Expenses (5203)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(operatingExpenses.governanceExpenses)}
                onChange={(e) =>
                  handleNumberInput("operatingExpenses", "governanceExpenses", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Depreciation & Amortization (5204)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(operatingExpenses.depreciationAmortization)}
                onChange={(e) =>
                  handleNumberInput("operatingExpenses", "depreciationAmortization", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground">Total Operating Expenses:</span>
          <span className="font-bold text-foreground">
            ${formatNumber(totals.totalOperatingExpenses)}
          </span>
        </div>
      </div>

      {/* Credit Loss Expense */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="size-6 rounded-lg bg-accent/10 text-accent grid place-items-center text-xs font-bold">
            5300
          </span>
          Credit Loss Expense
        </h4>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Loan Loss Provision Expense (5301)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={formatNumber(creditLossExpense)}
                onChange={(e) => {
                  const numValue = parseFloat(e.target.value.replace(/,/g, "")) || 0;
                  onChange("creditLossExpense", "creditLossExpense", numValue);
                }}
                className="w-full rounded-lg border border-input bg-background pl-9 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="flex items-center justify-between gap-2 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-lg bg-destructive text-destructive-foreground grid place-items-center text-sm font-bold">
            5999
          </span>
          <span className="font-semibold text-foreground">TOTAL EXPENSES</span>
        </div>
        <span className="text-xl font-bold text-destructive">
          ${formatNumber(totals.totalExpenses)}
        </span>
      </div>
    </div>
  );
}
