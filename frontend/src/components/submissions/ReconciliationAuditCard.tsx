import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertTriangle, CheckCircle2, Info, Loader2, ArrowRight } from "lucide-react";
import { Card, StatusPill } from "@/components/app-shell";
import { useMembers } from "@/hooks/non-financial/useMembers";
import { useSavings } from "@/hooks/non-financial/useSavings";
import { useLoans } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits } from "@/hooks/non-financial/useFixedDeposits";
import { useLineItems } from "@/hooks/submissions/useFinancialStatement";

interface ReconciliationAuditCardProps {
  submissionId: string;
  financialStatementId: string | null | undefined;
  onNavigateToTab?: (tab: string) => void;
}

interface AuditRow {
  key: string;
  label: string;
  subLedgerName: string;
  coaCode: number;
  subLedgerTotal: number;
  financialTotal: number | null;
  count: number;
  hasSubLedgerData: boolean;
  hasFinancialData: boolean;
  variance: number;
  status: "match" | "variance" | "pending_subledger" | "pending_financial";
}

export const ReconciliationAuditCard: React.FC<ReconciliationAuditCardProps> = ({
  submissionId,
  financialStatementId,
  onNavigateToTab,
}) => {
  const { t } = useTranslation();

  const { data: membersRes, isLoading: lMembers } = useMembers({
    submission_id: submissionId,
    page_size: 5000,
  });
  const { data: savingsRes, isLoading: lSavings } = useSavings({
    submission_id: submissionId,
    page_size: 5000,
  });
  const { data: loansRes, isLoading: lLoans } = useLoans({
    submission_id: submissionId,
    page_size: 5000,
  });
  const { data: fdRes, isLoading: lFd } = useFixedDeposits({
    submission_id: submissionId,
    page_size: 5000,
  });
  const { data: lineItems, isLoading: lItems } = useLineItems(financialStatementId || null);

  const isLoading = lMembers || lSavings || lLoans || lFd || lItems;

  const auditRows = useMemo<AuditRow[]>(() => {
    const items = lineItems ?? [];

    const getCoaAmount = (codes: number[]): number | null => {
      if (items.length === 0) return null;
      for (const code of codes) {
        const found = items.find((it) => it.account_code === code);
        if (found && found.value != null) {
          return typeof found.value === "number" ? found.value : parseFloat(String(found.value)) || 0;
        }
      }
      return null;
    };

    // 1. Members Shares (COA 3101 / 3100)
    const membersList = membersRes?.data ?? [];
    const membersShareTotal = membersList.reduce(
      (sum, m) => sum + (typeof m.share_balance === "number" ? m.share_balance : parseFloat(String(m.share_balance || 0)) || 0),
      0,
    );
    const finShares = getCoaAmount([3101, 3100]);

    // 2. Savings Accounts (COA 2101 / 2100)
    const savingsList = savingsRes?.data ?? [];
    const savingsTotal = savingsList.reduce(
      (sum, s) => sum + (typeof s.balance === "number" ? s.balance : parseFloat(String(s.balance || 0)) || 0),
      0,
    );
    const finSavings = getCoaAmount([2101, 2100]);

    // 3. Loan Book (COA 1201 / 1104 / 1200)
    const loansList = loansRes?.data ?? [];
    const loansTotal = loansList.reduce(
      (sum, l) => sum + (typeof l.balance === "number" ? l.balance : parseFloat(String(l.balance || 0)) || 0),
      0,
    );
    const finLoans = getCoaAmount([1201, 1104, 1200]);

    // 4. Fixed Deposits (COA 2103)
    const fdList = fdRes?.data ?? [];
    const fdTotal = fdList.reduce(
      (sum, d) => sum + (typeof d.balance === "number" ? d.balance : parseFloat(String(d.balance || 0)) || 0),
      0,
    );
    const finFd = getCoaAmount([2103]);

    const createRow = (
      key: string,
      label: string,
      subLedgerName: string,
      coaCode: number,
      subTotal: number,
      finTotal: number | null,
      count: number,
    ): AuditRow => {
      const hasSub = count > 0 || subTotal > 0;
      const hasFin = finTotal !== null;
      let status: AuditRow["status"] = "match";
      let variance = 0;

      if (!hasSub) {
        status = "pending_subledger";
      } else if (!hasFin) {
        status = "pending_financial";
      } else {
        variance = subTotal - finTotal;
        status = Math.abs(variance) < 0.01 ? "match" : "variance";
      }

      return {
        key,
        label,
        subLedgerName,
        coaCode,
        subLedgerTotal: subTotal,
        financialTotal: finTotal,
        count,
        hasSubLedgerData: hasSub,
        hasFinancialData: hasFin,
        variance,
        status,
      };
    };

    return [
      createRow(
        "shares",
        t("reconciliation.sharesLabel", "Member Share Capital"),
        t("reconciliation.sharesSubledger", "Shares Register"),
        3101,
        membersShareTotal,
        finShares,
        membersList.length,
      ),
      createRow(
        "savings",
        t("reconciliation.savingsLabel", "Member Short-Term Savings"),
        t("reconciliation.savingsSubledger", "Savings Ledger"),
        2101,
        savingsTotal,
        finSavings,
        savingsList.length,
      ),
      createRow(
        "loans",
        t("reconciliation.loansLabel", "Performing Loan Portfolio"),
        t("reconciliation.loansSubledger", "Loan Book"),
        1201,
        loansTotal,
        finLoans,
        loansList.length,
      ),
      createRow(
        "deposits",
        t("reconciliation.depositsLabel", "Fixed Term Deposits"),
        t("reconciliation.depositsSubledger", "Fixed Deposits"),
        2103,
        fdTotal,
        finFd,
        fdList.length,
      ),
    ];
  }, [membersRes, savingsRes, loansRes, fdRes, lineItems, t]);

  const matchCount = auditRows.filter((r) => r.status === "match").length;
  const varianceCount = auditRows.filter((r) => r.status === "variance").length;
  const pendingCount = auditRows.filter((r) => r.status === "pending_subledger" || r.status === "pending_financial").length;

  const fmtCurrency = (val: number | null) => {
    if (val === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SZL",
      minimumFractionDigits: 2,
    }).format(val).replace("SZL", "E");
  };

  return (
    <Card
      title={t("reconciliation.cardTitle", "Data Integrity & Reconciliation Audit")}
      subtitle={t(
        "reconciliation.cardSubtitle",
        "Automated cross-validation between non-financial database sub-ledgers and the audited financial statement",
      )}
      action={
        !isLoading && (
          <div className="flex items-center gap-2">
            {varianceCount > 0 ? (
              <StatusPill tone="warning">
                {t("reconciliation.statusVariance", "{{count}} Variance Alert(s)", { count: varianceCount })}
              </StatusPill>
            ) : matchCount > 0 && pendingCount === 0 ? (
              <StatusPill tone="success">{t("reconciliation.statusFullyReconciled", "Fully Reconciled")}</StatusPill>
            ) : (
              <StatusPill tone="neutral">
                {t("reconciliation.statusInProgress", "{{count}}/4 Reconciled", { count: matchCount })}
              </StatusPill>
            )}
          </div>
        )
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
          <Loader2 className="size-4 animate-spin mr-2" />
          {t("reconciliation.loading", "Auditing sub-ledger balances against financial statement...")}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Banner */}
          <div
            className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              varianceCount > 0
                ? "border-warning/30 bg-warning/5"
                : matchCount > 0 && pendingCount === 0
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-muted/20"
            }`}
          >
            <div className="flex items-start gap-3">
              {varianceCount > 0 ? (
                <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
              ) : matchCount > 0 && pendingCount === 0 ? (
                <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
              ) : (
                <Info className="size-5 text-primary shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>
                    {varianceCount > 0
                      ? t("reconciliation.alertVarianceTitle", "Discrepancy Detected Between Sub-Ledgers and Balance Sheet")
                      : matchCount > 0 && pendingCount === 0
                        ? t("reconciliation.alertSuccessTitle", "100% Sub-Ledger & Financial Statement Integrity Verified")
                        : t("reconciliation.alertPendingTitle", "Sub-Ledgers Reconciliation In Progress")}
                  </span>
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {varianceCount > 0
                    ? t(
                        "reconciliation.alertVarianceDesc",
                        "Sub-ledger balances differ from reported balance sheet line items. Review the variances below.",
                      )
                    : matchCount > 0 && pendingCount === 0
                      ? t(
                          "reconciliation.alertSuccessDesc",
                          "All non-financial sub-ledger records match the reported balance sheet totals exactly.",
                        )
                      : t(
                          "reconciliation.alertPendingDesc",
                          "Enter or upload non-financial database records to automatically verify reconciliation against financial line items.",
                        )}
                </p>
              </div>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab("databases")}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <span>{t("reconciliation.btnManageDatabases", "Non-Financial Databases")}</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left border-b border-border">
                  <th className="px-3.5 py-2.5">{t("reconciliation.thCategory", "Account Category")}</th>
                  <th className="px-3.5 py-2.5 text-center">{t("reconciliation.thCoaCode", "COA Code")}</th>
                  <th className="px-3.5 py-2.5 text-right">{t("reconciliation.thSubLedgerTotal", "Sub-Ledger Total")}</th>
                  <th className="px-3.5 py-2.5 text-right">{t("reconciliation.thFinancialTotal", "Balance Sheet Line")}</th>
                  <th className="px-3.5 py-2.5 text-right">{t("reconciliation.thVariance", "Variance")}</th>
                  <th className="px-3.5 py-2.5 text-center">{t("reconciliation.thStatus", "Audit Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditRows.map((row) => (
                  <tr key={row.key} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-foreground">
                      <div>{row.label}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {row.subLedgerName} ({row.count} {t("records", "records")})
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono text-[11px] text-muted-foreground">
                      {row.coaCode}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-foreground">
                      {row.hasSubLedgerData ? fmtCurrency(row.subLedgerTotal) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-foreground">
                      {row.hasFinancialData ? fmtCurrency(row.financialTotal) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold">
                      {row.status === "variance" ? (
                        <span className="text-warning">
                          {row.variance > 0 ? "+" : ""}
                          {fmtCurrency(row.variance)}
                        </span>
                      ) : row.status === "match" ? (
                        <span className="text-success">E0.00</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {row.status === "match" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success">
                          <CheckCircle2 className="size-3" />
                          {t("reconciliation.badgeMatch", "Reconciled")}
                        </span>
                      ) : row.status === "variance" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                          <AlertTriangle className="size-3" />
                          {t("reconciliation.badgeVariance", "Variance")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {t("reconciliation.badgePending", "Pending Data")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
};
