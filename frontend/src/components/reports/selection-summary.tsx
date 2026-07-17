import { Globe, Layers, Building2, FileText } from "lucide-react";

interface SelectionSummaryProps {
  needsFedSelector: boolean;
  selectedFedId: string;
  federationList: Array<{ id: string; name: string }>;
  onClearFed: () => void;

  needsApexSelector: boolean;
  selectedApexId: string;
  apexList: Array<{ id: string; name: string }>;
  onClearApex: () => void;

  needsCoopSelector: boolean;
  selectedCoopId: string;
  cooperativeList: Array<{ id: string; name: string }>;
  onClearCoop: () => void;

  needsSubmissionSelector: boolean;
  selectedSubmissionId: string;
  filteredSubmissions: Array<{ id: string; reporting_year: number }>;
  onClearSubmission: () => void;
}

export function SelectionSummary({
  needsFedSelector,
  selectedFedId,
  federationList,
  onClearFed,
  needsApexSelector,
  selectedApexId,
  apexList,
  onClearApex,
  needsCoopSelector,
  selectedCoopId,
  cooperativeList,
  onClearCoop,
  needsSubmissionSelector,
  selectedSubmissionId,
  filteredSubmissions,
  onClearSubmission,
}: SelectionSummaryProps) {
  return (
    <div className="space-y-2">
      {needsFedSelector && selectedFedId && (
        <div className="flex items-center justify-between border border-border/80 bg-muted/20 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2">
            <Globe className="size-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              Federation: {federationList.find((f) => f.id === selectedFedId)?.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearFed}
            className="text-primary hover:underline font-semibold text-[11px] shrink-0"
          >
            Change
          </button>
        </div>
      )}

      {needsApexSelector && selectedApexId && (
        <div className="flex items-center justify-between border border-border/80 bg-muted/20 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              Apex: {apexList.find((a) => a.id === selectedApexId)?.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearApex}
            className="text-primary hover:underline font-semibold text-[11px] shrink-0"
          >
            Change
          </button>
        </div>
      )}

      {needsCoopSelector && selectedCoopId && (
        <div className="flex items-center justify-between border border-border/80 bg-muted/20 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="size-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              Cooperative: {cooperativeList.find((c) => c.id === selectedCoopId)?.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearCoop}
            className="text-primary hover:underline font-semibold text-[11px] shrink-0"
          >
            Change
          </button>
        </div>
      )}

      {needsSubmissionSelector && selectedSubmissionId && (
        <div className="flex items-center justify-between border border-border/80 bg-muted/20 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              Submission: {filteredSubmissions.find((s) => s.id === selectedSubmissionId)?.reporting_year} Financial Report
            </span>
          </div>
          <button
            type="button"
            onClick={onClearSubmission}
            className="text-primary hover:underline font-semibold text-[11px] shrink-0"
          >
            Change
          </button>
        </div>
      )}
    </div>
  );
}
