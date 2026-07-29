import { Trash2 } from "lucide-react";
import type { WizardSavings } from "./types";

interface SavingsRowProps {
  record: WizardSavings;
  idx: number;
  memberIds: string[];
  onUpdate: (key: string, field: keyof WizardSavings, value: any) => void;
  onRemove: (key: string) => void;
}

export function SavingsRow({ record, idx, memberIds, onUpdate, onRemove }: SavingsRowProps) {
  return (
    <tr className="border-t border-border/50 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
      <td className="px-2 py-2">
        <select
          value={record.memberBusinessId}
          onChange={e => onUpdate(record._rowKey, "memberBusinessId", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground font-mono"
        >
          <option value="">-- Select Member ID --</option>
          {memberIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          value={record.savingsAccountId}
          onChange={e => onUpdate(record._rowKey, "savingsAccountId", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
          placeholder="SAV-001"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.accountType}
          onChange={e => onUpdate(record._rowKey, "accountType", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Voluntary">Voluntary</option>
          <option value="Mandatory">Mandatory</option>
          <option value="Fixed">Fixed</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.accountOpeningDate}
          onChange={e => onUpdate(record._rowKey, "accountOpeningDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.accountStatus}
          onChange={e => onUpdate(record._rowKey, "accountStatus", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Closed">Closed</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={record.contributionFrequency}
          onChange={e => onUpdate(record._rowKey, "contributionFrequency", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Monthly">Monthly</option>
          <option value="Weekly">Weekly</option>
          <option value="Daily">Daily</option>
          <option value="Irregular">Irregular</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.lastContributionDate}
          onChange={e => onUpdate(record._rowKey, "lastContributionDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          value={record.numberOfContributions}
          onChange={e => onUpdate(record._rowKey, "numberOfContributions", Number(e.target.value))}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.balanceTrend}
          onChange={e => onUpdate(record._rowKey, "balanceTrend", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Stable">Stable</option>
          <option value="Increasing">Increasing</option>
          <option value="Decreasing">Decreasing</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          step="0.01"
          placeholder="0.05"
          value={record.interestRate}
          onChange={e => onUpdate(record._rowKey, "interestRate", Number(e.target.value))}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          placeholder="0.00"
          value={record.balance}
          onChange={e => onUpdate(record._rowKey, "balance", Number(e.target.value))}
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
