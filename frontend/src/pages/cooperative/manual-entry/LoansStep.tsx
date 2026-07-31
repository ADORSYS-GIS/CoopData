import { TrendingUp } from "lucide-react";
import { Card } from "@/components/app-shell";
import { LoanRow } from "./LoanRow";
import type { WizardLoan } from "./types";

interface LoansStepProps {
  loans: WizardLoan[];
  addLoan: () => void;
  memberIds: string[];
  updateLoan: (key: string, field: keyof WizardLoan, value: any) => void;
  removeLoan: (key: string) => void;
}

export function LoansStep({
  loans,
  addLoan,
  memberIds,
  updateLoan,
  removeLoan,
}: LoansStepProps) {
  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Loan Book</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record active loans and classification categories.
          </p>
        </div>
        <button
          onClick={addLoan}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Add Loan Record
        </button>
      </div>

      {loans.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <TrendingUp className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No loans recorded yet</p>
          <p className="text-xs mt-1">Click "+ Add Loan Record" to begin entering loans</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-8">
                  #
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Member ID
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Loan ID
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-32">
                  Product Type
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Start Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Maturity Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Status
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Borrower Type
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Youth
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Women
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Rural
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Repayment
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  DPD Category
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-20">
                  Missed Insts
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Restructured
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-20">
                  Restruct Count
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Early Settle
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Multi Loans
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Large Borrow
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  Interest Rate
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Loan Amount
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Balance
                </th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {loans.map((l, i) => (
                <LoanRow
                  key={l._rowKey}
                  record={l}
                  idx={i}
                  memberIds={memberIds}
                  onUpdate={updateLoan}
                  onRemove={removeLoan}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
        <span>
          {loans.length} loan{loans.length !== 1 ? "s" : ""}
        </span>
        <button onClick={addLoan} className="text-primary hover:underline font-medium">
          + Add another loan record
        </button>
      </div>
    </Card>
  );
}
