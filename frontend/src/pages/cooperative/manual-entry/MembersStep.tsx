import { Users } from "lucide-react";
import { Card } from "@/components/app-shell";
import { MemberRow } from "./MemberRow";
import type { WizardMember } from "./types";
import type { MemberRecord } from "@/lib/financial-data";

interface MembersStepProps {
  members: WizardMember[];
  addMember: () => void;
  updateMember: (key: string, field: keyof MemberRecord, value: string | boolean) => void;
  removeMember: (key: string) => void;
}

export function MembersStep({ members, addMember, updateMember, removeMember }: MembersStepProps) {
  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Membership Register</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define members first so they can be referenced in savings, loans and deposit ledgers.
          </p>
        </div>
        <button
          onClick={addMember}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Add Member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Users className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No members yet</p>
          <p className="text-xs mt-1">Click "+ Add Member" to begin entering member records</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-8">
                  #
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-32">
                  Member ID
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  Join Date
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Status
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Gender
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Age Group
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-32">
                  Region
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  Urban/Rural
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  AGM Attendance
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  Voted
                </th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <MemberRow
                  key={m._rowKey}
                  member={m}
                  idx={i}
                  onUpdate={updateMember}
                  onRemove={removeMember}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
        <span>
          {members.length} row{members.length !== 1 ? "s" : ""}
        </span>
        <button onClick={addMember} className="text-primary hover:underline font-medium">
          + Add another member
        </button>
      </div>
    </Card>
  );
}
