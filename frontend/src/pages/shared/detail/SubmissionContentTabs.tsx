import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
}

const isQuestionnaireFilled = (q: { id?: string } | null | undefined): boolean => {
  return !!(q && q.id && q.id !== "00000000-0000-0000-0000-000000000000");
};

const DeleteFileButton: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const queryClient = useQueryClient();
  const deleteFS = useDeleteFinancialStatement();

  const handleClick = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete the uploaded document? This will clear all extracted financial data.",
      )
    )
      return;
    try {
      await deleteFS.mutateAsync(submissionId);
      toast.success("Document deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["submission-line-items"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete document");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={deleteFS.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
    >
      {deleteFS.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      Delete Document
    </button>
  );
};

export const SubmissionContentTabs: React.FC<SubmissionContentTabsProps> = ({
  submission,
  isDraft,
  isCooperative,
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
}) => {
  const navigate = useNavigate();

  return (
    <div className="font-sans">
      {submission.submission_method === "questionnaire" ? (
        <Card
          title="Questionnaire Responses"
          subtitle="Guided form entries submitted by the cooperative"
          action={
            isDraft && (isCooperative || role === "ministry") ? (
              <button
                onClick={() =>
                  navigate({
                    to: "/app/submissions/$id/questionnaire",
                    params: { id: submission.id },
                  })
                }
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
              >
                <ClipboardList className="size-3.5" />
                Edit Answers
              </button>
            ) : undefined
          }
        >
          <QuestionnaireResponseViewer submissionId={submission.id} />
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList id="detail-tabs-list" className="w-full grid grid-cols-2 mb-5 h-auto p-1">
            <TabsTrigger
              value="financial"
              className="flex items-center gap-2 py-2.5 cursor-pointer"
            >
              <FileText className="size-4" />
              <span>Financial Statement</span>
            </TabsTrigger>
            <TabsTrigger
              value="databases"
              className="flex items-center gap-2 py-2.5 cursor-pointer"
            >
              <Database className="size-4" />
              <span>Non-Financial Information</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="space-y-4">
            {isExtracting && (
              <Card
                title="AI Extraction in Progress"
                subtitle="Our AI engine is parsing and mapping the uploaded financial statement"
              >
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="relative mb-4">
                    <div className="size-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <FileText className="size-6 text-primary absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Processing Document</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    This process takes about 1 minute to 1 minute 30 seconds. The page will
                    automatically update once the extraction completes. Please do not close or
                    refresh this page.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent capitalize">
                    Status: {extractionJob?.status || "Running"}
                  </div>
                </div>
              </Card>
            )}
            {submission.extraction_job_id && extractionJob?.source_file_id && !isExtracting && (
              <Card
                title="Uploaded Document"
                subtitle="Original financial statement file"
                action={
                  isDraft && isCooperative ? (
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
                title="Financial Questionnaire Responses"
                subtitle="Guided form entries submitted by the cooperative"
                action={
                  isDraft && isCooperative ? (
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
                      Edit Answers
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
                  />
                )}
                {!submission.financial_statement_id && !isExtracting && isCooperative && (
                  <Card
                    title="Financial Statement"
                    subtitle="Choose how you want to submit your financial data"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
                      {/* Option 1: Upload */}
                      <div className="rounded-xl border border-border bg-muted/20 p-5 flex flex-col gap-3 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                        <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                          <Upload className="size-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">Upload Document</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Upload your audited balance sheet PDF or Excel file. Our AI will extract
                            and map the data automatically.
                          </p>
                        </div>
                        <div className="mt-auto">
                          <UploadFinancialStatementWidget submissionId={submission.id} />
                        </div>
                      </div>

                      {/* Option 2: Manual Entry */}
                      <div className="rounded-xl border border-border bg-muted/20 p-5 flex flex-col gap-3 hover:border-accent/30 hover:bg-accent/5 transition-all group">
                        <div className="size-10 rounded-xl bg-accent/10 grid place-items-center">
                          <PenLine className="size-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">Manual Entry</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Don't have the file? Enter your financial data directly using our
                            structured forms — all Chart of Accounts fields included.
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
                          Enter Data Manually
                        </button>
                      </div>

                      {/* Option 3: Questionnaire (Basic Cooperatives) */}
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
                            For basic-tier cooperatives that cannot provide full financial ledgers.
                            Answer guided questions to complete your submission.
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            navigate({
                              to: "/app/submissions/$id/questionnaire",
                              params: { id: submission.id },
                              search: { type: "financial" },
                            })
                          }
                          className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                        >
                          <ClipboardList className="size-4" />
                          Start Questionnaire
                        </button>
                      </div>
                    </div>
                  </Card>
                )}
                {!submission.financial_statement_id && !isExtracting && !isCooperative && (
                  <Card title="Financial Statement" subtitle="No document uploaded yet">
                    <div className="py-10 text-center text-muted-foreground">
                      <FileText className="size-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        No financial statement uploaded for this submission.
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
                title="Non-Financial Questionnaire Responses"
                subtitle="Guided form entries submitted by the cooperative"
                action={
                  isDraft && isCooperative ? (
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
                      Edit Answers
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
                sections={sections}
                onUploadComplete={handleNfUploadComplete}
                nfResult={nfResult}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
