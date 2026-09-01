import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  FileText,
  Database,
  Upload,
  PenLine,
  Loader2,
  Trash2,
  AlertCircle,
  Users,
} from "lucide-react";
import { Card } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionnaireResponseViewer } from "@/components/submissions/QuestionnaireResponseViewer";
import { FinancialStatementEditor } from "@/pages/cooperative/FinancialStatementEditor";
import { UploadFinancialStatementWidget } from "@/pages/cooperative/UploadFinancialStatement";
import { useDeleteFinancialStatement } from "@/hooks/submissions/useSubmissions";
import { NfDatabasesTab } from "./NfDatabasesTab";
import { DocumentViewer } from "./DocumentViewer";
import { ReconciliationAuditCard } from "@/components/submissions/ReconciliationAuditCard";
import { toast } from "sonner";
import type { SubmissionSectionResponse } from "@/hooks/submissions/useSubmissionSections";
import type { NfUploadResponse } from "@/types/non-financial";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";
import type { ExtractionJobResponse } from "@/hooks/submissions/useExtractionJob";
import type { QuestionnaireResponseData } from "@/hooks/submissions/useQuestionnaire";

interface SubmissionContentTabsProps {
  submission: SubmissionResponse | null | undefined;
  isDraft: boolean;
  isCooperative: boolean;
  isCreatorRole: boolean;
  role: string;
  activeTab: string;
  setActiveTab: (val: string) => void;
  isExtracting: boolean;
  extractionJob: ExtractionJobResponse | null | undefined;
  financialQ: QuestionnaireResponseData | null | undefined;
  nonFinancialQ: QuestionnaireResponseData | null | undefined;
  isReadOnly: boolean;
  sections: SubmissionSectionResponse[] | undefined;
  handleNfUploadComplete: (result: NfUploadResponse) => void;
  nfResult: NfUploadResponse | null;
  submissionMethod: "upload" | "manual" | "questionnaire" | null;
  methodChosen: boolean;
  onOpenMethodModal: () => void;
}

const isQuestionnaireFilled = (q: { id?: string } | null | undefined): boolean => {
  return !!(q && q.id && q.id !== "00000000-0000-0000-0000-000000000000");
};

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

