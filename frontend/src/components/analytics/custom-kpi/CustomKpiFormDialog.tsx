import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  Percent,
  DollarSign,
  Hash,
  ArrowRight,
  Info,
  Check,
  X,
  Loader2,
  Sparkles,
  PlusIcon,
  Minus,
  XIcon,
  Divide,
  BarChart3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { LocalizedField, type FieldTranslations } from "@/components/shared/LocalizedField";

interface VariableDef {
  name: string;
  label: string;
  category: string;
  unit: string;
}

interface CustomKpiFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingKpiId: string | null;
  initialName: string;
  initialDescription: string;
  initialTranslations?: Record<string, unknown>;
  initialFormula: string;
  allVariables: VariableDef[];
  onSave: (payload: {
    name: string;
    description: string;
    formula: string;
    translations?: Record<string, unknown>;
  }) => Promise<void>;
  evaluateFormula: (
    formula: string,
  ) => Promise<{ value: number; is_valid: boolean; error?: string | null }>;
  isSaving: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  assets:
    "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  liabilities:
    "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  equity:
    "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  income:
    "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
  expenses:
    "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
  governance:
    "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-800",
  membership:
    "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800",
  other:
    "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800",
};

const CATEGORIES = [
  "assets",
  "liabilities",
  "equity",
  "income",
  "expenses",
  "governance",
  "membership",
  "other",
] as const;

