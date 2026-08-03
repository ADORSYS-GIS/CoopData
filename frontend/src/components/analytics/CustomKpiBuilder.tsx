import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Calculator,
  Info,
  Check,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Divide,
  Minus,
  PlusIcon,
  XIcon,
  GripVertical,
  Hash,
  Percent,
  DollarSign,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCustomKpis } from "@/hooks/analytics/useCustomKpis";
import { useIndicatorCatalog } from "@/hooks/submissions/useNonFinancialIndicators";
import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface VariableDef {
  name: string;
  label: string;
  category:
    | "assets"
    | "liabilities"
    | "equity"
    | "income"
    | "expenses"
    | "governance"
    | "membership"
    | "other";
  unit: "currency" | "percent" | "ratio";
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

// Category colors map

const OPERATORS = [
  { symbol: "+", icon: PlusIcon, label: "Add" },
  { symbol: "-", icon: Minus, label: "Subtract" },
  { symbol: "*", icon: XIcon, label: "Multiply" },
  { symbol: "/", icon: Divide, label: "Divide" },
  { symbol: "(", icon: null, label: "(" },
  { symbol: ")", icon: null, label: ")" },
];

interface CustomKpiItem {
  id: string;
  name: string;
  formula: string;
  description?: string | null;
  created_at: string;
}

interface Props {
  customKpiValues?: Record<string, number>;
  cooperatives?: CoopKpiRow[];
}

export function CustomKpiBuilder({ customKpiValues, cooperatives }: Props) {
  const { t } = useTranslation();
  const { kpis, isLoading, createKpi, deleteKpi, evaluateFormula, isCreating } = useCustomKpis();
  const { data: catalog } = useIndicatorCatalog();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formula, setFormula] = useState("");
  const [testResult, setTestResult] = useState<{
    value: number;
    is_valid: boolean;
    error?: string | null;
  } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("assets");
  const [showValues, setShowValues] = useState(true);

  // Table sort and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const allVariables = useMemo(() => {
    const base: VariableDef[] = [
      // Assets
      {
        name: "ac_1100",
        label: "Total Liquid Assets (1100)",
        category: "assets",
        unit: "currency",
      },
      { name: "ac_1101", label: "Cash on Hand (1101)", category: "assets", unit: "currency" },
      {
        name: "ac_1102",
        label: "Cash at Bank - Current (1102)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1103",
        label: "Cash at Bank - Savings (1103)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1104",
        label: "Short-Term Investments (1104)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1200",
        label: "Gross Loan Portfolio (1200)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1201",
        label: "Performing Loan Portfolio (1201)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1202",
        label: "Loans in Arrears 1-30d (1202)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1203",
        label: "Loans in Arrears 31-60d (1203)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1204",
        label: "Loans in Arrears 61-90d (1204)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1205",
        label: "Non-Performing Loans (1205)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1250",
        label: "Loan Loss Provisions (1250)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1251",
        label: "General Loan Loss Prov (1251)",
        category: "assets",
        unit: "currency",
      },
      {
        name: "ac_1252",
        label: "Specific Loan Loss Prov (1252)",
        category: "assets",
        unit: "currency",
      },
      { name: "ac_1300", label: "Total Other Assets (1300)", category: "assets", unit: "currency" },
      {
        name: "ac_1301",
        label: "Accounts Receivable (1301)",
        category: "assets",
        unit: "currency",
      },
      { name: "ac_1302", label: "Prepaid Expenses (1302)", category: "assets", unit: "currency" },
      { name: "ac_1303", label: "Fixed Assets Cost (1303)", category: "assets", unit: "currency" },
      {
        name: "ac_1304",
        label: "Accumulated Depreciation (1304)",
        category: "assets",
        unit: "currency",
      },
      { name: "ac_1305", label: "Intangible Assets (1305)", category: "assets", unit: "currency" },
      { name: "ac_1999", label: "TOTAL ASSETS (1999)", category: "assets", unit: "currency" },

      // Liabilities
      {
        name: "ac_2100",
        label: "Member Deposits & Savings (2100)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2101",
        label: "Voluntary Savings Deposits (2101)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2102",
        label: "Mandatory Savings Deposits (2102)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2103",
        label: "Fixed Term Deposits (2103)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2200",
        label: "Total Borrowings (2200)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2201",
        label: "Short-Term Borrowings (2201)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2202",
        label: "Long-Term Borrowings (2202)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2300",
        label: "Total Other Liabilities (2300)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2301",
        label: "Accounts Payable (2301)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2302",
        label: "Accrued Expenses (2302)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2303",
        label: "Deferred Income (2303)",
        category: "liabilities",
        unit: "currency",
      },
      {
        name: "ac_2999",
        label: "TOTAL LIABILITIES (2999)",
        category: "liabilities",
        unit: "currency",
      },

      // Equity
      {
        name: "ac_3100",
        label: "Total Member Shares (3100)",
        category: "equity",
        unit: "currency",
      },
      {
        name: "ac_3101",
        label: "Permanent Share Capital (3101)",
        category: "equity",
        unit: "currency",
      },
      {
        name: "ac_3102",
        label: "Withdrawable Shares (3102)",
        category: "equity",
        unit: "currency",
      },
      { name: "ac_3200", label: "Total Reserves (3200)", category: "equity", unit: "currency" },
      { name: "ac_3201", label: "Statutory Reserve (3201)", category: "equity", unit: "currency" },
      { name: "ac_3202", label: "General Reserve (3202)", category: "equity", unit: "currency" },
      { name: "ac_3203", label: "Risk Reserve (3203)", category: "equity", unit: "currency" },
      { name: "ac_3300", label: "Retained Earnings (3300)", category: "equity", unit: "currency" },
      {
        name: "ac_3301",
        label: "Accumulated Surplus (3301)",
        category: "equity",
        unit: "currency",
      },
      {
        name: "ac_3302",
        label: "Current Year Surplus (3302)",
        category: "equity",
        unit: "currency",
      },
      { name: "ac_3999", label: "TOTAL EQUITY (3999)", category: "equity", unit: "currency" },

      // Income
      {
        name: "ac_4101",
        label: "Interest Income on Loans (4101)",
        category: "income",
        unit: "currency",
      },
      {
        name: "ac_4102",
        label: "Fees & Commissions Income (4102)",
        category: "income",
        unit: "currency",
      },
      {
        name: "ac_4201",
        label: "Other Operating Income (4201)",
        category: "income",
        unit: "currency",
      },
      { name: "ac_4999", label: "TOTAL INCOME (4999)", category: "income", unit: "currency" },

      // Expenses
      {
        name: "ac_5101",
        label: "Interest Exp on Deposits (5101)",
        category: "expenses",
        unit: "currency",
      },
      {
        name: "ac_5102",
        label: "Interest Exp on Borrowings (5102)",
        category: "expenses",
        unit: "currency",
      },
      { name: "ac_5201", label: "Personnel Costs (5201)", category: "expenses", unit: "currency" },
      {
        name: "ac_5202",
        label: "Administrative Expenses (5202)",
        category: "expenses",
        unit: "currency",
      },
      {
        name: "ac_5203",
        label: "Governance Expenses (5203)",
        category: "expenses",
        unit: "currency",
      },
      {
        name: "ac_5204",
        label: "Depreciation & Amort (5204)",
        category: "expenses",
        unit: "currency",
      },
      {
        name: "ac_5301",
        label: "Loan Loss Prov Expense (5301)",
        category: "expenses",
        unit: "currency",
      },
      { name: "ac_5999", label: "TOTAL EXPENSES (5999)", category: "expenses", unit: "currency" },
      { name: "ac_6999", label: "NET SURPLUS (6999)", category: "expenses", unit: "currency" },
    ];

    if (!catalog) return base;

    const catalogVars: VariableDef[] = catalog
      .filter((item) => item.data_type !== "Text")
      .map((item) => {
        const name = item.indicator_name;
        let category: "governance" | "membership" | "other" = "other";
        if (
          name.includes("board") ||
          name.includes("agm") ||
          name.includes("meetings") ||
          name.includes("audit") ||
          name.includes("returns") ||
          name.includes("appointed")
        ) {
          category = "governance";
        } else if (
          name.includes("member") ||
          name.includes("active") ||
          name.includes("dormant") ||
          name.includes("exited") ||
          name.includes("borrower") ||
          name.includes("savers") ||
          name.includes("trained")
        ) {
          category = "membership";
        }

        return {
          name: item.indicator_name,
          label: item.display_name,
          category,
          unit: "ratio" as const,
        };
      });

    return [...base, ...catalogVars];
  }, [catalog]);

  const handleTest = async () => {
    if (!formula.trim()) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateFormula(formula);
      setTestResult(result ?? null);
    } catch {
      setTestResult({ is_valid: false, value: 0, error: "Network error during evaluation" });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !formula.trim()) {
      toast.error(t("customKpiBuilder.toastNameFormulaRequired"));
      return;
    }
    try {
      await createKpi({ name, description, formula });
      toast.success(t("customKpiBuilder.toastCreateSuccess"));
      setIsOpen(false);
      resetForm();
    } catch {
      toast.error(t("customKpiBuilder.toastCreateFailed"));
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setFormula("");
    setTestResult(null);
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
      return (needsSpace ? trimmed + " " : trimmed) + op + (op === ")" ? " " : " ");
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

  const hasValues = customKpiValues && Object.keys(customKpiValues).length > 0;

  // Filter and sort cooperatives
  const filteredAndSortedCooperatives = useMemo(() => {
    if (!cooperatives) return [];

    const result = cooperatives.filter(
      (coop) =>
        coop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (coop.region && coop.region.toLowerCase().includes(searchTerm.toLowerCase())),
    );

    result.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      if (sortField === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === "region") {
        valA = (a.region || "").toLowerCase();
        valB = (b.region || "").toLowerCase();
      } else {
        valA = a.custom_kpis?.[sortField] ?? 0;
        valB = b.custom_kpis?.[sortField] ?? 0;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [cooperatives, searchTerm, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <Card className="col-span-full border border-violet-100 bg-gradient-to-br from-violet-50/50 to-indigo-50/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-violet-900">
            <Sparkles className="h-5 w-5 text-violet-600" />
            {t("customKpiBuilder.title")}
          </CardTitle>
          <CardDescription>
            {t("customKpiBuilder.description")}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {hasValues && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowValues(!showValues)}
              className="text-muted-foreground"
            >
              {showValues ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showValues ? t("customKpiBuilder.hideValues") : t("customKpiBuilder.showValues")}
            </Button>
          )}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700 shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> {t("customKpiBuilder.newKpiBtn")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-violet-600" />
                  {t("customKpiBuilder.createKpiTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("customKpiBuilder.createKpiDesc")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-sm font-semibold">
                    {t("customKpiBuilder.indicatorName")}
                  </Label>
                  <Input
                    id="name"
                    placeholder={t("customKpiBuilder.namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-violet-200 focus-visible:ring-violet-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-sm font-semibold">
                    {t("customKpiBuilder.descriptionLabel")}{" "}
                    <span className="text-muted-foreground font-normal">({t("customKpiBuilder.optional")})</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder={t("customKpiBuilder.descPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">{t("customKpiBuilder.availableVariables")}</Label>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/50 p-1 rounded-lg h-auto">
                      {(
                        [
                          "assets",
                          "liabilities",
                          "equity",
                          "income",
                          "expenses",
                          "governance",
                          "membership",
                          "other",
                        ] as const
                      ).map((cat) => (
                        <TabsTrigger
                           key={cat}
                           value={cat}
                           className="text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md"
                        >
                          {t(`customKpiBuilder.categories.${cat}`)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {(
                      [
                        "assets",
                        "liabilities",
                        "equity",
                        "income",
                        "expenses",
                        "governance",
                        "membership",
                        "other",
                      ] as const
                    ).map((cat) => (
                      <TabsContent key={cat} value={cat} className="mt-2">
                        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-2 border rounded-lg bg-muted/30">
                          {allVariables
                            .filter((v) => v.category === cat)
                            .map((v) => (
                              <TooltipProvider key={v.name}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className={`cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95 ${CATEGORY_COLORS[cat]}`}
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
                                  <TooltipContent side="top" className="text-xs">
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
                  <Label className="text-sm font-semibold">{t("customKpiBuilder.quickOperators")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {OPERATORS.map((op) => (
                      <Button
                        key={op.symbol}
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 font-mono text-lg font-bold hover:bg-violet-50 hover:border-violet-300 transition-colors"
                        onClick={() => insertOperator(op.symbol)}
                      >
                        {op.icon ? <op.icon className="h-4 w-4" /> : op.symbol}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="formula" className="text-sm font-semibold">
                      {t("customKpiBuilder.mathFormula")}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={() => setFormula("")}
                    >
                      {t("customKpiBuilder.clear")}
                    </Button>
                  </div>
                  <div className="relative">
                    <Textarea
                      id="formula"
                      className="font-mono text-sm min-h-[60px] border-violet-200 focus-visible:ring-violet-500 pr-8"
                      placeholder={t("customKpiBuilder.formulaPlaceholder")}
                      value={formula}
                      onChange={(e) => setFormula(e.target.value)}
                    />
                    {formula && (
                      <div className="absolute right-2 top-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      <span className="font-mono">{formulaPreview}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" /> {t("customKpiBuilder.mathOperatorsInfo")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleTest}
                    disabled={isEvaluating || !formula.trim()}
                    className="border-violet-200 hover:bg-violet-50"
                  >
                    {isEvaluating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BarChart3 className="mr-2 h-4 w-4" />
                    )}
                    {t("customKpiBuilder.testFormulaBtn")}
                  </Button>
                  {testResult && (
                    <div
                      className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
                        testResult.is_valid
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {testResult.is_valid ? (
                        <>
                          <Check className="h-4 w-4" />
                          {t("customKpiBuilder.testResultPrefix")} {testResult.value.toFixed(2)}
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          {testResult.error || t("customKpiBuilder.invalidFormula")}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  {t("customKpiBuilder.cancel")}
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !name.trim() || !formula.trim()}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {t("customKpiBuilder.saveKpiBtn")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : kpis.length === 0 ? (
          <div className="text-center p-10 border-2 border-dashed border-violet-200 rounded-xl bg-white/50">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-100 mb-4">
              <Calculator className="h-8 w-8 text-violet-600" />
            </div>
            <p className="text-lg font-semibold text-violet-900">{t("customKpiBuilder.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {t("customKpiBuilder.emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {showValues && hasValues && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {kpis.map(
                  (kpi: {
                    id: string;
                    name: string;
                    formula: string;
                    description?: string | null;
                    created_at: string;
                  }) => {
                    const value = customKpiValues?.[kpi.name];
                    const hasValue = value !== undefined && value !== null;
                    return (
                      <Card
                        key={kpi.id}
                        className="relative overflow-hidden group border-violet-100 bg-white hover:shadow-md hover:border-violet-300 transition-all duration-200"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(t("customKpiBuilder.deleteConfirm", { name: kpi.name }))) {
                                deleteKpi(kpi.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-sm font-semibold pr-8 text-foreground">
                            {kpi.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                          {hasValue ? (
                            <div className="mb-2">
                              <span className="text-2xl font-bold text-violet-700 tabular-nums">
                                {value >= 1000
                                  ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                  : value.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <div className="mb-2 text-sm text-muted-foreground italic">
                              {t("customKpiBuilder.noData")}
                            </div>
                          )}
                          <div className="bg-muted/50 p-1.5 rounded text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-nowrap">
                            {kpi.formula}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  },
                )}
              </div>
            )}

            {kpis.length > 0 && cooperatives && cooperatives.length > 0 && (
              <Card className="mt-8 border border-violet-100 bg-white shadow-sm overflow-hidden">
                <CardHeader className="pb-4 border-b border-muted bg-gradient-to-br from-violet-50/50 to-transparent">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold text-violet-950 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-violet-600 animate-pulse" />
                        {t("customKpiBuilder.breakdownTitle")}
                      </CardTitle>
                      <CardDescription>
                        {t("customKpiBuilder.breakdownDesc")}
                      </CardDescription>
                    </div>
                    <div className="w-full md:w-72">
                      <Input
                        placeholder={t("customKpiBuilder.searchPlaceholder")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border-violet-200 focus-visible:ring-violet-500 shadow-sm"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-0">
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm border-b border-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground z-10">
                        <tr>
                          <th
                            onClick={() => handleSort("name")}
                            className="p-4 cursor-pointer hover:bg-muted/100 hover:text-foreground transition-colors select-none whitespace-nowrap min-w-[220px]"
                          >
                            <div className="flex items-center gap-1">
                              {t("customKpiBuilder.cooperativeName")}
                              {sortField === "name" &&
                                (sortDirection === "asc" ? (
                                  <ChevronUp className="h-4 w-4 text-violet-600" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-violet-600" />
                                ))}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort("region")}
                            className="p-4 cursor-pointer hover:bg-muted/100 hover:text-foreground transition-colors select-none whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1">
                              {t("customKpiBuilder.region")}
                              {sortField === "region" &&
                                (sortDirection === "asc" ? (
                                  <ChevronUp className="h-4 w-4 text-violet-600" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-violet-600" />
                                ))}
                            </div>
                          </th>
                          {kpis.map((kpi: CustomKpiItem) => (
                            <th
                              key={kpi.id}
                              onClick={() => handleSort(kpi.name)}
                              className="p-4 cursor-pointer hover:bg-muted/100 hover:text-foreground transition-colors text-right select-none whitespace-nowrap min-w-[140px]"
                            >
                              <div className="flex items-center justify-end gap-1">
                                {kpi.name.replace(/_/g, " ")}
                                {sortField === kpi.name &&
                                  (sortDirection === "asc" ? (
                                    <ChevronUp className="h-4 w-4 text-violet-600" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-violet-600" />
                                  ))}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-muted bg-white/50">
                        {filteredAndSortedCooperatives.length === 0 ? (
                          <tr>
                            <td
                              colSpan={kpis.length + 2}
                              className="p-8 text-center text-muted-foreground italic"
                            >
                              {t("customKpiBuilder.noMatchingCoops")}
                            </td>
                          </tr>
                        ) : (
                          filteredAndSortedCooperatives.map((coop) => (
                            <tr
                              key={coop.cooperative_id}
                              className="hover:bg-violet-50/20 dark:hover:bg-muted/20 transition-colors"
                            >
                              <td className="p-4 font-semibold text-violet-950">{coop.name}</td>
                              <td className="p-4 text-muted-foreground">{coop.region || "—"}</td>
                              {kpis.map((kpi: CustomKpiItem) => {
                                const val = coop.custom_kpis?.[kpi.name];
                                const hasVal = val !== undefined && val !== null;
                                return (
                                  <td
                                    key={kpi.id}
                                    className="p-4 text-right font-mono font-bold text-violet-700"
                                  >
                                    {hasVal ? (
                                      val >= 1000 ? (
                                        val.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                      ) : (
                                        val.toFixed(2)
                                      )
                                    ) : (
                                      <span className="text-muted-foreground/40 font-normal italic text-xs">
                                        {t("customKpiBuilder.noData")}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
