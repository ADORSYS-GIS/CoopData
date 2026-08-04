import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("membersStep.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("membersStep.desc")}</p>
        </div>
        <button
          onClick={addMember}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("membersStep.addBtn")}
        </button>
      </div>

      {members.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Users className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{t("membersStep.emptyTitle")}</p>
          <p className="text-xs mt-1">{t("membersStep.emptyDesc")}</p>
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
                  {t("membersStep.tableHeaders.memberId")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("membersStep.tableHeaders.joinDate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("membersStep.tableHeaders.status")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("membersStep.tableHeaders.gender")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("membersStep.tableHeaders.ageGroup")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-32">
                  {t("membersStep.tableHeaders.region")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("membersStep.tableHeaders.urbanRural")}
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  {t("membersStep.tableHeaders.agmAttendance")}
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-16">
                  {t("membersStep.tableHeaders.voted")}
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
        <span>{t("membersStep.rowCount", { count: members.length })}</span>
        <button onClick={addMember} className="text-primary hover:underline font-medium">
          {t("membersStep.addAnother")}
        </button>
      </div>
    </Card>
  );
}
