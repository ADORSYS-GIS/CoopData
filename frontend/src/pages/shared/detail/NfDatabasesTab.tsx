import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Trash2, CheckCircle2, Users, Database, PenLine } from "lucide-react";
import { Card, StatusPill } from "@/components/app-shell";
import { fetchMembers } from "@/hooks/non-financial/useMembers";
import { fetchSavings } from "@/hooks/non-financial/useSavings";
import { fetchLoans } from "@/hooks/non-financial/useLoans";
import { fetchFixedDeposits } from "@/hooks/non-financial/useFixedDeposits";
import { fetchFarmCoop } from "@/hooks/non-financial/useFarmCoop";
import { useNfRecordsPage } from "@/hooks/non-financial/useNfRecordsPage";
import { NfTable } from "./NfTable";
import {
  useUpdateSubmissionSection,
  type SubmissionSectionResponse,
} from "@/hooks/submissions/useSubmissionSections";
import { useDeleteManualNonFinancialData } from "@/hooks/submissions/useManualEntry";
import { NfUploadZone } from "@/components/non-financial/NfUploadZone";
import { NfParseResults } from "@/components/non-financial/NfParseResults";
import { toast } from "sonner";
import type { NfUploadResponse } from "@/types/non-financial";
import { Spinner } from "@/components/ui/spinner";