export const CustomKpiFormDialog: React.FC<CustomKpiFormDialogProps> = ({
  isOpen,
  onClose,
  editingKpiId,
  initialName,
  initialDescription,
  initialTranslations,
  initialFormula,
  allVariables,
  onSave,
  evaluateFormula,
  isSaving,
}) => {
  const { t } = useOrganizationLabelsContext();
  const [name, setName] = useState("");
  const [nameTr, setNameTr] = useState<FieldTranslations>({});
  const [description, setDescription] = useState("");
  const [descTr, setDescTr] = useState<FieldTranslations>({});
  const [formula, setFormula] = useState("");
  const [testResult, setTestResult] = useState<{
    value: number;
    is_valid: boolean;
    error?: string | null;
  } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("assets");

  const CATEGORY_LABELS: Record<string, string> = {
    assets: t("analytics.catAssets"),
    liabilities: t("analytics.catLiabilities"),
    equity: t("analytics.catEquity"),
    income: t("analytics.catIncome"),
    expenses: t("analytics.catExpenses"),
    governance: t("analytics.catGovernance"),
    membership: t("analytics.catMembership"),
    other: t("analytics.catOther"),
  };

  const OPERATORS = [
    { symbol: "+", icon: PlusIcon, label: t("analytics.opAdd") },
    { symbol: "-", icon: Minus, label: t("analytics.opSubtract") },
    { symbol: "*", icon: XIcon, label: t("analytics.opMultiply") },
    { symbol: "/", icon: Divide, label: t("analytics.opDivide") },
    { symbol: "(", icon: null, label: "(" },
    { symbol: ")", icon: null, label: ")" },
  ];

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      setFormula(initialFormula);
      setTestResult(null);
      setNameTr(readTranslations(initialTranslations, "display_name"));
      setDescTr(readTranslations(initialTranslations, "description"));
    }
  }, [isOpen, initialName, initialDescription, initialTranslations, initialFormula]);

  function readTranslations(
    tr: Record<string, unknown> | undefined,
    field: "display_name" | "description",
  ): FieldTranslations {
    const acc: FieldTranslations = {};
    if (!tr) return acc;
    for (const lang of ["pt", "ss", "fr"] as const) {
      const entry = tr[lang] as { [k: string]: string } | undefined;
      acc[lang] = entry?.[field];
    }
    return acc;
  }

  function buildTranslations(
    fieldTranslations: FieldTranslations,
    field: "display_name" | "description",
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const lang of ["pt", "ss", "fr"] as const) {
      const v = fieldTranslations[lang];
      if (v) out[lang] = { ...((initialTranslations?.[lang] as object) || {}), [field]: v };
    }
    return out;
  }

  const handleTest = async () => {
    if (!formula.trim()) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateFormula(formula);
      setTestResult(result ?? null);
    } catch {
      setTestResult({ is_valid: false, value: 0, error: t("analytics.evalNetworkError") });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSaveClick = async () => {
    const nameT = buildTranslations(nameTr, "display_name");
    const descT = buildTranslations(descTr, "description");
    const merged: Record<string, unknown> = {};
    for (const lang of ["pt", "ss", "fr"] as const) {
      const a = (nameT[lang] ?? {}) as Record<string, unknown>;
      const b = (descT[lang] ?? {}) as Record<string, unknown>;
      merged[lang] = { ...a, ...b };
    }
    await onSave({ name, description, formula, translations: merged });
  };

  const insertVariable = (variable: string) => {
    setFormula((prev) => {
      const trimmed = prev.trimEnd();
      const needsSpace = trimmed.length > 0 && !trimmed.endsWith("(");
      return (needsSpace ? trimmed + " " : trimmed) + variable + " ";
    });
  };

  const insertOperator = (op: string) => {
    setFormula((prev) => {
      const trimmed = prev.trimEnd();
      const needsSpace = trimmed.length > 0 && op !== "(";
      return (needsSpace ? trimmed + " " : trimmed) + op + " ";
    });
  };

  const formulaPreview = useMemo(() => {
    if (!formula.trim()) return null;
    let preview = formula;
    allVariables.forEach((v) => {
      preview = preview.replace(new RegExp(`\\b${v.name}\\b`, "g"), v.label);
    });
    return preview;
  }, [formula, allVariables]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto z-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-950 font-bold">
            <Calculator className="h-5 w-5 text-blue-600" />
            {editingKpiId ? t("analytics.editKpiFormula") : t("analytics.createKpiFormula")}
          </DialogTitle>
          <DialogDescription>{t("analytics.kpiFormulaDesc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <LocalizedField
              id="dialog-kpi-name"
              label={t("analytics.indicatorName")}
              value={name}
              onChange={setName}
              translations={nameTr}
              onTranslationsChange={setNameTr}
              placeholder={t("analytics.formulaNamePlaceholder")}
              required
            />
          </div>
          <div className="grid gap-2">
            <LocalizedField
              id="dialog-kpi-description"
              label={`${t("analytics.description")} (${t("analytics.optional")})`}
              value={description}
              onChange={setDescription}
              translations={descTr}
              onTranslationsChange={setDescTr}
              placeholder={t("analytics.formulaDescPlaceholder")}
              multiline
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-sm font-semibold">{t("analytics.availableVariables")}</Label>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full flex-wrap justify-start gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl h-auto border border-slate-100">
                {CATEGORIES.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="text-[10px] md:text-xs px-2.5 py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer"
                  >
                    {CATEGORY_LABELS[cat]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CATEGORIES.map((cat) => (
                <TabsContent key={cat} value={cat} className="mt-2 outline-none">
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-2 border border-blue-100 rounded-xl bg-slate-50/50">
                    {allVariables
                      .filter((v) => v.category === cat)
                      .map((v) => (
                        <TooltipProvider key={v.name}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={`cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 py-1 ${CATEGORY_COLORS[cat]}`}
                                onClick={() => insertVariable(v.name)}
                              >
                                {v.unit === "currency" && (
                                  <DollarSign className="h-3 w-3 mr-0.5 opacity-60" />
                                )}
                                {v.unit === "percent" && (
                                  <Percent className="h-3 w-3 mr-0.5 opacity-60" />
                                )}
                                {v.unit === "ratio" && (
                                  <Hash className="h-3 w-3 mr-0.5 opacity-60" />
                                )}
                                {v.label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs z-[70]">
                              <code className="font-mono">{v.name}</code>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="grid gap-2">
            <Label className="text-sm font-semibold">{t("analytics.quickOperators")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {OPERATORS.map((op) => (
                <Button
                  key={op.symbol}
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 font-mono text-base font-bold hover:bg-blue-50 hover:border-blue-300 transition-all rounded-lg"
                  onClick={() => insertOperator(op.symbol)}
                >
                  {op.icon ? <op.icon className="h-3.5 w-3.5" /> : op.symbol}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dialog-formula-editor" className="text-sm font-semibold">
                {t("analytics.mathematicalFormula")}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:bg-blue-50 rounded-lg"
                onClick={() => setFormula("")}
              >
                {t("analytics.clear")}
              </Button>
            </div>
            <div className="relative">
              <Textarea
                id="dialog-formula-editor"
                className="font-mono text-sm min-h-[60px] border-blue-200 focus-visible:ring-blue-500 pr-8 rounded-xl"
                placeholder={t("analytics.formulaPlaceholder")}
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
              />
              {formula && (
                <div className="absolute right-2 top-2">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      testResult
                        ? testResult.is_valid
                          ? "bg-emerald-500"
                          : "bg-red-500"
                        : "bg-amber-400 animate-pulse"
                    }`}
                  />
                </div>
              )}
            </div>
            {formulaPreview && formulaPreview !== formula && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 border border-slate-100 rounded-xl p-2.5 overflow-x-auto max-w-full">
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span className="font-mono whitespace-nowrap">{formulaPreview}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Info className="h-3.5 w-3.5 text-blue-500" /> {t("analytics.mathOperatorsHint")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleTest}
              disabled={isEvaluating || !formula.trim()}
              className="border-blue-200 hover:bg-blue-50 rounded-xl"
            >
              {isEvaluating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="mr-2 h-4 w-4" />
              )}
              {t("analytics.testFormulaSyntax")}
            </Button>
            {testResult && (
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border ${
                  testResult.is_valid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                }`}
              >
                {testResult.is_valid ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    {t("analytics.validTestResult", { value: testResult.value.toFixed(2) })}
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-600" />
                    {testResult.error || t("analytics.syntaxError")}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={isSaving || !name.trim() || !formula.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {editingKpiId ? t("analytics.saveChanges") : t("analytics.saveCustomKpi")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
