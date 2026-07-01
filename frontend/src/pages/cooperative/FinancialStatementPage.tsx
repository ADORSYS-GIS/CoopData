import { useState } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Save,
  Send,
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
} from "lucide-react";
import { AppShell, Card } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import {
  createEmptyBalanceSheet,
  calculateTotalLiquidAssets,
  calculateGrossLoanPortfolio,
  calculateTotalLoanLossProvisions,
  calculateTotalOtherAssets,
  calculateTotalAssets,
  calculateTotalMemberDeposits,
  calculateTotalBorrowings,
  calculateTotalOtherLiabilities,
  calculateTotalLiabilities,
  calculateTotalMemberShares,
  calculateTotalReserves,
  calculateTotalRetainedEarnings,
  calculateTotalEquity,
  calculateTotalIncome,
  calculateTotalExpenses,
  validateBalanceSheet,
} from "@/lib/financial-data";
import type { BalanceSheet } from "@/lib/financial-data";
import {
  AssetsSection,
  LiabilitiesSection,
  EquitySection,
  IncomeSection,
  ExpensesSection,
} from "@/components/financial-form";
import { FinancialStatementUpload } from "@/components/upload/financial-statement-upload";

type Tab = "assets" | "liabilities" | "equity" | "income" | "expenses" | "summary";