const DeleteFileButton: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const deleteFS = useDeleteFinancialStatement();
  const [open, setOpen] = React.useState(false);

  const handleDelete = async () => {
    try {
      await deleteFS.mutateAsync(submissionId);
      toast.success(t("submissions.detail.contentTabs.toastDeleteDocSuccess"));
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["submission-line-items"] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("submissions.detail.contentTabs.toastDeleteDocFailed"),
      );
    } finally {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={deleteFS.isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {deleteFS.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        {t("submissions.detail.contentTabs.btnDeleteDoc")}
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
                  {t("submissions.detail.contentTabs.btnDeleteDoc", "Supprimer le document")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t("submissions.detail.contentTabs.confirmDeleteDoc")}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2">
            <AlertDialogCancel disabled={deleteFS.isPending} className="rounded-xl">
              {t("common.cancel", "Annuler")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteFS.isPending}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFS.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="size-4 mr-1" />
              )}
              {t("common.delete", "Supprimer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const ChangeMethodBanner: React.FC<{
  submissionMethod: "upload" | "manual" | "questionnaire" | null;
  methodChosen: boolean;
  isCooperative: boolean;
  isDraft: boolean;
  onOpenMethodModal: () => void;
}> = ({ submissionMethod, methodChosen, isCooperative, isDraft, onOpenMethodModal }) => {
  const { t } = useTranslation();

  if (!methodChosen || !isCooperative || !isDraft) return null;

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          {submissionMethod === "upload" ? (
            <Upload className="size-4" />
          ) : submissionMethod === "manual" ? (
            <PenLine className="size-4" />
          ) : (
            <ClipboardList className="size-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground capitalize">
            {t("submissions.methodModal.currentBadge", {
              method:
                submissionMethod === "upload"
                  ? t("submissions.methodModal.uploadTitle")
                  : submissionMethod === "manual"
                    ? t("submissions.methodModal.manualTitle")
                    : t("submissions.methodModal.questionnaireTitle"),
            })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("submissions.methodModal.changeHint")}
          </p>
        </div>
      </div>
      <button
        onClick={onOpenMethodModal}
        className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        <PenLine className="size-3.5" />
        {t("submissions.methodModal.changeBtn")}
      </button>
    </div>
  );
};

export const SubmissionContentTabs: React.FC<SubmissionContentTabsProps> = ({
  submission,
  isDraft,
  isCooperative,
  isCreatorRole,
  role,
  activeTab,
  setActiveTab,
  isExtracting,
  extractionJob,
  financialQ,
  nonFinancialQ,
  isReadOnly,
  sections,
  handleNfUploadComplete,
  nfResult,
  submissionMethod,
  methodChosen,
  onOpenMethodModal,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!submission) {
    return null;
  }

  return (
    <div className="font-sans">
      {submission.submission_method === "questionnaire" ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ChangeMethodBanner
            submissionMethod={submissionMethod}
            methodChosen={methodChosen}
            isCooperative={!isReadOnly}
            isDraft={isDraft}
            onOpenMethodModal={onOpenMethodModal}
          />
          <TabsList id="detail-tabs-list" className="w-full grid grid-cols-2 mb-5 h-auto p-1">
            <TabsTrigger
              value="financial"
              className="flex items-center gap-2 py-2.5 cursor-pointer"
            >
              <FileText className="size-4" />
              <span>{t("submissions.detail.contentTabs.tabFinancial")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="databases"
              className="flex items-center gap-2 py-2.5 cursor-pointer"
            >
              <Database className="size-4" />
              <span>{t("submissions.detail.contentTabs.tabNonFinancial")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="space-y-4">
            <Card
              title={t("submissions.detail.contentTabs.financialQResponsesTitle")}
              subtitle={t("submissions.detail.contentTabs.questionnaireResponsesSubtitle")}
              action={
                isDraft && !isReadOnly ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/app/submissions/$id/questionnaire",
                        params: { id: submission.id },
                        search: { type: "financial" },
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <ClipboardList className="size-3.5" />
                    {t("submissions.detail.contentTabs.btnEditAnswers")}
                  </button>
                ) : undefined
              }
            >
              <QuestionnaireResponseViewer
                submissionId={submission.id}
                questionnaireType="financial"
              />
            </Card>
          </TabsContent>

          <TabsContent value="databases" className="space-y-4">
            <Card
              title={t("submissions.detail.contentTabs.nonFinancialQResponsesTitle")}
              subtitle={t("submissions.detail.contentTabs.questionnaireResponsesSubtitle")}
              action={
                isDraft && !isReadOnly ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/app/submissions/$id/questionnaire",
                        params: { id: submission.id },
                        search: { type: "non_financial" },
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <ClipboardList className="size-3.5" />
                    {t("submissions.detail.contentTabs.btnEditAnswers")}
                  </button>
                ) : undefined
              }
            >
              <QuestionnaireResponseViewer
                submissionId={submission.id}
                questionnaireType="non_financial"
              />
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ChangeMethodBanner
            submissionMethod={submissionMethod}
            methodChosen={methodChosen}
            isCooperative={!isReadOnly}
            isDraft={isDraft}
            onOpenMethodModal={onOpenMethodModal}
          />
          <div className="mb-5">
            <ReconciliationAuditCard
              submissionId={submission.id}
              financialStatementId={submission.financial_statement_id}
              onNavigateToTab={setActiveTab}
            />
          </div>
          <TabsList id="detail-tabs-list" className="w-full grid grid-cols-2 mb-5 h-auto p-1">
            <TabsTrigger
              value="financial"
              className="flex items-center gap-2 py-2.5 cursor-pointer"
            >
              <FileText className="size-4" />
              <span>{t("submissions.detail.contentTabs.tabFinancial")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="databases"
              className="flex items-center gap-2 py-2.5 cursor-pointer"
            >
              <Database className="size-4" />
              <span>{t("submissions.detail.contentTabs.tabNonFinancial")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="space-y-4">
            {isExtracting && (
              <Card
                title={t("submissions.detail.contentTabs.aiExtractionTitle")}
                subtitle={t("submissions.detail.contentTabs.aiExtractionSubtitle")}
              >
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="relative mb-4">
                    <div className="size-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <FileText className="size-6 text-primary absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {t("submissions.detail.contentTabs.processingDoc")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    {t("submissions.detail.contentTabs.processingDocDesc")}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent capitalize">
                    {t("submissions.detail.contentTabs.extractionStatus", {
                      status: extractionJob?.status || "Running",
                    })}
                  </div>
                </div>
              </Card>
            )}
            {submission.extraction_job_id && extractionJob?.source_file_id && !isExtracting && (
              <Card
                title={t("submissions.detail.contentTabs.uploadedDocTitle")}
                subtitle={t("submissions.detail.contentTabs.uploadedDocSubtitle")}
                action={
                  isDraft && !isReadOnly ? (
                    <DeleteFileButton submissionId={submission.id} />
                  ) : undefined
                }
              >
                <DocumentViewer
                  src={`${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/${role}/submissions/${submission.id}/files/${extractionJob.source_file_id}`}
                />
              </Card>
            )}
            {isQuestionnaireFilled(financialQ) ? (
              <Card
                title={t("submissions.detail.contentTabs.financialQResponsesTitle")}
                subtitle={t("submissions.detail.contentTabs.questionnaireResponsesSubtitle")}
                action={
                  isDraft && !isReadOnly ? (
                    <button
                      onClick={() =>
                        navigate({
                          to: `/app/submissions/${submission.id}/questionnaire`,
                          search: { type: "financial" },
                        })
                      }
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                    >
                      <ClipboardList className="size-3.5" />
                      {t("submissions.detail.contentTabs.btnEditAnswers")}
                    </button>
                  ) : undefined
                }
              >
                <QuestionnaireResponseViewer
                  submissionId={submission.id}
                  questionnaireType="financial"
                />
              </Card>
            ) : (
              <>
                {submission.financial_statement_id && (
                  <FinancialStatementEditor
                    fsId={submission.financial_statement_id}
                    submissionId={submission.id}
                    isDraft={isDraft}
                    isCooperative={isCooperative}
                    isReadOnly={isReadOnly}
                    isExtracting={isExtracting}
                  />
                )}
                {!submission.financial_statement_id &&
                  !isExtracting &&
                  !isReadOnly &&
                  !methodChosen && (
                    <Card
                      title={t("submissions.detail.contentTabs.tabFinancial")}
                      subtitle={t("submissions.detail.contentTabs.chooseFinancialSubmitTitle")}
                    >
                      <div className="rounded-xl border border-warning/25 bg-warning/5 p-6 text-center">
                        <div className="mx-auto size-12 rounded-xl bg-warning/10 grid place-items-center mb-3">
                          <FileText className="size-6 text-warning-foreground" />
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
                    </Card>
                  )}
                {!submission.financial_statement_id &&
                  !isExtracting &&
                  !isReadOnly &&
                  methodChosen &&
                  submissionMethod === "upload" && (
                    <Card
                      title={t("submissions.detail.contentTabs.tabFinancial")}
                      subtitle={t("submissions.detail.contentTabs.uploadDocDesc")}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 py-2">
                        <div className="rounded-xl border border-border bg-muted/20 p-5 flex flex-col gap-3 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                            <Upload className="size-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">
                              {t("submissions.detail.contentTabs.uploadDocTitle")}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("submissions.detail.contentTabs.uploadDocDesc")}
                            </p>
                          </div>
                          <div className="mt-auto">
                            <UploadFinancialStatementWidget submissionId={submission.id} />
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                {!submission.financial_statement_id &&
                  !isExtracting &&
                  !isReadOnly &&
                  methodChosen &&
                  submissionMethod === "manual" && (
                    <Card
                      title={t("submissions.detail.contentTabs.tabFinancial")}
                      subtitle={t("submissions.detail.contentTabs.manualEntryDesc")}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 py-2">
                        <div className="rounded-xl border border-border bg-muted/20 p-5 flex flex-col gap-3 hover:border-accent/30 hover:bg-accent/5 transition-all group">
                          <div className="size-10 rounded-xl bg-accent/10 grid place-items-center">
                            <PenLine className="size-5 text-accent" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">
                              {t("submissions.detail.contentTabs.manualEntryTitle")}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("submissions.detail.contentTabs.manualEntryDesc")}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              navigate({
                                to: "/app/submissions/$id/manual-entry",
                                params: { id: submission.id },
                                search: { step: "financial" },
                              })
                            }
                            className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm cursor-pointer"
                          >
                            <PenLine className="size-4" />
                            {t("submissions.detail.contentTabs.btnEnterDataManually")}
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}
                {!submission.financial_statement_id && !isExtracting && isReadOnly && (
                  <Card
                    title={t("submissions.detail.contentTabs.tabFinancial")}
                    subtitle={t("submissions.detail.contentTabs.noDocUploadedSubtitle")}
                  >
                    <div className="py-10 text-center text-muted-foreground">
                      <FileText className="size-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        {t("submissions.detail.contentTabs.noDocUploadedDesc")}
                      </p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="databases" className="space-y-4">
            {isQuestionnaireFilled(nonFinancialQ) ? (
              <Card
                title={t("submissions.detail.contentTabs.nonFinancialQResponsesTitle")}
                subtitle={t("submissions.detail.contentTabs.questionnaireResponsesSubtitle")}
                action={
                  isDraft && !isReadOnly ? (
                    <button
                      onClick={() =>
                        navigate({
                          to: `/app/submissions/${submission.id}/questionnaire`,
                          search: { type: "non_financial" },
                        })
                      }
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                    >
                      <ClipboardList className="size-3.5" />
                      {t("submissions.detail.contentTabs.btnEditAnswers")}
                    </button>
                  ) : undefined
                }
              >
                <QuestionnaireResponseViewer
                  submissionId={submission.id}
                  questionnaireType="non_financial"
                />
              </Card>
            ) : (
              <NfDatabasesTab
                submissionId={submission.id}
                isReadOnly={isReadOnly}
                isDraft={!!isDraft}
                isCooperative={isCooperative}
                isCreatorRole={isCreatorRole}
                sections={sections}
                onUploadComplete={handleNfUploadComplete}
                nfResult={nfResult}
                submissionMethod={methodChosen ? submissionMethod : null}
                methodChosen={methodChosen}
                onOpenMethodModal={onOpenMethodModal}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
