import { useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  Maximize2,
  Minimize2,
  Search,
  BookOpen,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NfUploadResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";
import { ruleGuidance } from "@/lib/nf-parse-errors";

interface NfParseResultsProps {
  result: NfUploadResponse;
}

export function NfParseResults({ result }: NfParseResultsProps) {
  const { t } = useTranslation();
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;
  const [errorsOpen, setErrorsOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sheetFilter, setSheetFilter] = useState("all");

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  // Get list of unique sheets with error counts
  const sheetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const err of result.errors) {
      counts[err.sheet] = (counts[err.sheet] || 0) + 1;
    }
    return counts;
  }, [result.errors]);

  // Filter errors by search query and sheet filter
  const filteredErrors = useMemo(() => {
    return result.errors
      .map((err, originalIndex) => ({ err, originalIndex }))
      .filter(({ err }) => {
        if (sheetFilter !== "all" && err.sheet !== sheetFilter) {
          return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          err.sheet.toLowerCase().includes(q) ||
          String(err.row).includes(q) ||
          err.column.toLowerCase().includes(q) ||
          err.rule.toLowerCase().includes(q) ||
          err.message.toLowerCase().includes(q)
        );
      });
  }, [result.errors, sheetFilter, searchQuery]);

  const allFilteredExpanded = useMemo(() => {
    if (filteredErrors.length === 0) return false;
    return filteredErrors.every(({ originalIndex }) => expandedRows.has(originalIndex));
  }, [filteredErrors, expandedRows]);

  const toggleExpandAll = () => {
    if (allFilteredExpanded) {
      setExpandedRows(new Set());
    } else {
      const next = new Set<number>();
      filteredErrors.forEach(({ originalIndex }) => next.add(originalIndex));
      setExpandedRows(next);
    }
  };

  return (
    <Card className="transition-all">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            {hasErrors ? (
              <XCircle className="size-4 text-destructive shrink-0" />
            ) : hasWarnings ? (
              <AlertTriangle className="size-4 text-warning shrink-0" />
            ) : (
              <CheckCircle2 className="size-4 text-success shrink-0" />
            )}
            <span>{t("nf.uploadResults")}</span>
          </div>
          {hasErrors && (
            <button
              type="button"
              onClick={() => setFullViewOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-border bg-muted/40 hover:bg-muted transition-colors cursor-pointer"
              title={t("nf.openFullView", "Open Full View")}
            >
              <Maximize2 className="size-3.5" />
              <span>{t("nf.openFullView", "Full View")}</span>
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {result.sheets_found.map((sheet) => (
            <Badge key={sheet} variant="secondary">
              {sheet}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox
            label={t("nf.members")}
            parsed={result.rows_parsed.members}
            imported={result.rows_imported.members}
          />
          <StatBox
            label={t("nf.savings")}
            parsed={result.rows_parsed.savings_accounts}
            imported={result.rows_imported.savings_accounts}
          />
          <StatBox
            label={t("nf.loans")}
            parsed={result.rows_parsed.loans}
            imported={result.rows_imported.loans}
          />
          <StatBox
            label={t("nf.fixedDeposits")}
            parsed={result.rows_parsed.fixed_deposits}
            imported={result.rows_imported.fixed_deposits}
          />
          <StatBox
            label={t("nf.farmCoops")}
            parsed={result.rows_parsed.farm_coop}
            imported={result.rows_imported.farm_coop}
          />
        </div>

        {hasErrors && (
          <div className="space-y-3">
            {/* Header control banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5">
              <button
                type="button"
                onClick={() => setErrorsOpen((o) => !o)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-destructive hover:opacity-80 transition-opacity cursor-pointer"
              >
                {errorsOpen ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                <span>{t("nf.errorsWithCount", { count: result.errors.length })}</span>
              </button>

              {errorsOpen && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-destructive/20 bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                  >
                    <BookOpen className="size-3.5 text-destructive" />
                    <span>
                      {allFilteredExpanded
                        ? t("nf.collapseAllDetails", "Collapse All Details")
                        : t("nf.expandAllDetails", "Expand All Details")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFullViewOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-destructive/20 bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                  >
                    <Maximize2 className="size-3.5 text-destructive" />
                    <span>{t("nf.openFullView", "Full View")}</span>
                  </button>
                </div>
              )}
            </div>

            {errorsOpen && (
              <div className="space-y-3">
                {/* Search & Sheet filter bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <div className="relative flex-1">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("nf.searchErrors", "Search errors, rules, or messages...")}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {Object.keys(sheetCounts).length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                      <button
                        type="button"
                        onClick={() => setSheetFilter("all")}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                          sheetFilter === "all"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground border border-border"
                        }`}
                      >
                        {t("nf.allSheets", "All Sheets")} ({result.errors.length})
                      </button>
                      {Object.entries(sheetCounts).map(([sheetName, count]) => (
                        <button
                          key={sheetName}
                          type="button"
                          onClick={() => setSheetFilter(sheetName)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                            sheetFilter === sheetName
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:text-foreground border border-border"
                          }`}
                        >
                          {sheetName} ({count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Table block */}
                <div className="rounded-lg border border-destructive/20 overflow-hidden bg-background">
                  <div
                    className={`overflow-y-auto transition-all ${isMaximized ? "max-h-[75vh]" : "max-h-80"}`}
                  >
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-xs z-10">
                        <TableRow>
                          <TableHead className="text-xs w-8" />
                          <TableHead className="text-xs">{t("nf.sheet")}</TableHead>
                          <TableHead className="text-xs">{t("nf.row")}</TableHead>
                          <TableHead className="text-xs">{t("nf.column")}</TableHead>
                          <TableHead className="text-xs">{t("nf.rule")}</TableHead>
                          <TableHead className="text-xs">{t("nf.message")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredErrors.length > 0 ? (
                          filteredErrors.map(({ err, originalIndex }) => {
                            const guidance = ruleGuidance(err.rule);
                            const isExpanded = expandedRows.has(originalIndex);
                            return (
                              <ErrorRow
                                key={originalIndex}
                                index={originalIndex}
                                sheet={err.sheet}
                                row={err.row}
                                column={err.column}
                                rule={err.rule}
                                message={err.message}
                                guidanceTitle={guidance.title}
                                guidanceDescription={guidance.description}
                                guidanceFix={guidance.fix}
                                isExpanded={isExpanded}
                                onToggle={() => toggleRow(originalIndex)}
                              />
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-6 text-xs text-muted-foreground"
                            >
                              No matching errors found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {hasWarnings && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-warning">
              {t("nf.warningsWithCount", { count: result.warnings.length })}
            </p>
            <div className={`overflow-y-auto space-y-1 ${isMaximized ? "max-h-64" : "max-h-32"}`}>
              {result.warnings.map((warn, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/30"
                >
                  <Info className="size-3.5 shrink-0 mt-0.5 text-warning" />
                  <span>
                    <span className="font-mono">{warn.rule}</span>: {warn.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasErrors && !hasWarnings && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" />
            {t("nf.allImported")}
          </div>
        )}
      </CardContent>

      {/* Full View popup */}
      <Dialog open={fullViewOpen} onOpenChange={setFullViewOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <XCircle className="size-5 text-destructive" />
              {t("nf.errorsWithCount", { count: result.errors.length })}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
            {/* Search & sheet filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("nf.searchErrors", "Search errors, rules, or messages...")}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-md bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
              {Object.keys(sheetCounts).length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSheetFilter("all")}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      sheetFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {t("nf.allSheets", "All Sheets")} ({result.errors.length})
                  </button>
                  {Object.entries(sheetCounts).map(([sheetName, count]) => (
                    <button
                      key={sheetName}
                      type="button"
                      onClick={() => setSheetFilter(sheetName)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                        sheetFilter === sheetName
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {sheetName} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Expand all */}
            <div className="flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={toggleExpandAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-destructive/20 bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <BookOpen className="size-3.5 text-destructive" />
                <span>
                  {allFilteredExpanded
                    ? t("nf.collapseAllDetails", "Collapse All Details")
                    : t("nf.expandAllDetails", "Expand All Details")}
                </span>
              </button>
              <span className="text-xs text-muted-foreground">
                {t("nf.showingCount", { count: filteredErrors.length })}
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 rounded-lg border border-destructive/20 overflow-hidden bg-background">
              <div className="h-full overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-xs z-10">
                    <TableRow>
                      <TableHead className="text-xs w-8" />
                      <TableHead className="text-xs">{t("nf.sheet")}</TableHead>
                      <TableHead className="text-xs">{t("nf.row")}</TableHead>
                      <TableHead className="text-xs">{t("nf.column")}</TableHead>
                      <TableHead className="text-xs">{t("nf.rule")}</TableHead>
                      <TableHead className="text-xs">{t("nf.message")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredErrors.length > 0 ? (
                      filteredErrors.map(({ err, originalIndex }) => {
                        const guidance = ruleGuidance(err.rule);
                        const isExpanded = expandedRows.has(originalIndex);
                        return (
                          <ErrorRow
                            key={originalIndex}
                            index={originalIndex}
                            sheet={err.sheet}
                            row={err.row}
                            column={err.column}
                            rule={err.rule}
                            message={err.message}
                            guidanceTitle={guidance.title}
                            guidanceDescription={guidance.description}
                            guidanceFix={guidance.fix}
                            isExpanded={isExpanded}
                            onToggle={() => toggleRow(originalIndex)}
                          />
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-xs text-muted-foreground"
                        >
                          {t("nf.noMatchingErrors", "No matching errors found.")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface ErrorRowProps {
  index: number;
  sheet: string;
  row: number;
  column: string;
  rule: string;
  message: string;
  guidanceTitle: string;
  guidanceDescription: string;
  guidanceFix: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ErrorRow({
  sheet,
  row,
  column,
  rule,
  message,
  guidanceTitle,
  guidanceDescription,
  guidanceFix,
  isExpanded,
  onToggle,
}: ErrorRowProps) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={onToggle}>
        <TableCell className="text-xs">
          {isExpanded ? (
            <ChevronDown className="size-3.5 text-destructive shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          )}
        </TableCell>
        <TableCell className="text-xs font-semibold text-foreground">{sheet}</TableCell>
        <TableCell className="text-xs font-mono font-medium text-foreground">{row}</TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground">{column}</TableCell>
        <TableCell className="text-xs">
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
            {rule}
          </span>
        </TableCell>
        <TableCell className="text-xs font-medium">{message}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-destructive/5 hover:bg-destructive/5">
          <TableCell colSpan={6} className="p-0">
            <div className="px-4 py-3 space-y-3 border-l-4 border-destructive bg-card m-2 rounded-r-lg shadow-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-foreground">{guidanceTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {guidanceDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-primary/10 border border-primary/20 p-3">
                <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-primary">
                    {`How to fix (${sheet}, row ${row}):`}
                  </p>
                  <p className="text-xs text-foreground font-medium mt-1 leading-relaxed">
                    {guidanceFix}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono bg-muted/40 p-1.5 rounded">
                <span className="font-bold uppercase text-muted-foreground">Raw Error:</span>
                <span className="break-all">{message}</span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function StatBox({ label, parsed, imported }: { label: string; parsed: number; imported: number }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold text-foreground">
        {imported}
        <span className="text-xs text-muted-foreground font-normal"> / {parsed}</span>
      </p>
    </div>
  );
}
