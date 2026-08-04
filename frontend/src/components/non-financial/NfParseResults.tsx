import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
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
import type { NfUploadResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

interface NfParseResultsProps {
  result: NfUploadResponse;
}

export function NfParseResults({ result }: NfParseResultsProps) {
  const { t } = useTranslation();
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {hasErrors ? (
            <XCircle className="size-4 text-destructive" />
          ) : hasWarnings ? (
            <AlertTriangle className="size-4 text-warning" />
          ) : (
            <CheckCircle2 className="size-4 text-success" />
          )}
          {t("nf.uploadResults")}
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
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-destructive">
              {t("nf.errorsWithCount", { count: result.errors.length })}
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-destructive/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t("nf.sheet")}</TableHead>
                    <TableHead className="text-xs">{t("nf.row")}</TableHead>
                    <TableHead className="text-xs">{t("nf.column")}</TableHead>
                    <TableHead className="text-xs">{t("nf.rule")}</TableHead>
                    <TableHead className="text-xs">{t("nf.message")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((err, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{err.sheet}</TableCell>
                      <TableCell className="text-xs">{err.row}</TableCell>
                      <TableCell className="text-xs">{err.column}</TableCell>
                      <TableCell className="text-xs font-mono">{err.rule}</TableCell>
                      <TableCell className="text-xs">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {hasWarnings && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-warning">
              {t("nf.warningsWithCount", { count: result.warnings.length })}
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
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
    </Card>
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
