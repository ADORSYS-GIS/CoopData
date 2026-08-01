import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  Trash2,
  CheckCircle2,
  ClipboardList,
  Users,
  Database,
  PenLine,
} from "lucide-react";
import { Card, StatusPill } from "@/components/app-shell";
import { useMembers } from "@/hooks/non-financial/useMembers";
import { useSavings } from "@/hooks/non-financial/useSavings";
import { useLoans } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits } from "@/hooks/non-financial/useFixedDeposits";
import { useFarmCoops } from "@/hooks/non-financial/useFarmCoop";
import {
  useUpdateSubmissionSection,
  type SubmissionSectionResponse,
} from "@/hooks/submissions/useSubmissionSections";
import { useDeleteManualNonFinancialData } from "@/hooks/submissions/useManualEntry";
import { NfUploadZone } from "@/components/non-financial/NfUploadZone";
import { NfParseResults } from "@/components/non-financial/NfParseResults";
import { toast } from "sonner";
import type { NfUploadResponse } from "@/types/non-financial";

interface NfDatabasesTabProps {
  submissionId: string;
  isReadOnly: boolean;
  isDraft: boolean;
  isCooperative: boolean;
  sections: SubmissionSectionResponse[] | undefined;
  onUploadComplete: (result: NfUploadResponse) => void;
  nfResult: NfUploadResponse | null;
}

function sectionStatusTone(status: string): "neutral" | "warning" | "success" {
  return status === "ready" ? "success" : status === "in_progress" ? "warning" : "neutral";
}

function sectionStatusLabel(status: string) {
  return (
    ({ pending: "Pending", in_progress: "In Progress", ready: "Ready" } as Record<string, string>)[
      status
    ] ?? status
  );
}

const ClearNonFinancialButton: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const deleteNf = useDeleteManualNonFinancialData(submissionId);

  const handleClick = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear all non-financial databases (membership, savings, loans, deposits, and farm profile)? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteNf.mutateAsync();
      toast.success("Non-financial databases cleared successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear databases");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={deleteNf.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
    >
      {deleteNf.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      Clear Non-Financial Databases
    </button>
  );
};

