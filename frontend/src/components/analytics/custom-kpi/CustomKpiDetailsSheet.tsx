import React, { useState, useEffect } from "react";
import { Calendar, Calculator, RefreshCw, Check, X, Trash2, Edit2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/openapi-client";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { Spinner } from "@/components/ui/spinner";

interface CustomKpiItem {
  id: string;
  name: string;
  formula: string;
  description?: string | null;
  created_at: string;
}

interface VariableDef {
  name: string;
  label: string;
  category: string;
  unit: string;
}

interface CoopKpiRow {
  cooperative_id: string;
  name: string;
}

interface CustomKpiDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  kpi: CustomKpiItem | null;
  systemAvg?: number;
  cooperatives: CoopKpiRow[];
  allVariables: VariableDef[];
  onEdit: (kpi: CustomKpiItem) => void;
  onDelete: (kpi: CustomKpiItem) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  assets: "bg-(--chart-1)/10 text-(--chart-1) border-(--chart-1)/20",
  liabilities: "bg-(--chart-3)/10 text-(--chart-3) border-(--chart-3)/20",
  equity: "bg-(--chart-2)/10 text-(--chart-2) border-(--chart-2)/20",
  income: "bg-(--chart-4)/10 text-(--chart-4) border-(--chart-4)/20",
  expenses: "bg-destructive/10 text-destructive border-destructive/20",
  governance: "bg-(--chart-4)/10 text-(--chart-4) border-(--chart-4)/20",
  membership: "bg-(--chart-5)/10 text-(--chart-5) border-(--chart-5)/20",
  other:
    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800",
};

