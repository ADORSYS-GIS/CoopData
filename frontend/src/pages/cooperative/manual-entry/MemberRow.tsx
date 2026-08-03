import { Trash2 } from "lucide-react";
import type { WizardMember } from "./types";
import type { MemberRecord } from "@/lib/financial-data";

interface MemberRowProps {
  member: WizardMember;
  idx: number;
  onUpdate: (key: string, field: keyof MemberRecord, value: string | boolean) => void;
  onRemove: (key: string) => void;
}

export function MemberRow({ member, idx, onUpdate, onRemove }: MemberRowProps) {
  const sel = (field: keyof MemberRecord, options: string[]) => (
    <select
      className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
      value={member[field] as string}
      onChange={(e) => onUpdate(member._rowKey, field, e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  return (
    <tr className="border-t border-border/50 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
      <td className="px-2 py-2">
        <input
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
          placeholder="MEM-001"
          value={member.memberId}
          onChange={(e) => onUpdate(member._rowKey, "memberId", e.target.value)}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
          value={member.joinDate}
          onChange={(e) => onUpdate(member._rowKey, "joinDate", e.target.value)}
        />
      </td>
      <td className="px-2 py-2">{sel("status", ["Active", "Dormant", "Exited"])}</td>
      <td className="px-2 py-2">{sel("gender", ["Male", "Female", "Other"])}</td>
      <td className="px-2 py-2">{sel("ageGroup", ["<18", "18-35", "36-50", "50+"])}</td>
      <td className="px-2 py-2">{sel("region", ["Hhohho", "Manzini", "Lubombo", "Shiselweni"])}</td>
      <td className="px-2 py-2">{sel("urbanRural", ["Urban", "Rural"])}</td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          className="size-4 rounded accent-primary mx-auto block"
          checked={member.agmAttendance}
          onChange={(e) => onUpdate(member._rowKey, "agmAttendance", e.target.checked)}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          className="size-4 rounded accent-primary mx-auto block"
          checked={member.votingExercised}
          onChange={(e) => onUpdate(member._rowKey, "votingExercised", e.target.checked)}
        />
      </td>
      <td className="px-2 py-2">
        <button
          onClick={() => onRemove(member._rowKey)}
          className="size-7 rounded-lg grid place-items-center text-danger hover:bg-danger/10 transition-colors text-sm"
          aria-label="Remove member"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}
