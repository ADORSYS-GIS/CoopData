import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { FixedDepositRow } from "./FixedDepositRow";
import type { WizardFixedDeposit } from "./types";

interface DepositsStepProps {
  fixedDeposits: WizardFixedDeposit[];
  addFixedDeposit: () => void;
  memberIds: string[];
  updateFixedDeposit: (key: string, field: keyof WizardFixedDeposit, value: unknown) => void;
  removeFixedDeposit: (key: string) => void;
}

export function DepositsStep({
  fixedDeposits,
  addFixedDeposit,
  memberIds,
  updateFixedDeposit,
  removeFixedDeposit,
}: DepositsStepProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("depositsStep.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("depositsStep.desc")}
          </p>
        </div>
        <button
          onClick={addFixedDeposit}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("depositsStep.addBtn")}
        </button>
      </div>

      {fixedDeposits.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Clock className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{t("depositsStep.emptyTitle")}</p>
          <p className="text-xs mt-1">
            {t("depositsStep.emptyDesc")}
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
                  {t("depositsStep.tableHeaders.memberId")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("depositsStep.tableHeaders.depositId")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("depositsStep.tableHeaders.type")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("depositsStep.tableHeaders.startDate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("depositsStep.tableHeaders.maturityDate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  {t("depositsStep.tableHeaders.status")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("depositsStep.tableHeaders.tenure")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  {t("depositsStep.tableHeaders.interestRate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("depositsStep.tableHeaders.balance")}
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
          {t("depositsStep.rowCount", { count: fixedDeposits.length })}
        </span>
        <button onClick={addFixedDeposit} className="text-primary hover:underline font-medium">
          {t("depositsStep.addAnother")}
        </button>
      </div>
    </Card>
  );
}
