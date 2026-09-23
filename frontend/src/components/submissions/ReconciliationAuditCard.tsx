import React from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertTriangle, CheckCircle2, Info, ArrowRight } from "lucide-react";
import { Card, StatusPill } from "@/components/app-shell";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useUsdFormatter } from "@/hooks/shared/useExchangeRates";
import { useReconciliationAudit } from "@/hooks/analytics/useReconciliationAudit";
import { Spinner } from "@/components/ui/spinner";

interface ReconciliationAuditCardProps {
  submissionId: string;
  financialStatementId: string | null | undefined;
  onNavigateToTab?: (tab: string) => void;
}

// This card is intentionally backend-computed (see
// hooks/analytics/useReconciliationAudit.ts) rather than fetching each
// sub-ledger's records into the browser and summing them here — that
// approach previously requested up to 5000 rows per sub-ledger from an
// endpoint that silently caps at 200, producing wrong totals and variance
// alerts for any cooperative with more records than that, with no
// indication the data was truncated. The backend endpoint uses the same
// unpaginated SQL SUM() the Dashboard's own KPI totals use, so this panel
// and the Dashboard can never disagree on the same submission again.
export const ReconciliationAuditCard: React.FC<ReconciliationAuditCardProps> = ({
  submissionId,
  onNavigateToTab,
}) => {
  const { t } = useTranslation();
  const { data, isLoading } = useReconciliationAudit(submissionId);

  const auditRows = data?.rows ?? [];
  const currency = auditRows[0]?.currency ?? "SZL";
  const matchCount = auditRows.filter((r) => r.status === "match").length;
  const varianceCount = auditRows.filter((r) => r.status === "variance").length;
  const pendingCount = auditRows.filter(
    (r) => r.status === "pending_subledger" || r.status === "pending_financial",
  ).length;

  const { format: formatUsdValue, formatOriginal, ready: ratesReady } = useUsdFormatter(currency);
  const fmtCurrency = (val: number | null) => {
    if (val === null) return "—";
    return (
      <span className="inline-flex flex-col items-end leading-tight">
        <span>{formatUsdValue(val)}</span>
        {ratesReady && currency !== "USD" && (
          <span className="text-[10px] font-normal text-muted-foreground">
            {formatOriginal(val)}
          </span>
        )}
      </span>
    );
  };

  return (
    <Card
      title={t("reconciliation.cardTitle", "Data Integrity & Reconciliation Audit")}
      subtitle={t(
        "reconciliation.cardSubtitle",
        "Automated cross-validation between non-financial database sub-ledgers and the audited financial statement",
      )}
      info={t(
        "reconciliation.cardInfo",
        "Sub-ledger totals are computed from every record in the non-financial submission (savings/loans/fixed deposits/shares), not a paginated preview. Balance-sheet figures come from the matching account code on the financial statement, resolved via the chart-of-accounts rollup so a document reporting only child accounts still shows the correct total. A variance here does not necessarily mean an error: the two sources can legitimately differ (e.g. accrued interest, provisions, or GL adjustments not reflected member-by-member), but a large or unexpected variance is worth investigating against the uploaded documents.",
      )}
      action={
        !isLoading && (
          <div className="flex items-center gap-2">
            {varianceCount > 0 ? (
              <StatusPill tone="warning">
                {t("reconciliation.statusVariance", "{{count}} Variance Alert(s)", {
                  count: varianceCount,
                })}
              </StatusPill>
            ) : matchCount > 0 && pendingCount === 0 ? (
              <StatusPill tone="success">
                {t("reconciliation.statusFullyReconciled", "Fully Reconciled")}
              </StatusPill>
            ) : (
              <StatusPill tone="neutral">
                {t("reconciliation.statusInProgress", "{{count}}/4 Reconciled", {
                  count: matchCount,
                })}
              </StatusPill>
            )}
          </div>
        )
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
          <Spinner size="sm" className="mr-2" />
          {t(
            "reconciliation.loading",
            "Auditing sub-ledger balances against financial statement...",
          )}
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
                      ? t(
                          "reconciliation.alertVarianceTitle",
                          "Discrepancy Detected Between Sub-Ledgers and Balance Sheet",
                        )
                      : matchCount > 0 && pendingCount === 0
                        ? t(
                            "reconciliation.alertSuccessTitle",
                            "100% Sub-Ledger & Financial Statement Integrity Verified",
                          )
                        : t(
                            "reconciliation.alertPendingTitle",
                            "Sub-Ledgers Reconciliation In Progress",
                          )}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
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
                  <th className="px-3.5 py-2.5">
                    {t("reconciliation.thCategory", "Account Category")}
                  </th>
                  <th className="px-3.5 py-2.5 text-center">
                    {t("reconciliation.thCoaCode", "COA Code")}
                  </th>
                  <th className="px-3.5 py-2.5 text-right">
                    {t("reconciliation.thSubLedgerTotal", "Sub-Ledger Total")}
                  </th>
                  <th className="px-3.5 py-2.5 text-right">
                    {t("reconciliation.thFinancialTotal", "Balance Sheet Line")}
                  </th>
                  <th className="px-3.5 py-2.5 text-right">
                    {t("reconciliation.thVariance", "Variance")}
                  </th>
                  <th className="px-3.5 py-2.5 text-center">
                    {t("reconciliation.thStatus", "Audit Status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditRows.map((row) => (
                  <tr key={row.key} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-1">
                        {row.label}
                        <InfoTooltip
                          text={t(`reconciliation.rowInfo.${row.key}`, {
                            defaultValue: t(
                              "reconciliation.rowInfoDefault",
                              "Sub-ledger total is the sum of every {{subLedgerName}} record in the non-financial submission. Balance sheet line is account code {{coaCode}} from the financial statement, resolved via the chart-of-accounts rollup.",
                              { subLedgerName: row.sub_ledger_name, coaCode: row.coa_code },
                            ),
                          })}
                          className="size-3"
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {row.sub_ledger_name} ({row.sub_ledger_count} {t("records", "records")})
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono text-xs text-muted-foreground">
                      {row.coa_code}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-foreground">
                      {row.sub_ledger_count > 0 || row.sub_ledger_total !== 0 ? (
                        fmtCurrency(row.sub_ledger_total)
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-foreground">
                      {row.financial_total !== null ? (
                        fmtCurrency(row.financial_total)
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold">
                      {row.status === "variance" && row.variance !== null ? (
                        <span className="text-warning">
                          {row.variance > 0 ? "+" : ""}
                          {fmtCurrency(row.variance)}
                        </span>
                      ) : row.status === "match" ? (
                        <span className="text-success">{fmtCurrency(0)}</span>
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
