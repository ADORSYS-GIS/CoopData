import {
  Loader2,
  Globe,
  CheckCircle2,
  Layers,
  Building2,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { type ExportFormat } from "./types";

interface ActiveStepPickerProps {
  activeStepKey: string;
  isLoadingSubmissions: boolean;

  // Federation Step
  federationList: Array<{ id: string; name: string }>;
  selectedFedId: string;
  onSelectFed: (id: string) => void;

  // Apex Step
  apexList: Array<{ id: string; name: string }>;
  selectedApexId: string;
  onSelectApex: (id: string) => void;

  // Cooperative Step
  cooperativeList: Array<{ id: string; name: string }>;
  selectedCoopId: string;
  onSelectCoop: (id: string) => void;

  // Submission Step
  filteredSubmissions: Array<{
    id: string;
    reporting_year: number;
    status: string;
    submitted_at?: string | null;
    created_at: string;
  }>;
  selectedSubmissionId: string;
  onSelectSubmission: (id: string) => void;

  // Year Step (for consolidated reports)
  availableYears: string[];
  selectedYear: string;
  onSelectYear: (year: string) => void;

  // Format Step
  selectedOption: {
    formats: ExportFormat[];
  };
  selectedFormat: ExportFormat;
  onSelectFormat: (format: ExportFormat) => void;
  isExporting: boolean;

  formatIcons: Record<ExportFormat, LucideIcon>;
  formatLabels: Record<ExportFormat, string>;
}

export function ActiveStepPicker({
  activeStepKey,
  isLoadingSubmissions,
  federationList,
  selectedFedId,
  onSelectFed,
  apexList,
  selectedApexId,
  onSelectApex,
  cooperativeList,
  selectedCoopId,
  onSelectCoop,
  filteredSubmissions,
  selectedSubmissionId,
  onSelectSubmission,
  availableYears,
  selectedYear,
  onSelectYear,
  selectedOption,
  selectedFormat,
  onSelectFormat,
  isExporting,
  formatIcons,
  formatLabels,
}: ActiveStepPickerProps) {
  if (activeStepKey === "fed") {
    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Select Federation
        </label>
        {isLoadingSubmissions ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading federations…
          </div>
        ) : federationList.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted rounded-xl p-3">
            No federations found.
          </p>
        ) : (
          <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
            {federationList.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelectFed(f.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all press-feedback ${
                  selectedFedId === f.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-accent/40 hover:bg-muted/30"
                }`}
              >
                <Globe
                  className={`size-4 shrink-0 ${selectedFedId === f.id ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="font-medium truncate">{f.name}</span>
                {selectedFedId === f.id && (
                  <CheckCircle2 className="size-4 ml-auto shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeStepKey === "apex") {
    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Select Apex Organization
        </label>
        {isLoadingSubmissions ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading apexes…
          </div>
        ) : apexList.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted rounded-xl p-3">
            No apex organizations found under the selected federation.
          </p>
        ) : (
          <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
            {apexList.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelectApex(a.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all press-feedback ${
                  selectedApexId === a.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-accent/40 hover:bg-muted/30"
                }`}
              >
                <Layers
                  className={`size-4 shrink-0 ${selectedApexId === a.id ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="font-medium truncate">{a.name}</span>
                {selectedApexId === a.id && (
                  <CheckCircle2 className="size-4 ml-auto shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeStepKey === "coop") {
    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Select Cooperative
        </label>
        {isLoadingSubmissions ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading cooperatives…
          </div>
        ) : cooperativeList.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted rounded-xl p-3">
            No cooperatives found under the selected apex organization.
          </p>
        ) : (
          <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
            {cooperativeList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCoop(c.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all press-feedback ${
                  selectedCoopId === c.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-accent/40 hover:bg-muted/30"
                }`}
              >
                <Building2
                  className={`size-4 shrink-0 ${selectedCoopId === c.id ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="font-medium truncate">{c.name}</span>
                {selectedCoopId === c.id && (
                  <CheckCircle2 className="size-4 ml-auto shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeStepKey === "submission") {
    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Select Submission
        </label>
        {isLoadingSubmissions ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading submissions…
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-xl p-4 flex items-start gap-2">
            <FileText className="size-4 shrink-0 mt-0.5" />
            <span>
              No approved or submitted reports found for this cooperative. Only submitted and
              approved submissions can be exported.
            </span>
          </div>
        ) : (
          <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
            {filteredSubmissions.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSubmission(sub.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all press-feedback ${
                  selectedSubmissionId === sub.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-accent/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{sub.reporting_year} Financial Report</p>
                  <p
                    className={`text-[11px] mt-0.5 capitalize ${
                      selectedSubmissionId === sub.id ? "text-primary/70" : "text-muted-foreground"
                    }`}
                  >
                    {sub.status} ·{" "}
                    {sub.submitted_at
                      ? new Date(sub.submitted_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : new Date(sub.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                  </p>
                </div>
                {selectedSubmissionId === sub.id && (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeStepKey === "year") {
    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Select Reporting Year
        </label>
        {isLoadingSubmissions ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading years…
          </div>
        ) : availableYears.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-xl p-4 flex items-start gap-2">
            <FileText className="size-4 shrink-0 mt-0.5" />
            <span>No data available to export for the selected organization.</span>
          </div>
        ) : (
          <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => onSelectYear(year)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all press-feedback ${
                  selectedYear === year
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-accent/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{year} Consolidated Report</p>
                </div>
                {selectedYear === year && (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeStepKey === "format") {
    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Export Format
        </label>
        <div
          className={`grid gap-2 ${selectedOption.formats.length === 4 ? "grid-cols-4" : "grid-cols-2"}`}
        >
          {selectedOption.formats.map((fmt) => {
            const Icon = formatIcons[fmt];
            const isSelected = selectedFormat === fmt;
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => onSelectFormat(fmt)}
                disabled={isExporting}
                className={`press-feedback flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="size-5" />
                <span className="text-[10px] font-bold uppercase">{formatLabels[fmt]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