export const CustomKpiDetailsSheet: React.FC<CustomKpiDetailsSheetProps> = ({
  isOpen,
  onClose,
  kpi,
  systemAvg,
  cooperatives,
  allVariables,
  onEdit,
  onDelete,
}) => {
  const { t } = useOrganizationLabelsContext();
  const [evalCoopId, setEvalCoopId] = useState<string>("none");
  const [evalResult, setEvalResult] = useState<{
    value: number;
    is_valid: boolean;
    error?: string | null;
  } | null>(null);
  const [isRunningEval, setIsRunningEval] = useState(false);

  useEffect(() => {
    setEvalCoopId("none");
    setEvalResult(null);
  }, [kpi]);

  const runEvaluationOnCoop = async (formulaStr: string, coopId: string) => {
    if (coopId === "none") {
      setEvalResult(null);
      return;
    }
    setIsRunningEval(true);
    try {
      const { data, error } = await apiClient.POST("/api/v1/ministry/custom-kpis/evaluate", {
        params: {
          query: { cooperative_id: coopId },
        },
        body: { formula: formulaStr },
      });
      if (error) {
        setEvalResult({
          value: 0,
          is_valid: false,
          error: t("analytics.evalFailed"),
        });
      } else {
        setEvalResult(data ?? null);
      }
    } catch {
      setEvalResult({ value: 0, is_valid: false, error: t("analytics.evalNetworkError") });
    } finally {
      setIsRunningEval(false);
    }
  };

  const handleCoopEvalChange = async (coopId: string) => {
    setEvalCoopId(coopId);
    if (kpi) {
      runEvaluationOnCoop(kpi.formula, coopId);
    }
  };

  const renderFormulaTokens = (formulaText: string) => {
    if (!formulaText) return null;
    const tokens = formulaText.split(/\s+/);
    return (
      <div className="flex flex-wrap gap-1.5 items-center font-sans">
        {tokens.map((token, index) => {
          const variable = allVariables.find((v) => v.name === token);
          if (variable) {
            return (
              <Badge
                key={index}
                variant="outline"
                className={`text-xs font-medium border px-2 py-0.5 shadow-sm ${
                  CATEGORY_COLORS[variable.category] || "bg-muted text-muted-foreground"
                }`}
              >
                {variable.label}
              </Badge>
            );
          }
          const isOperator = ["+", "-", "*", "/", "(", ")"].includes(token);
          if (isOperator) {
            let symbol = token;
            if (token === "*") symbol = "×";
            if (token === "/") symbol = "÷";
            return (
              <span
                key={index}
                className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/10"
              >
                {symbol}
              </span>
            );
          }
          return (
            <span
              key={index}
              className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
            >
              {token}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto z-50">
        {kpi && (
          <div className="space-y-6 pt-4 h-full flex flex-col justify-between">
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl font-extrabold text-foreground flex items-center gap-2">
                  <Calculator className="h-6 w-6 text-accent" />
                  {kpi.name}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {kpi.description || t("analytics.noDescriptionProvided")}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("analytics.mathematicalFormula")}
                  </Label>
                  <Card className="border border-accent/10 bg-accent/10/20 p-4">
                    <CardContent className="p-0">{renderFormulaTokens(kpi.formula)}</CardContent>
                  </Card>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("analytics.rawFormulaSyntax")}
                  </Label>
                  <pre className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-100 p-2 rounded-lg font-mono overflow-x-auto text-slate-700">
                    {kpi.formula}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t("analytics.createdDate")}
                    </Label>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-1">
                      <Calendar className="h-4 w-4 text-accent" />
                      {new Date(kpi.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t("analytics.systemAverage")}
                    </Label>
                    <p className="text-sm font-bold text-foreground mt-1 font-mono">
                      {systemAvg !== undefined ? (
                        systemAvg.toFixed(2)
                      ) : (
                        <span className="italic text-xs font-normal text-muted-foreground">
                          {t("analytics.noData")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <hr className="border-accent/10 my-4" />

                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> {t("analytics.interactiveEvalTool")}
                  </Label>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {t("analytics.evalToolDesc")}
                  </p>

                  <div className="flex gap-2">
                    <Select value={evalCoopId} onValueChange={handleCoopEvalChange}>
                      <SelectTrigger className="flex-1 rounded-xl border-accent/20">
                        <SelectValue placeholder={t("analytics.selectCooperative")} />
                      </SelectTrigger>
                      <SelectContent className="z-[60]">
                        <SelectItem value="none">{t("analytics.chooseCooperative")}</SelectItem>
                        {cooperatives.map((c) => (
                          <SelectItem key={c.cooperative_id} value={c.cooperative_id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {evalCoopId !== "none" && (
                    <div className="mt-3 p-4 rounded-xl border border-accent/10 bg-gradient-to-br from-accent/5 to-accent/5">
                      {isRunningEval ? (
                        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                          <Spinner size="md" className="h-4 w-4 text-accent" />{" "}
                          {t("analytics.evaluating")}
                        </div>
                      ) : evalResult ? (
                        evalResult.is_valid ? (
                          <div className="text-center py-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              {t("analytics.evalResult")}
                            </span>
                            <span className="text-3xl font-extrabold text-foreground font-mono block mt-1">
                              {evalResult.value >= 1000
                                ? evalResult.value.toLocaleString(undefined, {
                                    maximumFractionDigits: 1,
                                  })
                                : evalResult.value.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-success font-medium mt-1 inline-flex items-center gap-1">
                              <Check className="h-3 w-3" /> {t("analytics.syntaxEvaluatesOk")}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center py-2 text-destructive">
                            <span className="text-[10px] font-bold uppercase tracking-wider block">
                              {t("analytics.evalFailedTitle")}
                            </span>
                            <span className="text-xs font-semibold mt-1 block leading-relaxed">
                              {evalResult.error || t("analytics.missingFsData")}
                            </span>
                            <span className="text-[10px] text-destructive mt-1 inline-flex items-center gap-1">
                              <X className="h-3 w-3" /> {t("analytics.formulaFailsExec")}
                            </span>
                          </div>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-6 border-t border-accent/10">
              <Button
                variant="outline"
                onClick={() => onDelete(kpi)}
                className="flex-1 text-destructive hover:bg-destructive/10 border-destructive/20 rounded-xl"
              >
                <Trash2 className="h-4 w-4 mr-2" /> {t("analytics.deleteKpi")}
              </Button>
              <Button
                onClick={() => onEdit(kpi)}
                className="flex-1 bg-accent hover:bg-accent rounded-xl"
              >
                <Edit2 className="h-4 w-4 mr-2" /> {t("analytics.editKpi")}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
