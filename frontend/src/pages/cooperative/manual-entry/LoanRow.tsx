import { Trash2 } from "lucide-react";
import type { WizardLoan } from "./types";

interface LoanRowProps {
  record: WizardLoan;
  idx: number;
  memberIds: string[];
  onUpdate: (key: string, field: keyof WizardLoan, value: unknown) => void;
  onRemove: (key: string) => void;
}

export function LoanRow({ record, idx, memberIds, onUpdate, onRemove }: LoanRowProps) {
  return (
    <tr className="border-t border-border/50 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
      <td className="px-2 py-2">
        <select
          value={record.memberBusinessId}
          onChange={(e) => onUpdate(record._rowKey, "memberBusinessId", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground font-mono"
        >
          <option value="">-- Select Member ID --</option>
          {memberIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          value={record.loanId}
          onChange={(e) => onUpdate(record._rowKey, "loanId", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
          placeholder="LN-001"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.loanProductType}
          onChange={(e) => onUpdate(record._rowKey, "loanProductType", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Personal">Personal</option>
          <option value="Business">Business</option>
          <option value="Agriculture">Agriculture</option>
          <option value="Education">Education</option>
          <option value="Other">Other</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.loanStartDate}
          onChange={(e) => onUpdate(record._rowKey, "loanStartDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.loanMaturityDate}
          onChange={(e) => onUpdate(record._rowKey, "loanMaturityDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.loanStatus}
          onChange={(e) => onUpdate(record._rowKey, "loanStatus", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Performing">Performing</option>
          <option value="Arrears">Arrears</option>
          <option value="Restructured">Restructured</option>
          <option value="WrittenOff">Written Off</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={record.borrowerType}
          onChange={(e) => onUpdate(record._rowKey, "borrowerType", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Individual">Individual</option>
          <option value="Group">Group</option>
          <option value="Corporate">Corporate</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={record.daysPastDueCategory}
          onChange={(e) => onUpdate(record._rowKey, "daysPastDueCategory", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground font-mono"
        >
          <option value="0">0 DPD</option>
          <option value="1-30">1-30 DPD</option>
          <option value="31-60">31-60 DPD</option>
          <option value="61-90">61-90 DPD</option>
          <option value="91+">91+ DPD</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          step="0.01"
          placeholder="0.10"
          value={record.interestRate}
          onChange={(e) => onUpdate(record._rowKey, "interestRate", Number(e.target.value))}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          placeholder="0.00"
          value={record.loanAmount}
          onChange={(e) => onUpdate(record._rowKey, "loanAmount", Number(e.target.value))}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          placeholder="0.00"
          value={record.balance}
          onChange={(e) => onUpdate(record._rowKey, "balance", Number(e.target.value))}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <button
          onClick={() => onRemove(record._rowKey)}
          className="size-7 rounded-lg grid place-items-center text-danger hover:bg-danger/10 transition-colors text-sm"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}