export const FinancialStatementPage: React.FC = () => {
  const role = useUserRole();
  if (!role) return null;
  const [activeTab, setActiveTab] = useState<Tab>("assets");
  const [balanceSheet, setBalanceSheet] = useState(createEmptyBalanceSheet());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [dataPopulated, setDataPopulated] = useState(false);

  const isReadOnly = role === "apex";

  const handleDataExtracted = (data: BalanceSheet) => {
    setBalanceSheet(data);
    setDataPopulated(true);
    setShowUpload(false);
    toast.success("Financial data applied! Review each section and edit as needed.");
  };

  const handleSectionChange = (
    section:
      | "liquidAssets"
      | "loanPortfolio"
      | "loanLossProvisions"
      | "otherAssets"
      | "memberDeposits"
      | "borrowings"
      | "otherLiabilities"
      | "memberShares"
      | "reserves"
      | "retainedEarnings"
      | "financialIncome"
      | "otherIncome"
      | "financialExpenses"
      | "operatingExpenses"
      | "creditLossExpense",
    field: string,
    value: number,
  ) => {
    if (section === "creditLossExpense") {
      setBalanceSheet((prev) => ({
        ...prev,
        creditLossExpense: value,
      }));
    } else {
      setBalanceSheet((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof typeof prev] as object),
          [field]: value,
        },
      }));
    }
  };

  // Calculate all totals
  const assetTotals = {
    totalLiquidAssets: calculateTotalLiquidAssets(balanceSheet.liquidAssets),
    grossLoanPortfolio: calculateGrossLoanPortfolio(balanceSheet.loanPortfolio),
    totalLoanLossProvisions: calculateTotalLoanLossProvisions(balanceSheet.loanLossProvisions),
    totalOtherAssets: calculateTotalOtherAssets(balanceSheet.otherAssets),
    totalAssets: calculateTotalAssets(balanceSheet),
  };

  const liabilityTotals = {
    totalMemberDeposits: calculateTotalMemberDeposits(balanceSheet.memberDeposits),
    totalBorrowings: calculateTotalBorrowings(balanceSheet.borrowings),
    totalOtherLiabilities: calculateTotalOtherLiabilities(balanceSheet.otherLiabilities),
    totalLiabilities: calculateTotalLiabilities(balanceSheet),
  };

  const equityTotals = {
    totalMemberShares: calculateTotalMemberShares(balanceSheet.memberShares),
    totalReserves: calculateTotalReserves(balanceSheet.reserves),
    totalRetainedEarnings: calculateTotalRetainedEarnings(balanceSheet.retainedEarnings),
    totalEquity: calculateTotalEquity(balanceSheet),
  };

  const incomeTotals = {
    totalFinancialIncome:
      balanceSheet.financialIncome.interestIncomeLoans +
      balanceSheet.financialIncome.feesCommissionsIncome,
    totalOtherIncome: balanceSheet.otherIncome.otherOperatingIncome,
    totalIncome: calculateTotalIncome(balanceSheet),
  };

  const expenseTotals = {
    totalFinancialExpenses:
      balanceSheet.financialExpenses.interestExpenseDeposits +
      balanceSheet.financialExpenses.interestExpenseBorrowings,
    totalOperatingExpenses:
      balanceSheet.operatingExpenses.personnelCosts +
      balanceSheet.operatingExpenses.administrativeExpenses +
      balanceSheet.operatingExpenses.governanceExpenses +
      balanceSheet.operatingExpenses.depreciationAmortization,
    totalExpenses: calculateTotalExpenses(balanceSheet),
  };

  const netSurplus = incomeTotals.totalIncome - expenseTotals.totalExpenses;
  const balanceDifference =
    assetTotals.totalAssets - (liabilityTotals.totalLiabilities + equityTotals.totalEquity);
  const isBalanced = Math.abs(balanceDifference) < 0.01;

  const validation = validateBalanceSheet(balanceSheet);

  const handleSaveDraft = () => {
    localStorage.setItem("coopdata_draft_financial", JSON.stringify(balanceSheet));
    toast.success("Draft saved successfully");
  };

  const handleSubmit = async () => {
    if (!isBalanced) {
      toast.error("Balance sheet must balance before submission");
      return;
    }

    if (!validation.isValid) {
      toast.error("Please fix validation errors before submission");
      return;
    }

    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast.success("Financial statement submitted successfully!");
    setIsSubmitting(false);
  };

  const formatCurrency = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "assets", label: "Assets", icon: <span className="text-xs font-bold">1000</span> },
    {
      id: "liabilities",
      label: "Liabilities",
      icon: <span className="text-xs font-bold">2000</span>,
    },
    { id: "equity", label: "Equity", icon: <span className="text-xs font-bold">3000</span> },
    { id: "income", label: "Income", icon: <span className="text-xs font-bold">4000</span> },
    { id: "expenses", label: "Expenses", icon: <span className="text-xs font-bold">5000</span> },
    { id: "summary", label: "Summary", icon: <FileSpreadsheet className="size-4" /> },
  ];

  return (
    <AppShell
      title="Financial Statement Entry"
      subtitle="Complete balance sheet and income statement for cooperative filing"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={isReadOnly}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="size-4" />
            Save Draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={isReadOnly || isSubmitting || !isBalanced}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="size-4" />
            {isSubmitting ? "Submitting..." : "Submit Filing"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Upload Financial Statement Banner */}
        {!isReadOnly && !showUpload && (
          <div className="flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Upload className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {dataPopulated
                  ? "Data populated from uploaded document"
                  : "Upload a financial statement to auto-fill this form"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dataPopulated
                  ? "Review each section carefully and edit any values before submitting."
                  : "Upload a PDF or image of your balance sheet. Extracted data will populate the form fields."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {dataPopulated && (
                <button
                  onClick={() => {
                    setBalanceSheet(createEmptyBalanceSheet());
                    setDataPopulated(false);
                    toast.success("Form cleared. You can start fresh or upload again.");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-3.5" />
                  Clear Data
                </button>
              )}
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Upload className="size-3.5" />
                {dataPopulated ? "Upload Different" : "Upload Document"}
              </button>
            </div>
          </div>
        )}

        {/* Upload Panel */}
        {showUpload && !isReadOnly && (
          <Card
            title="Upload Financial Statement"
            subtitle="Upload a PDF or image to extract financial data automatically"
            edge="accent"
            action={
              <button
                onClick={() => setShowUpload(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-3.5" />
                Close
              </button>
            }
          >
            <FinancialStatementUpload
              onDataExtracted={handleDataExtracted}
              onClose={() => setShowUpload(false)}
            />
          </Card>
        )}

        {/* Balance Sheet Status */}
        <div
          className={`p-4 rounded-xl border ${isBalanced ? "bg-success/5 border-success/20" : "bg-warning/5 border-warning/20"}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isBalanced ? (
                <CheckCircle2 className="size-5 text-success" />
              ) : (
                <AlertTriangle className="size-5 text-warning-foreground" />
              )}
              <div>
                <p className="font-semibold text-foreground">
                  {isBalanced ? "Balance Sheet Balanced" : "Balance Sheet Not Balanced"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isBalanced
                    ? "Assets = Liabilities + Equity"
                    : `Difference: ${formatCurrency(Math.abs(balanceDifference))}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Net Surplus/(Deficit)</p>
              <p
                className={`text-lg font-bold ${netSurplus >= 0 ? "text-success" : "text-destructive"}`}
              >
                {netSurplus >= 0 ? "+" : ""}
                {formatCurrency(netSurplus)}
              </p>
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {!validation.isValid && (
          <Card className="border-destructive/20 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Validation Errors</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {validation.errors.map((err, i) => (
                    <li key={i}>• {err.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 pb-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <Card className="p-6">
          {activeTab === "assets" && (
            <AssetsSection
              liquidAssets={balanceSheet.liquidAssets}
              loanPortfolio={balanceSheet.loanPortfolio}
              loanLossProvisions={balanceSheet.loanLossProvisions}
              otherAssets={balanceSheet.otherAssets}
              onChange={handleSectionChange}
              totals={assetTotals}
            />
          )}

          {activeTab === "liabilities" && (
            <LiabilitiesSection
              memberDeposits={balanceSheet.memberDeposits}
              borrowings={balanceSheet.borrowings}
              otherLiabilities={balanceSheet.otherLiabilities}
              onChange={handleSectionChange}
              totals={liabilityTotals}
            />
          )}

          {activeTab === "equity" && (
            <EquitySection
              memberShares={balanceSheet.memberShares}
              reserves={balanceSheet.reserves}
              retainedEarnings={balanceSheet.retainedEarnings}
              onChange={handleSectionChange}
              totals={equityTotals}
            />
          )}

          {activeTab === "income" && (
            <IncomeSection
              financialIncome={balanceSheet.financialIncome}
              otherIncome={balanceSheet.otherIncome}
              onChange={handleSectionChange}
              totals={incomeTotals}
            />
          )}

          {activeTab === "expenses" && (
            <ExpensesSection
              financialExpenses={balanceSheet.financialExpenses}
              operatingExpenses={balanceSheet.operatingExpenses}
              creditLossExpense={balanceSheet.creditLossExpense}
              onChange={handleSectionChange}
              totals={expenseTotals}
            />
          )}

          {activeTab === "summary" && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-foreground">Financial Statement Summary</h3>

              {/* Balance Sheet Summary */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-surface">
                  <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(assetTotals.totalAssets)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Codes 1000-1999</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-surface">
                  <p className="text-sm text-muted-foreground mb-1">Total Liabilities</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(liabilityTotals.totalLiabilities)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Codes 2000-2999</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-surface">
                  <p className="text-sm text-muted-foreground mb-1">Total Equity</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(equityTotals.totalEquity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Codes 3000-3999</p>
                </div>
              </div>

              {/* Income Statement Summary */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-success/20 bg-success/5">
                  <p className="text-sm text-muted-foreground mb-1">Total Income</p>
                  <p className="text-2xl font-bold text-success">
                    {formatCurrency(incomeTotals.totalIncome)}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                  <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(expenseTotals.totalExpenses)}
                  </p>
                </div>
              </div>

              {/* Net Result */}
              <div
                className={`p-6 rounded-xl border ${netSurplus >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Net Surplus / (Deficit)</p>
                    <p
                      className={`text-3xl font-bold ${netSurplus >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {netSurplus >= 0 ? "+" : ""}
                      {formatCurrency(netSurplus)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Balance Check</p>
                    <div
                      className={`flex items-center gap-2 ${isBalanced ? "text-success" : "text-warning-foreground"}`}
                    >
                      {isBalanced ? (
                        <CheckCircle2 className="size-5" />
                      ) : (
                        <AlertTriangle className="size-5" />
                      )}
                      <span className="font-semibold">
                        {isBalanced
                          ? "Balanced"
                          : `Off by ${formatCurrency(Math.abs(balanceDifference))}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={handleSaveDraft}
                  disabled={isReadOnly}
                  className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="size-4" />
                  Save Draft
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isReadOnly || isSubmitting || !isBalanced}
                  className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="size-4" />
                  {isSubmitting ? "Submitting..." : "Submit Financial Statement"}
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => {
              const tabs: Tab[] = [
                "assets",
                "liabilities",
                "equity",
                "income",
                "expenses",
                "summary",
              ];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
            }}
            disabled={activeTab === "assets"}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="size-4" />
            Previous
          </button>
          <button
            onClick={() => {
              const tabs: Tab[] = [
                "assets",
                "liabilities",
                "equity",
                "income",
                "expenses",
                "summary",
              ];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
            }}
            disabled={activeTab === "summary"}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </AppShell>
  );
};
