import { TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { LoanRow } from "./LoanRow";
import type { WizardLoan } from "./types";

interface LoansStepProps {
  loans: WizardLoan[];
  addLoan: () => void;
  memberIds: string[];
  updateLoan: (key: string, field: keyof WizardLoan, value: unknown) => void;
  removeLoan: (key: string) => void;
}

export function LoansStep({ loans, addLoan, memberIds, updateLoan, removeLoan }: LoansStepProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden font-sans">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">{t("loansStep.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("loansStep.desc")}
          </p>
        </div>
        <button
          onClick={addLoan}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("loansStep.addBtn")}
        </button>
      </div>

      {loans.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <TrendingUp className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{t("loansStep.emptyTitle")}</p>
          <p className="text-xs mt-1">{t("loansStep.emptyDesc")}</p>
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
                  {t("loansStep.tableHeaders.memberId")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("loansStep.tableHeaders.loanId")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-32">
                  {t("loansStep.tableHeaders.productType")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("loansStep.tableHeaders.startDate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-36">
                  {t("loansStep.tableHeaders.maturityDate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("loansStep.tableHeaders.status")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("loansStep.tableHeaders.borrowerType")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("loansStep.tableHeaders.dpdCategory")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-24">
                  {t("loansStep.tableHeaders.interestRate")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("loansStep.tableHeaders.loanAmount")}
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-28">
                  {t("loansStep.tableHeaders.balance")}
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
          {t("loansStep.rowCount", { count: loans.length })}
        </span>
        <button onClick={addLoan} className="text-primary hover:underline font-medium">
          {t("loansStep.addAnother")}
        </button>
      </div>
    </Card>
  );
}