interface NfDatabasesTabProps {
  submissionId: string;
  isReadOnly: boolean;
  isDraft: boolean;
  isCooperative: boolean;
  isCreatorRole: boolean;
  sections: SubmissionSectionResponse[] | undefined;
  onUploadComplete: (result: NfUploadResponse) => void;
  nfResult: NfUploadResponse | null;
  submissionMethod: "upload" | "manual" | "questionnaire" | null;
  methodChosen: boolean;
  onOpenMethodModal: () => void;
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ClearNonFinancialButton: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const { t } = useTranslation();
  const deleteNf = useDeleteManualNonFinancialData(submissionId);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteNf.mutateAsync();
      toast.success(t("submissions.detail.nfDatabases.toastClearSuccess"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("submissions.detail.nfDatabases.toastClearFailed"),
      );
    } finally {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={deleteNf.isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {deleteNf.isPending ? <Spinner size="sm" /> : <Trash2 className="size-3.5" />}
        {t("submissions.detail.nfDatabases.btnClearDbs")}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl border border-destructive/20 bg-background p-6 shadow-2xl max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center size-10 rounded-full bg-destructive/15 shrink-0">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-foreground">
                  {t("submissions.detail.nfDatabases.btnClearDbs", "Clear Databases")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t("submissions.detail.nfDatabases.confirmClear")}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2">
            <AlertDialogCancel disabled={deleteNf.isPending} className="rounded-xl">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteNf.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNf.isPending ? (
                <Spinner size="sm" className="mr-1" />
              ) : (
                <Trash2 className="size-4 mr-1" />
              )}
              {t("common.clear", "Clear")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export function NfDatabasesTab({
  submissionId,
  isReadOnly,
  isDraft,
  isCooperative,
  isCreatorRole,
  sections,
  onUploadComplete,
  nfResult,
  submissionMethod,
  methodChosen,
  onOpenMethodModal,
}: NfDatabasesTabProps) {
  const { t } = useTranslation();
  const params = { submission_id: submissionId };
  // Only the totals are fetched here (one record each). A table loads its rows when it is
  // opened.
  const membersTotal = useNfRecordsPage("nf-members", fetchMembers, params, 1, 1);
  const savingsTotal = useNfRecordsPage("nf-savings", fetchSavings, params, 1, 1);
  const loansTotal = useNfRecordsPage("nf-loans", fetchLoans, params, 1, 1);
  const fdsTotal = useNfRecordsPage("nf-fds", fetchFixedDeposits, params, 1, 1);
  const farmTotal = useNfRecordsPage("nf-farm", fetchFarmCoop, params, 1, 1);
  const lm = membersTotal.isLoading;
  const ls = savingsTotal.isLoading;
  const ll = loansTotal.isLoading;
  const lf = fdsTotal.isLoading;
  const lfc = farmTotal.isLoading;
  const updateSection = useUpdateSubmissionSection(submissionId);

  const membersCount = membersTotal.data?.total ?? 0;
  const savingsCount = savingsTotal.data?.total ?? 0;
  const loansCount = loansTotal.data?.total ?? 0;
  const fdsCount = fdsTotal.data?.total ?? 0;
  const farmCount = farmTotal.data?.total ?? 0;
  const hasData =
    membersCount > 0 || savingsCount > 0 || loansCount > 0 || fdsCount > 0 || farmCount > 0;
  const isLoading = lm || ls || ll || lf || lfc;
  const canMarkReady = !isReadOnly && isDraft;

  const handleMarkReady = async (sectionKey: string, label: string) => {
    try {
      await updateSection.mutateAsync({ section: sectionKey, status: "ready" });
      toast.success(t("submissions.detail.nfDatabases.toastMarkedReady", { name: label }));
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("submissions.detail.nfDatabases.toastMarkReadyFailed", { name: label }),
      );
    }
  };

  const sec = (key: string) => sections?.find((s) => s.section === key);
  const navigate = useNavigate();

  return (
    <div className="space-y-4 font-sans">
      {!isReadOnly && isDraft && hasData && (
        <div className="flex justify-end pr-2">
          <ClearNonFinancialButton submissionId={submissionId} />
        </div>
      )}
      {!isReadOnly && isDraft && !hasData && !methodChosen && (
        <div className="rounded-xl border border-warning/25 bg-warning/5 p-6 text-center">
          <div className="mx-auto size-12 rounded-xl bg-warning/10 grid place-items-center mb-3">
            <Database className="size-6 text-warning-foreground" />
          </div>
          <h4 className="text-sm font-bold text-foreground">
            {t("submissions.methodModal.title")}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {t("submissions.methodModal.choosePrompt")}
          </p>
          <button
            onClick={onOpenMethodModal}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            {t("submissions.detail.contentTabs.btnChooseMethod")}
          </button>
        </div>
      )}
      {!isReadOnly && isDraft && methodChosen && submissionMethod === "upload" && (
        <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 items-stretch">
          <Card
            title={t("submissions.detail.nfDatabases.uploadTitle")}
            subtitle={t("submissions.detail.nfDatabases.uploadSubtitle")}
            edge="primary"
            className="flex flex-col h-full"
            bodyClassName="flex-1 flex flex-col justify-between"
          >
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    sheet: "NF MSHIP",
                    label: t("submissions.detail.nfDatabases.categories.members"),
                  },
                  { sheet: "NF S", label: t("submissions.detail.nfDatabases.categories.savings") },
                  {
                    sheet: "NF LOANS",
                    label: t("submissions.detail.nfDatabases.categories.loans"),
                  },
                  {
                    sheet: "NF FS",
                    label: t("submissions.detail.nfDatabases.categories.fixed_deposits"),
                  },
                  {
                    sheet: "NF FARM",
                    label: t("submissions.detail.nfDatabases.categories.farm_coop"),
                  },
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
              <div className="mt-4">
                <NfUploadZone submissionId={submissionId} onUploadComplete={onUploadComplete} />
                {nfResult && <NfParseResults result={nfResult} />}
              </div>
            </div>
          </Card>
        </div>
      )}
      {!isReadOnly && isDraft && !hasData && methodChosen && submissionMethod === "manual" && (
        <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 items-stretch">
          <Card
            title={t("submissions.detail.nfDatabases.manualTitle")}
            subtitle={t("submissions.detail.nfDatabases.manualSubtitle")}
            className="flex flex-col h-full"
            bodyClassName="flex-1 flex flex-col justify-between"
          >
            <div className="flex flex-col gap-4 flex-1 justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: "👥", label: t("submissions.detail.nfDatabases.categories.members") },
                    { icon: "💰", label: t("submissions.detail.nfDatabases.categories.savings") },
                    { icon: "📋", label: t("submissions.detail.nfDatabases.categories.loans") },
                    {
                      icon: "🏦",
                      label: t("submissions.detail.nfDatabases.categories.fixed_deposits"),
                    },
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
                  {t("submissions.detail.nfDatabases.manualDesc")}
                </p>
              </div>
              <button
                onClick={() =>
                  navigate({
                    to: "/app/submissions/$id/manual-entry",
                    params: { id: submissionId },
                    search: { step: "members" },
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm w-full cursor-pointer mt-4"
              >
                <Users className="size-4" />
                {t("submissions.detail.nfDatabases.btnEnterManual")}
              </button>
            </div>
          </Card>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Spinner size="md" className="mr-2" />{" "}
          {t("submissions.detail.nfDatabases.loadingRecords")}
        </div>
      )}

      {!isLoading && !hasData && (
        <div className="text-center py-10 text-muted-foreground text-sm border rounded-xl bg-muted/10">
          {isReadOnly
            ? t("submissions.detail.nfDatabases.noDataReadOnly")
            : t("submissions.detail.nfDatabases.noDataDraft")}
        </div>
      )}

      {membersCount > 0 && (
        <NfTable
          title={t("submissions.detail.nfDatabases.titleMembership", { count: membersCount })}
          section={sec("members")}
          canMarkReady={canMarkReady}
          onMarkReady={() =>
            handleMarkReady("members", t("submissions.detail.nfDatabases.categories.members"))
          }
          isUpdating={updateSection.isPending}
          onEdit={() =>
            navigate({
              to: "/app/submissions/$id/manual-entry",
              params: { id: submissionId },
              search: { step: "members" },
            })
          }
          columns={[
            "member_id",
            "status",
            "gender",
            "age_group",
            "region",
            "urban_rural",
            "agm_attendance",
            "voting_exercised",
            "share_balance",
            "join_date",
          ]}
          queryKey="nf-members"
          fetchPage={fetchMembers}
          params={params}
          total={membersCount}
        />
      )}

      {savingsCount > 0 && (
        <NfTable
          title={t("submissions.detail.nfDatabases.titleSavings", { count: savingsCount })}
          section={sec("savings")}
          canMarkReady={canMarkReady}
          onMarkReady={() =>
            handleMarkReady("savings", t("submissions.detail.nfDatabases.categories.savings"))
          }
          isUpdating={updateSection.isPending}
          onEdit={() =>
            navigate({
              to: "/app/submissions/$id/manual-entry",
              params: { id: submissionId },
              search: { step: "savings" },
            })
          }
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
          queryKey="nf-savings"
          fetchPage={fetchSavings}
          params={params}
          total={savingsCount}
        />
      )}

      {loansCount > 0 && (
        <NfTable
          title={t("submissions.detail.nfDatabases.titleLoans", { count: loansCount })}
          section={sec("loans")}
          canMarkReady={canMarkReady}
          onMarkReady={() =>
            handleMarkReady("loans", t("submissions.detail.nfDatabases.categories.loans"))
          }
          isUpdating={updateSection.isPending}
          onEdit={() =>
            navigate({
              to: "/app/submissions/$id/manual-entry",
              params: { id: submissionId },
              search: { step: "loans" },
            })
          }
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
          queryKey="nf-loans"
          fetchPage={fetchLoans}
          params={params}
          total={loansCount}
        />
      )}

      {fdsCount > 0 && (
        <NfTable
          title={t("submissions.detail.nfDatabases.titleFixedDeposits", { count: fdsCount })}
          section={sec("fixed_deposits")}
          canMarkReady={canMarkReady}
          onMarkReady={() =>
            handleMarkReady(
              "fixed_deposits",
              t("submissions.detail.nfDatabases.categories.fixed_deposits"),
            )
          }
          isUpdating={updateSection.isPending}
          onEdit={() =>
            navigate({
              to: "/app/submissions/$id/manual-entry",
              params: { id: submissionId },
              search: { step: "deposits" },
            })
          }
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
          queryKey="nf-fds"
          fetchPage={fetchFixedDeposits}
          params={params}
          total={fdsCount}
        />
      )}

      {farmCount > 0 && (
        <NfTable
          title={t("submissions.detail.nfDatabases.titleFarmCoops", { count: farmCount })}
          section={sec("farm_coop")}
          canMarkReady={canMarkReady}
          onMarkReady={() =>
            handleMarkReady("farm_coop", t("submissions.detail.nfDatabases.categories.farm_coop"))
          }
          isUpdating={updateSection.isPending}
          onEdit={() =>
            navigate({
              to: "/app/submissions/$id/manual-entry",
              params: { id: submissionId },
              search: { step: "farm" },
            })
          }
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
          queryKey="nf-farm"
          fetchPage={fetchFarmCoop}
          params={params}
          total={farmCount}
        />
      )}
    </div>
  );
}
