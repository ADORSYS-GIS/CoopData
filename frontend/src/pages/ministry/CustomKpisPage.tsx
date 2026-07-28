import { useState, useMemo } from "react";
import {
  Plus,
  Calculator,
  Sparkles,
  Layers,
  Hash,
  Loader2,
  Calendar,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { useCustomKpis } from "@/hooks/analytics/useCustomKpis";
import { useIndicatorCatalog } from "@/hooks/submissions/useNonFinancialIndicators";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import broken-down subcomponents
import { CustomKpiCard } from "@/components/analytics/custom-kpi/CustomKpiCard";
import { CustomKpiDetailsSheet } from "@/components/analytics/custom-kpi/CustomKpiDetailsSheet";
import { CustomKpiFormDialog } from "@/components/analytics/custom-kpi/CustomKpiFormDialog";
import { CustomKpiBreakdownTable } from "@/components/analytics/custom-kpi/CustomKpiBreakdownTable";

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

interface CustomKpiItem {
  id: string;
  name: string;
  formula: string;
  description?: string | null;
  created_at: string;
}

export function CustomKpisPage() {
  const { kpis, isLoading: isKpiLoading, createKpi, updateKpi, deleteKpi, evaluateFormula, isCreating, isUpdating } = useCustomKpis();
  const { data: catalog } = useIndicatorCatalog();

  const handleEvaluateFormula = async (formula: string) => {
    const res = await evaluateFormula(formula);
    return res ?? { value: 0, is_valid: false, error: "No evaluation result returned" };
  };

  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Form dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<CustomKpiItem | null>(null);

  // Detail panel state
  const [selectedKpi, setSelectedKpi] = useState<CustomKpiItem | null>(null);

  // Delete confirmation state
  const [kpiToDelete, setKpiToDelete] = useState<CustomKpiItem | null>(null);

  // Fetch consolidated data for overview custom KPI averages and cooperatives breakdown
  const { data: overview, isLoading: isOverviewLoading } = useNationalOverview({
    reportingYear: Number(selectedYear),
  });

  const cooperatives = overview?.cooperatives ?? [];
  const customKpiValues = overview?.custom_kpis ?? {};

  const allVariables = useMemo(() => {
    const base: VariableDef[] = [
      // Assets
      { name: "ac_1100", label: "Total Liquid Assets (1100)", category: "assets", unit: "currency" },
      { name: "ac_1101", label: "Cash on Hand (1101)", category: "assets", unit: "currency" },
      { name: "ac_1102", label: "Cash at Bank - Current (1102)", category: "assets", unit: "currency" },
      { name: "ac_1103", label: "Cash at Bank - Savings (1103)", category: "assets", unit: "currency" },
      { name: "ac_1104", label: "Short-Term Investments (1104)", category: "assets", unit: "currency" },
      { name: "ac_1200", label: "Gross Loan Portfolio (1200)", category: "assets", unit: "currency" },
      { name: "ac_1201", label: "Performing Loan Portfolio (1201)", category: "assets", unit: "currency" },
      { name: "ac_1202", label: "Loans in Arrears 1-30d (1202)", category: "assets", unit: "currency" },
      { name: "ac_1203", label: "Loans in Arrears 31-60d (1203)", category: "assets", unit: "currency" },
      { name: "ac_1204", label: "Loans in Arrears 61-90d (1204)", category: "assets", unit: "currency" },
      { name: "ac_1205", label: "Non-Performing Loans (1205)", category: "assets", unit: "currency" },
      { name: "ac_1250", label: "Loan Loss Provisions (1250)", category: "assets", unit: "currency" },
      { name: "ac_1251", label: "General Loan Loss Prov (1251)", category: "assets", unit: "currency" },
      { name: "ac_1252", label: "Specific Loan Loss Prov (1252)", category: "assets", unit: "currency" },
      { name: "ac_1300", label: "Total Other Assets (1300)", category: "assets", unit: "currency" },
      { name: "ac_1301", label: "Accounts Receivable (1301)", category: "assets", unit: "currency" },
      { name: "ac_1302", label: "Prepaid Expenses (1302)", category: "assets", unit: "currency" },
      { name: "ac_1303", label: "Fixed Assets Cost (1303)", category: "assets", unit: "currency" },
      { name: "ac_1304", label: "Accumulated Depreciation (1304)", category: "assets", unit: "currency" },
      { name: "ac_1305", label: "Intangible Assets (1305)", category: "assets", unit: "currency" },
      { name: "ac_1999", label: "TOTAL ASSETS (1999)", category: "assets", unit: "currency" },

      // Liabilities
      { name: "ac_2100", label: "Member Deposits & Savings (2100)", category: "liabilities", unit: "currency" },
      { name: "ac_2101", label: "Voluntary Savings Deposits (2101)", category: "liabilities", unit: "currency" },
      { name: "ac_2102", label: "Mandatory Savings Deposits (2102)", category: "liabilities", unit: "currency" },
      { name: "ac_2103", label: "Fixed Term Deposits (2103)", category: "liabilities", unit: "currency" },
      { name: "ac_2200", label: "Total Borrowings (2200)", category: "liabilities", unit: "currency" },
      { name: "ac_2201", label: "Short-Term Borrowings (2201)", category: "liabilities", unit: "currency" },
      { name: "ac_2202", label: "Long-Term Borrowings (2202)", category: "liabilities", unit: "currency" },
      { name: "ac_2300", label: "Total Other Liabilities (2300)", category: "liabilities", unit: "currency" },
      { name: "ac_2301", label: "Accounts Payable (2301)", category: "liabilities", unit: "currency" },
      { name: "ac_2302", label: "Accrued Expenses (2302)", category: "liabilities", unit: "currency" },
      { name: "ac_2303", label: "Deferred Income (2303)", category: "liabilities", unit: "currency" },
      { name: "ac_2999", label: "TOTAL LIABILITIES (2999)", category: "liabilities", unit: "currency" },

      // Equity
      { name: "ac_3100", label: "Total Member Shares (3100)", category: "equity", unit: "currency" },
      { name: "ac_3101", label: "Permanent Share Capital (3101)", category: "equity", unit: "currency" },
      { name: "ac_3102", label: "Withdrawable Shares (3102)", category: "equity", unit: "currency" },
      { name: "ac_3200", label: "Total Reserves (3200)", category: "equity", unit: "currency" },
      { name: "ac_3201", label: "Statutory Reserve (3201)", category: "equity", unit: "currency" },
      { name: "ac_3202", label: "General Reserve (3202)", category: "equity", unit: "currency" },
      { name: "ac_3203", label: "Risk Reserve (3203)", category: "equity", unit: "currency" },
      { name: "ac_3300", label: "Retained Earnings (3300)", category: "equity", unit: "currency" },
      { name: "ac_3301", label: "Accumulated Surplus (3301)", category: "equity", unit: "currency" },
      { name: "ac_3302", label: "Current Year Surplus (3302)", category: "equity", unit: "currency" },
      { name: "ac_3999", label: "TOTAL EQUITY (3999)", category: "equity", unit: "currency" },

      // Income
      { name: "ac_4101", label: "Interest Income on Loans (4101)", category: "income", unit: "currency" },
      { name: "ac_4102", label: "Fees & Commissions Income (4102)", category: "income", unit: "currency" },
      { name: "ac_4201", label: "Other Operating Income (4201)", category: "income", unit: "currency" },
      { name: "ac_4999", label: "TOTAL INCOME (4999)", category: "income", unit: "currency" },

      // Expenses
      { name: "ac_5101", label: "Interest Exp on Deposits (5101)", category: "expenses", unit: "currency" },
      { name: "ac_5102", label: "Interest Exp on Borrowings (5102)", category: "expenses", unit: "currency" },
      { name: "ac_5201", label: "Personnel Costs (5201)", category: "expenses", unit: "currency" },
      { name: "ac_5202", label: "Administrative Expenses (5202)", category: "expenses", unit: "currency" },
      { name: "ac_5203", label: "Governance Expenses (5203)", category: "expenses", unit: "currency" },
      { name: "ac_5204", label: "Depreciation & Amort (5204)", category: "expenses", unit: "currency" },
      { name: "ac_5301", label: "Loan Loss Prov Expense (5301)", category: "expenses", unit: "currency" },
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

  const handleSave = async (payload: { name: string; description: string; formula: string }) => {
    try {
      if (editingKpi) {
        await updateKpi({
          id: editingKpi.id,
          payload,
        });
        toast.success("Custom KPI updated successfully");
        // Update selected KPI state to reflect changes if it was open in the details panel
        if (selectedKpi?.id === editingKpi.id) {
          setSelectedKpi({ ...editingKpi, ...payload });
        }
      } else {
        await createKpi(payload);
        toast.success("Custom KPI created successfully");
      }
      setIsFormOpen(false);
      setEditingKpi(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to save Custom KPI");
    }
  };

  const handleEditClick = (kpi: CustomKpiItem) => {
    setEditingKpi(kpi);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (kpi: CustomKpiItem) => {
    setKpiToDelete(kpi);
  };

  const performDelete = async () => {
    if (!kpiToDelete) return;
    try {
      await deleteKpi(kpiToDelete.id);
      toast.success("Custom KPI deleted successfully");
      setSelectedKpi(null);
    } catch {
      toast.error("Failed to delete Custom KPI");
    } finally {
      setKpiToDelete(null);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Filter and sort cooperatives for breakdown
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

  return (
    <AppShell title="Custom KPI Builder" subtitle="Ministry of Commerce & Cooperative Development Dashboard">
      <div className="space-y-8 max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 rounded-xl p-4 md:p-5 text-white shadow-lg relative overflow-hidden border border-blue-800">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 size-48 rounded-full bg-white/5 blur-xl pointer-events-none" />
          <div className="space-y-1.5">
            <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-blue-200" />
              Custom Indicators & KPIs
            </h2>
            <p className="text-blue-100 text-xs md:text-sm max-w-xl font-light leading-relaxed">
              Formulate bespoke operational metrics combining raw financial accounts with qualitative compliance variables. Track them in real-time across Eswatini's cooperatives.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2.5 py-1 border border-white/20">
              <Calendar className="h-3.5 w-3.5 text-blue-200" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent font-semibold focus:outline-none border-none text-white text-xs cursor-pointer"
              >
                {["2026", "2025", "2024", "2023"].map((y) => (
                  <option key={y} value={y} className="text-foreground">
                    Reporting Year: {y}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => {
                setEditingKpi(null);
                setIsFormOpen(true);
              }}
              className="bg-white hover:bg-blue-50 text-blue-950 font-semibold shadow-sm rounded-lg cursor-pointer text-xs md:text-sm py-1.5 h-auto"
            >
              <Plus className="mr-1.5 h-4 w-4 text-blue-600" /> New Custom KPI
            </Button>
          </div>
        </div>

        {/* Stats Summary Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-blue-900/20 bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Defined Formulas</p>
                <h4 className="text-2xl font-bold text-blue-900 mt-1">{isKpiLoading ? "..." : kpis.length} KPIs</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-900/20 bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Formula Evaluated Cooperatives</p>
                <h4 className="text-2xl font-bold text-blue-900 mt-1">{isOverviewLoading ? "..." : cooperatives.length} Cooperatives</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-900/20 bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <Hash className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Variables</p>
                <h4 className="text-2xl font-bold text-blue-900 mt-1">{allVariables.length} Indicators</h4>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards Grid */}
        <div>
          <h3 className="text-lg font-bold text-blue-950 mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
            Active Custom Metrics
          </h3>
          {isKpiLoading ? (
            <div className="flex justify-center p-12 bg-white rounded-2xl border border-blue-50">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : kpis.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed border-blue-100 rounded-2xl bg-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 mb-4">
                <Calculator className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-lg font-bold text-blue-950">No custom KPIs found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Combine financial line items and indicator catalog fields to write customized metrics for national audits.
              </p>
              <Button
                onClick={() => {
                  setEditingKpi(null);
                  setIsFormOpen(true);
                }}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" /> Create First KPI
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {kpis.map((kpi: CustomKpiItem) => (
                <CustomKpiCard
                  key={kpi.id}
                  kpi={kpi}
                  value={customKpiValues[kpi.name]}
                  onClick={() => setSelectedKpi(kpi)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Cooperative Custom KPI Breakdown Table */}
        {kpis.length > 0 && cooperatives.length > 0 && (
          <CustomKpiBreakdownTable
            kpis={kpis}
            cooperatives={cooperatives}
            filteredCooperatives={filteredAndSortedCooperatives}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}

        {/* Sliding Details Drawer Sheet */}
        <CustomKpiDetailsSheet
          isOpen={!!selectedKpi}
          onClose={() => setSelectedKpi(null)}
          kpi={selectedKpi}
          systemAvg={selectedKpi ? customKpiValues[selectedKpi.name] : undefined}
          cooperatives={cooperatives}
          allVariables={allVariables}
          onEdit={handleEditClick}
          onDelete={(kpi) => handleDeleteClick(kpi)}
        />

        {/* Create / Edit Modal Dialog */}
        <CustomKpiFormDialog
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingKpi(null);
          }}
          editingKpiId={editingKpi ? editingKpi.id : null}
          initialName={editingKpi ? editingKpi.name : ""}
          initialDescription={editingKpi ? editingKpi.description || "" : ""}
          initialFormula={editingKpi ? editingKpi.formula : ""}
          allVariables={allVariables}
          onSave={handleSave}
          evaluateFormula={handleEvaluateFormula}
          isSaving={isCreating || isUpdating}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!kpiToDelete} onOpenChange={(open) => !open && setKpiToDelete(null)}>
          <AlertDialogContent className="rounded-2xl border border-red-100 shadow-xl max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-red-100 rounded-xl">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <AlertDialogTitle className="text-lg font-bold text-slate-900">
                  Delete Custom KPI
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-800">&ldquo;{kpiToDelete?.name}&rdquo;</span>?
                {" "}This will permanently remove the formula and all associated data.
                <span className="mt-2 block font-medium text-red-600">This action cannot be undone.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 mt-2">
              <AlertDialogCancel className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-medium">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={performDelete}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
              >
                Yes, delete KPI
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppShell>
  );
}