function NfTable({
  title,
  section,
  columns,
  rows,
  canMarkReady,
  onMarkReady,
  isUpdating,
}: {
  title: string;
  section?: SubmissionSectionResponse;
  columns: string[];
  rows: Record<string, unknown>[];
  canMarkReady?: boolean;
  onMarkReady?: () => void;
  isUpdating?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const fmtCol = (col: string) => col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cell = (val: unknown) => {
    if (val === null || val === undefined || val === "")
      return <span className="text-muted-foreground/40">—</span>;
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  };
  const isReady = section?.status === "ready";
  const isInProgress = section?.status === "in_progress";

  return (
    <Card
      title={title}
      action={
        <div className="flex items-center gap-2">
          {section && (
            <StatusPill tone={sectionStatusTone(section.status)}>
              {sectionStatusLabel(section.status)}
            </StatusPill>
          )}
          {canMarkReady && !isReady && isInProgress && (
            <button
              onClick={onMarkReady}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/25 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/15 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isUpdating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              Mark Ready
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      }
    >
      {open && (
        <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                    {fmtCol(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 whitespace-nowrap text-foreground">
                      {cell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function NfDatabasesTab({
  submissionId,
  isReadOnly,
  isDraft,
  isCooperative,
  sections,
  onUploadComplete,
  nfResult,
}: NfDatabasesTabProps) {
  const params = { submission_id: submissionId, page: 1, page_size: 200 };
  const { data: membersData, isLoading: lm } = useMembers(params);
  const { data: savingsData, isLoading: ls } = useSavings(params);
  const { data: loansData, isLoading: ll } = useLoans(params);
  const { data: fdsData, isLoading: lf } = useFixedDeposits(params);
  const { data: farmCoopsData, isLoading: lfc } = useFarmCoops(params);
  const updateSection = useUpdateSubmissionSection(submissionId);

  const members = membersData?.data ?? [];
  const savings = savingsData?.data ?? [];
  const loans = loansData?.data ?? [];
  const fds = fdsData?.data ?? [];
  const farmCoops = farmCoopsData?.data ?? [];
  const hasData =
    members.length > 0 ||
    savings.length > 0 ||
    loans.length > 0 ||
    fds.length > 0 ||
    farmCoops.length > 0;
  const isLoading = lm || ls || ll || lf || lfc;
  const canMarkReady = isCooperative && isDraft;

  const handleMarkReady = async (sectionKey: string, label: string) => {
    try {
      await updateSection.mutateAsync({ section: sectionKey, status: "ready" });
      toast.success(`${label} marked as ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to update ${label}`);
    }
  };

  const sec = (key: string) => sections?.find((s) => s.section === key);
  const navigate = useNavigate();

  return (
    <div className="space-y-4 font-sans">
      {isCooperative && isDraft && hasData && (
        <div className="flex justify-end pr-2">
          <ClearNonFinancialButton submissionId={submissionId} />
        </div>
      )}
      {isCooperative && isDraft && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Option 1: Upload Excel */}
          <Card
            title="Upload Non-Financial Databases"
            subtitle="Upload your Excel file containing member, savings, loan, and farm data"
            edge="primary"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { sheet: "NF MSHIP", label: "Members" },
                  { sheet: "NF S", label: "Savings" },
                  { sheet: "NF LOANS", label: "Loans" },
                  { sheet: "NF FS", label: "Fixed Deposits" },
                  { sheet: "NF FARM", label: "Farm Coop" },
                ].map(({ sheet, label }) => (
                  <div
                    key={sheet}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <span className="font-mono">{sheet}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <NfUploadZone submissionId={submissionId} onUploadComplete={onUploadComplete} />
              {nfResult && <NfParseResults result={nfResult} />}
            </div>
          </Card>

          {/* Option 2: Manual Entry */}
          <Card
            title="Manual Entry"
            subtitle="Enter your member and database records directly using structured forms"
          >
            <div className="flex flex-col gap-4 h-full">
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: "👥", label: "Members" },
                  { icon: "💰", label: "Savings" },
                  { icon: "📋", label: "Loans" },
                  { icon: "🏦", label: "Fixed Deposits" },
                ].map(({ icon, label }) => (
                  <div
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Don't have the Excel file? Use our guided forms to enter your member, savings, loan,
                and deposit data row by row.
              </p>
              <button
                onClick={() =>
                  navigate({
                    to: "/app/submissions/$id/manual-entry",
                    params: { id: submissionId },
                    search: { step: "members" },
                  })
                }
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm w-full cursor-pointer"
              >
                <Users className="size-4" />
                Enter Member Data Manually
              </button>
            </div>
          </Card>

          {/* Option 3: Questionnaire (Basic / Non-Financial Options) */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all group">
            <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center">
              <ClipboardList className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground">Questionnaire</h4>
                <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5">
                  Basic
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                For non-financial cooperatives (Agriculture, Handicraft, etc.). Answer guided
                questions to complete your submission.
              </p>
            </div>
            <button
              onClick={() =>
                navigate({
                  to: "/app/submissions/$id/questionnaire",
                  params: { id: submissionId },
                  search: { type: "non_financial" },
                })
              }
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
            >
              <ClipboardList className="size-4" />
              Start Non-Financial Questionnaire
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Loading records…
        </div>
      )}

      {!isLoading && !hasData && (
        <div className="text-center py-10 text-muted-foreground text-sm border rounded-xl bg-muted/10">
          {isReadOnly
            ? "No non-financial data has been uploaded for this submission."
            : "No records yet. Upload the Excel file above to import data."}
        </div>
      )}

      {members.length > 0 && (
        <NfTable
          title={`Membership (${members.length})`}
          section={sec("members")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("members", "Membership")}
          isUpdating={updateSection.isPending}
          columns={[
            "member_id",
            "status",
            "gender",
            "age_group",
            "region",
            "urban_rural",
            "agm_attendance",
            "voting_exercised",
            "join_date",
          ]}
          rows={members as unknown as Record<string, unknown>[]}
        />
      )}

      {savings.length > 0 && (
        <NfTable
          title={`Savings Accounts (${savings.length})`}
          section={sec("savings")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("savings", "Savings")}
          isUpdating={updateSection.isPending}
          columns={[
            "savings_account_id",
            "member_business_id",
            "account_type",
            "account_status",
            "contribution_frequency",
            "number_of_contributions",
            "balance",
            "interest_rate",
            "balance_trend",
            "zero_balance_flag",
            "withdrawal_frequency_category",
            "emergency_withdrawals_flag",
            "account_opening_date",
            "last_contribution_date",
          ]}
          rows={savings as unknown as Record<string, unknown>[]}
        />
      )}

      {loans.length > 0 && (
        <NfTable
          title={`Loans Book (${loans.length})`}
          section={sec("loans")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("loans", "Loans")}
          isUpdating={updateSection.isPending}
          columns={[
            "loan_id",
            "member_business_id",
            "loan_product_type",
            "loan_status",
            "loan_amount",
            "balance",
            "interest_rate",
            "repayment_regularity",
            "days_past_due_category",
            "missed_installments_count",
            "restructured_loan_flag",
            "number_of_restructurings",
            "early_settlement_flag",
            "multiple_loans_flag",
            "large_borrower_flag",
            "borrower_type",
            "youth_borrower_flag",
            "women_borrower_flag",
            "rural_borrower_flag",
            "loan_start_date",
            "loan_maturity_date",
          ]}
          rows={loans as unknown as Record<string, unknown>[]}
        />
      )}

      {fds.length > 0 && (
        <NfTable
          title={`Fixed Deposits (${fds.length})`}
          section={sec("fixed_deposits")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("fixed_deposits", "Fixed Deposits")}
          isUpdating={updateSection.isPending}
          columns={[
            "fixed_deposit_id",
            "member_business_id",
            "deposit_type",
            "status",
            "balance",
            "interest_rate",
            "tenure_category",
            "original_tenure_selected",
            "early_withdrawal_flag",
            "rollover_at_maturity_flag",
            "number_of_renewals",
            "change_in_tenure_at_renewal",
            "single_depositor_dependency_flag",
            "start_date",
            "maturity_date",
          ]}
          rows={fds as unknown as Record<string, unknown>[]}
        />
      )}

      {farmCoops.length > 0 && (
        <NfTable
          title={`Farm Cooperatives (${farmCoops.length})`}
          section={sec("farm_coop")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("farm_coop", "Farm Cooperative Info")}
          isUpdating={updateSection.isPending}
          columns={[
            "cooperative_type",
            "primary_activities",
            "operational_status",
            "active_producer_flag",
            "production_type",
            "participation_frequency",
            "delivery_compliance",
            "production_cycle_type",
            "use_of_production_planning",
            "use_of_shared_inputs",
            "quality_compliance_flag",
            "market_channel_type",
            "formal_offtake_agreement",
            "buyer_concentration_flag",
            "price_predictability_category",
            "access_to_storage",
            "access_to_processing_facilities",
            "transport_coordination",
            "climate_exposure_type",
            "irrigation_access",
            "climate_mitigation_practices",
          ]}
          rows={farmCoops as unknown as Record<string, unknown>[]}
        />
      )}
    </div>
  );
}
export default NfDatabasesTab;
