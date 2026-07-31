import { DollarSign } from "lucide-react";
import { Card } from "@/components/app-shell";
import { SavingsRow } from "./SavingsRow";
import type { WizardSavings } from "./types";

interface SavingsStepProps {
  savings: WizardSavings[];
  addSavings: () => void;
  memberIds: string[];
  updateSavings: (key: string, field: keyof WizardSavings, value: any) => void;
  removeSavings: (key: string) => void;
}

export function SavingsStep({
  savings,
  addSavings,
  memberIds,
  updateSavings,
  removeSavings,
}: SavingsStepProps) {
  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Savings Ledger</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record savings accounts for entered members. All fields are optional except Member
            ID.
          </p>
        </div>
        <button
          onClick={addSavings}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Add Savings Record
        </button>
      </div>

      {savings.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <DollarSign className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No savings accounts yet</p>
          <p className="text-xs mt-1">
            Click "+ Add Savings Record" to begin entering savings accounts
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-8">
                  #
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Member ID
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Account ID
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Type
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Open Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  Status
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Frequency
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Last Contrib Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-20">
                  Contribs Count
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  Trend
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  Interest Rate
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Balance
                </th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {savings.map((s, i) => (
                <SavingsRow
                  key={s._rowKey}
                  record={s}
                  idx={i}
                  memberIds={memberIds}
                  onUpdate={updateSavings}
                  onRemove={removeSavings}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
        <span>
          {savings.length} savings account{savings.length !== 1 ? "s" : ""}
        </span>
        <button onClick={addSavings} className="text-primary hover:underline font-medium">
          + Add another savings record
        </button>
      </div>
    </Card>
  );
}
