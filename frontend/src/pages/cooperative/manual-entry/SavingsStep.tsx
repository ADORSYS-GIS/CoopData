import { DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { SavingsRow } from "./SavingsRow";
import type { WizardSavings } from "./types";

interface SavingsStepProps {
  savings: WizardSavings[];
  addSavings: () => void;
  memberIds: string[];
  updateSavings: (key: string, field: keyof WizardSavings, value: unknown) => void;
  removeSavings: (key: string) => void;
}

export function SavingsStep({
  savings,
  addSavings,
  memberIds,
  updateSavings,
  removeSavings,
}: SavingsStepProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("savingsStep.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("savingsStep.desc")}
          </p>
        </div>
        <button
          onClick={addSavings}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("savingsStep.addBtn")}
        </button>
      </div>

      {savings.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <DollarSign className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{t("savingsStep.emptyTitle")}</p>
          <p className="text-xs mt-1">
            {t("savingsStep.emptyDesc")}
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
                  {t("savingsStep.tableHeaders.memberId")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("savingsStep.tableHeaders.accountId")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("savingsStep.tableHeaders.type")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("savingsStep.tableHeaders.openDate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  {t("savingsStep.tableHeaders.status")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("savingsStep.tableHeaders.frequency")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("savingsStep.tableHeaders.lastContribDate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-20">
                  {t("savingsStep.tableHeaders.contribsCount")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  {t("savingsStep.tableHeaders.trend")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  {t("savingsStep.tableHeaders.interestRate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("savingsStep.tableHeaders.balance")}
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
          {t("savingsStep.rowCount", { count: savings.length })}
        </span>
        <button onClick={addSavings} className="text-primary hover:underline font-medium">
          {t("savingsStep.addAnother")}
        </button>
      </div>
    </Card>
  );
}
