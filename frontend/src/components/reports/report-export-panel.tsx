import { useState, useMemo } from "react";
import {
  Download,
  FileText,
  CheckCircle2,
  X,
  Loader2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { Card } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import { toast } from "sonner";
import { getAccessToken } from "@/services/shared/authService";
import {
  useCooperativeSubmissions,
  useApexSubmissions,
  useFederationSubmissions,
  useMinistrySubmissions,
} from "@/hooks/submissions/useSubmissions";
import type { components } from "@/openapi-client/api";

import {
  type ExportFormat,
  REPORT_EXPORT_OPTIONS,
  SCOPE_LABELS,
  SCOPE_COLORS,
  FORMAT_ICONS,
  FORMAT_LABELS,
  EXPORTABLE_STATUSES,
} from "./types";
import { StepIndicator } from "./step-indicator";
import { SelectionSummary } from "./selection-summary";
import { ActiveStepPicker } from "./active-step-picker";

interface ReportExportPanelProps {
  submissionId?: string;
  className?: string;
}

export function ReportExportPanel({ submissionId, className }: ReportExportPanelProps) {
  const { t, replaceOrgTerms } = useOrganizationLabelsContext();
  const role = useUserRole();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Step state for drill-down hierarchy
  const [selectedFedId, setSelectedFedId] = useState<string>("");
  const [selectedApexId, setSelectedApexId] = useState<string>("");
  const [selectedCoopId, setSelectedCoopId] = useState<string>("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [isExporting, setIsExporting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // ── Data sources ────────────────────────────────────────────────────────────

  // All submissions (raw, unfiltered — used to build the pickers)
  const cooperativeQuery = useCooperativeSubmissions(role === "cooperative");
  const apexQuery = useApexSubmissions(role === "apex");
  const federationQuery = useFederationSubmissions({ all: true, enabled: role === "federation" });
  const ministryQuery = useMinistrySubmissions({ all: true, enabled: role === "ministry" });

  const rawSubmissions = useMemo(() => {
    if (role === "cooperative") return cooperativeQuery.data ?? [];
    if (role === "apex") return apexQuery.data ?? [];
    if (role === "federation") return federationQuery.data ?? [];
    if (role === "ministry") return ministryQuery.data ?? [];
    return [];
  }, [role, cooperativeQuery.data, apexQuery.data, federationQuery.data, ministryQuery.data]);

  // Only submitted / approved can be exported
  const allSubmissions = useMemo(
    () => rawSubmissions.filter((s) => EXPORTABLE_STATUSES.includes(s.status.toLowerCase())),
    [rawSubmissions],
  );

  const isLoadingSubmissions =
    (role === "cooperative" && cooperativeQuery.isLoading) ||
    (role === "apex" && apexQuery.isLoading) ||
    (role === "federation" && federationQuery.isLoading) ||
    (role === "ministry" && ministryQuery.isLoading);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const availableReports = useMemo(() => {
    if (!role) return [];
    return REPORT_EXPORT_OPTIONS.filter((r) => r.availableTo.includes(role));
  }, [role]);

  const selectedOption = useMemo(() => {
    return availableReports.find((r) => r.id === selectedReport);
  }, [availableReports, selectedReport]);

  const isIndividual = selectedOption?.scope === "individual";

  const needsFedSelector =
    selectedOption !== undefined &&
    selectedOption.id !== "national-consolidated" &&
    selectedOption.id !== "membership-report" &&
    role === "ministry";

  const needsApexSelector =
    selectedOption !== undefined &&
    (selectedOption.id === "apex-consolidated" || isIndividual) &&
    (role === "ministry" || role === "federation");

  const needsCoopSelector = isIndividual && role !== "cooperative";
  const needsSubmissionSelector = isIndividual;
  const needsYearSelector = !isIndividual;

  // Dynamically determine available reporting years
  const availableYears = useMemo(() => {
    const years = new Set<number>();

    // For consolidated reports, we only aggregate "approved" submissions.
    // For other types, we look at all exportable submissions.
    const relevantSubmissions =
      selectedOption?.scope === "consolidated"
        ? rawSubmissions.filter((s) => s.status.toLowerCase() === "approved")
        : allSubmissions;

    relevantSubmissions.forEach((s) => {
      let include = true;
      if (needsFedSelector && selectedFedId && s.federation_id !== selectedFedId) include = false;
      if (needsApexSelector && selectedApexId && s.apex_id !== selectedApexId) include = false;

      if (include && s.reporting_year) {
        years.add(s.reporting_year);
      }
    });

    return Array.from(years)
      .sort((a, b) => b - a)
      .map(String);
  }, [
    rawSubmissions,
    allSubmissions,
    selectedOption,
    needsFedSelector,
    selectedFedId,
    needsApexSelector,
    selectedApexId,
  ]);

  // Build federation picker list from RAW submissions
  const federationList = useMemo(() => {
    if (role !== "ministry") return [];
    const seen = new Map<string, string>();
    rawSubmissions.forEach((s) => {
      if (s.federation_id) {
        seen.set(s.federation_id, s.federation_name ?? s.federation_id);
      }
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [role, rawSubmissions]);

  // Build apex picker list — derive from submissions for both federation & ministry
  const apexList = useMemo(() => {
    if (role === "cooperative" || role === "apex") return [];

    const seen = new Map<string, { name: string; federationId?: string }>();
    rawSubmissions.forEach((s) => {
      if (s.apex_id) {
        seen.set(s.apex_id, {
          name: s.apex_name ?? s.apex_id,
          federationId: s.federation_id ?? undefined,
        });
      }
    });

    let list = Array.from(seen.entries()).map(([id, item]) => ({
      id,
      name: item.name,
      federationId: item.federationId,
    }));

    if (role === "ministry" && selectedFedId) {
      list = list.filter((a) => a.federationId === selectedFedId);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [role, rawSubmissions, selectedFedId]);

  // Build cooperative picker list — derive from submissions for both federation & ministry
  const cooperativeList = useMemo(() => {
    if (role === "cooperative") return [];

    const seen = new Map<string, { name: string; apexId?: string }>();
    rawSubmissions.forEach((s) => {
      if (s.cooperative_id) {
        seen.set(s.cooperative_id, {
          name: s.cooperative_name ?? s.cooperative_id,
          apexId: s.apex_id ?? undefined,
        });
      }
    });

    let list = Array.from(seen.entries()).map(([id, item]) => ({
      id,
      name: item.name,
      apexId: item.apexId,
    }));

    if (selectedApexId) {
      list = list.filter((c) => c.apexId === selectedApexId);
    } else if (role === "ministry" && selectedFedId) {
      const fedApexIds = apexList.map((a) => a.id);
      list = list.filter((c) => c.apexId && fedApexIds.includes(c.apexId));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [role, rawSubmissions, selectedApexId, selectedFedId, apexList]);

  // Submissions filtered to the selected cooperative (for individual reports)
  const filteredSubmissions = useMemo(() => {
    if (!isIndividual) return [];
    if (role === "cooperative") return allSubmissions;
    if (!selectedCoopId) return [];
    return allSubmissions.filter((s) => s.cooperative_id === selectedCoopId);
  }, [isIndividual, role, selectedCoopId, allSubmissions]);

  // Steps configuration
  const steps = useMemo(() => {
    const list = [];
    if (needsFedSelector) list.push({ key: "fed", label: "Federation" });
    if (needsApexSelector) list.push({ key: "apex", label: "Apex" });
    if (needsCoopSelector) list.push({ key: "coop", label: "Cooperative" });
    if (needsSubmissionSelector) list.push({ key: "submission", label: "Submission" });
    if (needsYearSelector) list.push({ key: "year", label: "Year" });
    return list;
  }, [
    needsFedSelector,
    needsApexSelector,
    needsCoopSelector,
    needsSubmissionSelector,
    needsYearSelector,
  ]);

  const currentStepIndex = useMemo(() => {
    if (needsFedSelector && !selectedFedId) return 0;
    let idx = needsFedSelector ? 1 : 0;
    if (needsApexSelector && !selectedApexId) return idx;
    if (needsApexSelector) idx++;
    if (needsCoopSelector && !selectedCoopId) return idx;
    if (needsCoopSelector) idx++;
    if (needsSubmissionSelector && !selectedSubmissionId) return idx;
    if (needsSubmissionSelector) idx++;
    if (needsYearSelector && !selectedYear) return idx;
    return idx;
  }, [
    needsFedSelector,
    selectedFedId,
    needsApexSelector,
    selectedApexId,
    needsCoopSelector,
    selectedCoopId,
    needsSubmissionSelector,
    selectedSubmissionId,
    needsYearSelector,
    selectedYear,
  ]);

  const activeStepKey: string = steps[currentStepIndex]?.key ?? steps[steps.length - 1]?.key;

  if (!role) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openModal(reportId: string) {
    setSelectedReport(reportId);
    const opt = availableReports.find((r) => r.id === reportId);
    setSelectedFedId("");
    setSelectedApexId("");
    setSelectedCoopId("");
    setSelectedSubmissionId("");
    setSelectedYear("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (!isExporting) setIsModalOpen(false);
  }

  const isFedSelected = !needsFedSelector || !!selectedFedId;
  const isApexSelected = !needsApexSelector || !!selectedApexId;
  const isCoopSelected = !needsCoopSelector || !!selectedCoopId;
  const isSubmissionSelected = !needsSubmissionSelector || !!selectedSubmissionId;
  const isYearSelected = !needsYearSelector || !!selectedYear;

  const canExport =
    !isExporting &&
    selectedOption !== undefined &&
    isFedSelected &&
    isApexSelected &&
    isCoopSelected &&
    isSubmissionSelected &&
    isYearSelected;

  const handleExport = async () => {
    if (!selectedOption || !canExport) return;

    setIsExporting(true);
    try {
      const token = await getAccessToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";

      let url = "";
      if (isIndividual) {
        url = `${baseUrl}/api/v1/cooperative/submissions/${selectedSubmissionId}/export`;
      } else {
        const queryParams = new URLSearchParams();
        if (selectedOption.id === "federation-consolidated" && selectedFedId) {
          queryParams.append("federation_id", selectedFedId);
        } else if (selectedOption.id === "apex-consolidated" && selectedApexId) {
          queryParams.append("apex_id", selectedApexId);
        }

        if (selectedYear) {
          queryParams.append("reporting_year", selectedYear);
        }

        if (role === "apex") url = `${baseUrl}/api/v1/apex/export?${queryParams}`;
        else if (role === "federation") url = `${baseUrl}/api/v1/federation/export?${queryParams}`;
        else if (role === "ministry") url = `${baseUrl}/api/v1/ministry/export?${queryParams}`;
      }

      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      let filename = `${selectedOption.id}_report.pdf`;

      if (isIndividual && selectedSubmissionId) {
        const sub = allSubmissions.find((s) => s.id === selectedSubmissionId);
        const nameClean = (sub?.cooperative_name ?? "cooperative")
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        filename = `${nameClean}_${sub?.reporting_year ?? "report"}.pdf`;
      } else {
        filename = `${role}_consolidated_report.pdf`;
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(t("reportExport.exportedAs", { label: selectedOption.label }));
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(
        t("reportExport.exportFailed", { error: err instanceof Error ? err.message : String(err) }),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedOption || !canExport || !isIndividual || !selectedSubmissionId) return;

    setIsRegenerating(true);
    try {
      const token = await getAccessToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const url = `${baseUrl}/api/v1/cooperative/submissions/${selectedSubmissionId}/export?regenerate=true`;

      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Regeneration failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const sub = allSubmissions.find((s) => s.id === selectedSubmissionId);
      const nameClean = (sub?.cooperative_name ?? "cooperative")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const filename = `${nameClean}_${sub?.reporting_year ?? "report"}.pdf`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(t("reportExport.regeneratedAndDownloaded"));
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(
        t("reportExport.exportFailed", { error: err instanceof Error ? err.message : String(err) }),
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Card
        title={t("reportExport.title")}
        subtitle={t("reportExport.subtitle")}
        className={className}
        action={
          <button
            onClick={() => openModal(availableReports[0]?.id || "")}
            className="press-feedback inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Download className="size-3.5" /> {t("reportExport.exportReport")}
          </button>
        }
      >
        <div className="space-y-3">
          {availableReports.map((report) => (
            <div
              key={report.id}
              onClick={() => openModal(report.id)}
              className="group rounded-xl border border-border p-4 hover:border-accent/40 hover:bg-muted/20 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-heading font-bold text-sm text-foreground truncate">
                      {replaceOrgTerms(report.label)}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {replaceOrgTerms(report.description)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {report.formats.map((fmt) => {
                    const Icon = FORMAT_ICONS[fmt];
                    return (
                      <span
                        key={fmt}
                        className="size-7 rounded-lg bg-muted grid place-items-center text-muted-foreground group-hover:text-accent transition-colors"
                        title={fmt.toUpperCase()}
                      >
                        <Icon className="size-3.5" />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Export Modal ── */}
      {isModalOpen && selectedOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={closeModal}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-3)] z-10 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-accent/10 grid place-items-center">
                  <Download className="size-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {t("reportExport.exportReport")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {replaceOrgTerms(selectedOption.label)}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                disabled={isExporting}
                className="press-feedback rounded-lg p-1.5 hover:bg-muted text-muted-foreground disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Step indicator header */}
              <StepIndicator steps={steps} currentStepIndex={currentStepIndex} />

              {/* Summary of already selected steps */}
              <SelectionSummary
                needsFedSelector={needsFedSelector}
                selectedFedId={selectedFedId}
                federationList={federationList}
                onClearFed={() => {
                  setSelectedFedId("");
                  setSelectedApexId("");
                  setSelectedCoopId("");
                  setSelectedSubmissionId("");
                }}
                needsApexSelector={needsApexSelector}
                selectedApexId={selectedApexId}
                apexList={apexList}
                onClearApex={() => {
                  setSelectedApexId("");
                  setSelectedCoopId("");
                  setSelectedSubmissionId("");
                }}
                needsCoopSelector={needsCoopSelector}
                selectedCoopId={selectedCoopId}
                cooperativeList={cooperativeList}
                onClearCoop={() => {
                  setSelectedCoopId("");
                  setSelectedSubmissionId("");
                }}
                needsSubmissionSelector={needsSubmissionSelector}
                selectedSubmissionId={selectedSubmissionId}
                filteredSubmissions={filteredSubmissions}
                onClearSubmission={() => {
                  setSelectedSubmissionId("");
                }}
                needsYearSelector={needsYearSelector}
                selectedYear={selectedYear}
                onClearYear={() => setSelectedYear("")}
              />

              {/* Active Step Picker */}
              <div className="mt-4">
                <ActiveStepPicker
                  activeStepKey={activeStepKey}
                  isLoadingSubmissions={isLoadingSubmissions}
                  federationList={federationList}
                  selectedFedId={selectedFedId}
                  onSelectFed={(id) => {
                    setSelectedFedId(id);
                    setSelectedApexId("");
                    setSelectedCoopId("");
                    setSelectedSubmissionId("");
                  }}
                  apexList={apexList}
                  selectedApexId={selectedApexId}
                  onSelectApex={(id) => {
                    setSelectedApexId(id);
                    setSelectedCoopId("");
                    setSelectedSubmissionId("");
                  }}
                  cooperativeList={cooperativeList}
                  selectedCoopId={selectedCoopId}
                  onSelectCoop={(id) => {
                    setSelectedCoopId(id);
                    setSelectedSubmissionId("");
                  }}
                  filteredSubmissions={filteredSubmissions}
                  selectedSubmissionId={selectedSubmissionId}
                  onSelectSubmission={(id) => setSelectedSubmissionId(id)}
                  availableYears={availableYears}
                  selectedYear={selectedYear}
                  onSelectYear={(year) => setSelectedYear(year)}
                />
              </div>

              {/* Scope info for consolidated */}
              {activeStepKey === steps[steps.length - 1]?.key &&
                !isIndividual &&
                role !== "cooperative" && (
                  <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-success mt-0.5" />
                    <span>
                      {role === "ministry"
                        ? selectedOption.id === "federation-consolidated"
                          ? t("reportExport.scopeFederation", {
                              name:
                                federationList.find((f) => f.id === selectedFedId)?.name ||
                                t("reportExport.selectedFederation"),
                            })
                          : selectedOption.id === "apex-consolidated"
                            ? t("reportExport.scopeApex", {
                                name:
                                  apexList.find((a) => a.id === selectedApexId)?.name ||
                                  t("reportExport.selectedApex"),
                              })
                            : t("reportExport.scopeNational")
                        : role === "federation"
                          ? selectedOption.id === "apex-consolidated"
                            ? t("reportExport.scopeApex", {
                                name:
                                  apexList.find((a) => a.id === selectedApexId)?.name ||
                                  t("reportExport.selectedApex"),
                              })
                            : t("reportExport.scopeFederationAll")
                          : t("reportExport.scopeApexAll")}
                    </span>
                  </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-4 shrink-0 bg-muted/10">
              {/* Breadcrumb hint */}
              {(needsFedSelector || needsApexSelector || needsCoopSelector) && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0 flex-wrap">
                  {needsFedSelector && (
                    <span
                      className={
                        selectedFedId ? "text-foreground font-medium truncate max-w-[80px]" : ""
                      }
                    >
                      {selectedFedId
                        ? (federationList.find((f) => f.id === selectedFedId)?.name ?? "Federation")
                        : "Federation"}
                    </span>
                  )}
                  {needsFedSelector && selectedFedId && needsApexSelector && (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
                  )}
                  {needsApexSelector && (selectedFedId || !needsFedSelector) && (
                    <span
                      className={
                        selectedApexId ? "text-foreground font-medium truncate max-w-[80px]" : ""
                      }
                    >
                      {selectedApexId
                        ? (apexList.find((a) => a.id === selectedApexId)?.name ?? "Apex")
                        : "Apex"}
                    </span>
                  )}
                  {needsApexSelector && selectedApexId && needsCoopSelector && (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
                  )}
                  {needsCoopSelector && (selectedApexId || !needsApexSelector) && (
                    <span
                      className={
                        selectedCoopId ? "text-foreground font-medium truncate max-w-[80px]" : ""
                      }
                    >
                      {selectedCoopId
                        ? (cooperativeList.find((c) => c.id === selectedCoopId)?.name ??
                          "Cooperative")
                        : "Cooperative"}
                    </span>
                  )}
                  {needsCoopSelector && selectedCoopId && needsSubmissionSelector && (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
                  )}
                  {needsSubmissionSelector && selectedCoopId && (
                    <span
                      className={
                        selectedSubmissionId
                          ? "text-foreground font-medium truncate max-w-[80px]"
                          : ""
                      }
                    >
                      {selectedSubmissionId
                        ? `${filteredSubmissions.find((s) => s.id === selectedSubmissionId)?.reporting_year} Report`
                        : "Submission"}
                    </span>
                  )}
                </div>
              )}
              {!(needsFedSelector || needsApexSelector || needsCoopSelector) && <div />}

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isExporting || isRegenerating}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  {t("reportExport.cancel")}
                </button>
                {/* Regenerate button — only for individual submission exports */}
                {isIndividual && selectedSubmissionId && (
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={!canExport || isExporting || isRegenerating}
                    title={t("reportExport.regenerateTooltip")}
                    className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-900/20 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-40"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />{" "}
                        {t("reportExport.regenerating")}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-3.5" /> {t("reportExport.regenerateAndExport")}
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!canExport || isRegenerating}
                  className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-40"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> {t("reportExport.exporting")}
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" /> {t("reportExport.exportPdf")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
