import { Clock } from "lucide-react";
import { Card } from "@/components/app-shell";
import { FixedDepositRow } from "./FixedDepositRow";
import type { WizardFixedDeposit } from "./types";

interface DepositsStepProps {
  fixedDeposits: WizardFixedDeposit[];
  addFixedDeposit: () => void;
  memberIds: string[];
  updateFixedDeposit: (key: string, field: keyof WizardFixedDeposit, value: any) => void;
  removeFixedDeposit: (key: string) => void;
}

export function DepositsStep({
  fixedDeposits,
  addFixedDeposit,
  memberIds,
  updateFixedDeposit,
  removeFixedDeposit,
}: DepositsStepProps) {
  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Fixed Deposits</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record fixed/time deposits. All fields are optional except Member ID.
          </p>
        </div>
        <button
          onClick={addFixedDeposit}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Add Deposit Record
        </button>
      </div>

      {fixedDeposits.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Clock className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No fixed deposits yet</p>
          <p className="text-xs mt-1">
            Click "+ Add Deposit Record" to begin entering fixed deposits
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
                  Deposit ID
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Type
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Start Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Maturity Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  Status
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Tenure
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Early W/D
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Rollover
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Single Dep Dep
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
              {fixedDeposits.map((f, i) => (
                <FixedDepositRow
                  key={f._rowKey}
                  record={f}
                  idx={i}
                  memberIds={memberIds}
                  onUpdate={updateFixedDeposit}
                  onRemove={removeFixedDeposit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
        <span>
          {fixedDeposits.length} deposit{fixedDeposits.length !== 1 ? "s" : ""}
        </span>
        <button onClick={addFixedDeposit} className="text-primary hover:underline font-medium">
          + Add another deposit record
        </button>
      </div>
    </Card>
  );
}
