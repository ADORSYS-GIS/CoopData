import React, { useState } from "react";
import { Plus, Trash2, Calculator, Info, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCustomKpis } from "@/hooks/analytics/useCustomKpis";
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
import { toast } from "sonner";

const AVAILABLE_VARIABLES = [
  "total_assets",
  "gross_loan_portfolio",
  "net_loan_portfolio",
  "total_member_deposits",
  "total_equity",
  "par30",
  "par90",
  "npl_ratio",
  "loan_loss_coverage",
  "roa",
  "roe",
  "operating_expense_ratio",
  "capital_adequacy_ratio",
  "liquid_funds_ratio",
  "operational_self_sufficiency",
  "net_interest_margin",
  "deposits_to_loans",
];

export function CustomKpiBuilder() {
  const { kpis, isLoading, createKpi, deleteKpi, evaluateFormula, isCreating } = useCustomKpis();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formula, setFormula] = useState("");
  const [testResult, setTestResult] = useState<{ value: number; is_valid: boolean; error?: string | null } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleTest = async () => {
    if (!formula.trim()) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateFormula(formula);
      setTestResult(result ?? null);
    } catch (err) {
      setTestResult({ is_valid: false, value: 0, error: "Network error during evaluation" });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !formula.trim()) {
      toast.error("Name and formula are required");
      return;
    }
    try {
      await createKpi({ name, description, formula });
      toast.success("Custom KPI created successfully");
      setIsOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to create Custom KPI");
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setFormula("");
    setTestResult(null);
  };

  const insertVariable = (variable: string) => {
    setFormula((prev) => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + variable);
  };

  return (
    <Card className="col-span-full border border-blue-100 bg-blue-50/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-blue-900">
            <Calculator className="h-5 w-5 text-blue-600" />
            Custom KPI Formulas
          </CardTitle>
          <CardDescription>
            Define dynamic formulas mathematically derived from existing non-financial and financial data points.
          </CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> New Custom KPI
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Custom KPI</DialogTitle>
              <DialogDescription>
                Build a mathematical formula using existing system variables.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Indicator Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Adjusted Equity Ratio"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Explain what this metric calculates..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Available Variables</Label>
                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-2 border rounded-md bg-muted/50">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => insertVariable(v)}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="formula">Mathematical Formula</Label>
                <Textarea
                  id="formula"
                  className="font-mono text-sm"
                  placeholder="e.g. total_equity / total_assets * 100"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Use standard math operators: +, -, *, /, (), ^
                </p>
              </div>
              
              {/* Test Action */}
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handleTest} disabled={isEvaluating || !formula.trim()}>
                  {isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Test Formula"}
                </Button>
                {testResult && (
                  <div className={`flex items-center gap-1 text-sm ${testResult.is_valid ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.is_valid ? (
                      <><Check className="h-4 w-4" /> Parsed OK</>
                    ) : (
                      <><X className="h-4 w-4" /> {testResult.error}</>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isCreating || !name.trim() || !formula.trim()}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save KPI"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : kpis.length === 0 ? (
          <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
            <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No custom KPIs defined yet.</p>
            <p className="text-sm mt-1">Click the button above to create your first dynamic indicator.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi: any) => (
              <Card key={kpi.id} className="relative overflow-hidden group border-muted">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Delete this Custom KPI?")) {
                        deleteKpi(kpi.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold pr-8">{kpi.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {kpi.description || "No description"}
                  </p>
                  <div className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto whitespace-nowrap">
                    {kpi.formula}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
