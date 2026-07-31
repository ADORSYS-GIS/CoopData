import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  TrendingUp,
  Users,
  FileText,
  Send,
  DollarSign,
  BarChart3,
  Clock,
  Sprout,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Card } from "@/components/app-shell";
import {
  useSubmitManualFinancialStatement,
  useSubmitManualMembers,
  useDeleteManualFinancialStatement,
  useDeleteManualNonFinancialData,
} from "@/hooks/submissions/useManualEntry";
import { Route } from "@/routes/app.submissions_.$id.manual-entry";
import { useQuery } from "@tanstack/react-query";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import { apiClient } from "@/openapi-client";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { MemberRecord } from "@/lib/financial-data";

// Import types & helpers from manual-entry/ sub-directory
import type {
  WizardStep,
  WizardMember,
  WizardSavings,
  WizardLoan,
  WizardFixedDeposit,
  WizardFarmCoop,
} from "./manual-entry/types";
import {
  fmt,
  createEmptyFarmCoop,
  ACTIVE_ACCOUNT_CODES,
  ACCOUNT_METADATA,
  createEmptyFinancialGrid,
  mapAgeGroup,
  mapAgeGroupToFrontend,
  mapDpdCategory,
  mapDpdCategoryToFrontend,
} from "./manual-entry/helpers";
import {
  generateMockFinancialGrid,
  generateMockNonFinancialData,
} from "./manual-entry/mockData";

// Import subcomponents
import { FarmCoopForm } from "./manual-entry/FarmCoopForm";
import { ReviewSummary } from "./manual-entry/ReviewSummary";
import { FinancialExcelGrid } from "./manual-entry/FinancialExcelGrid";
import { MembersStep } from "./manual-entry/MembersStep";
import { SavingsStep } from "./manual-entry/SavingsStep";
import { LoansStep } from "./manual-entry/LoansStep";
import { DepositsStep } from "./manual-entry/DepositsStep";


export function ManualEntryWizard() {
  const { id: submissionId } = useParams({ from: Route.id });
  const navigate = useNavigate();

  const { data: submission, isLoading: isSubmissionLoading } = useSubmission(submissionId);

  const search = Route.useSearch();
  const initialStep = search.step || "financial";

  const isFinancialWizard = initialStep === "financial";

  const steps = useMemo(() => {
    if (isFinancialWizard) {
      return [
        { id: "financial" as const, label: "Financial Statement", icon: BarChart3 },
        { id: "review" as const, label: "Review & Submit", icon: FileText },
      ];
    } else {
      return [
        { id: "members" as const, label: "Membership Register", icon: Users },
        { id: "savings" as const, label: "Savings Ledger", icon: DollarSign },
        { id: "loans" as const, label: "Loan Book", icon: TrendingUp },
        { id: "deposits" as const, label: "Fixed Deposits", icon: Clock },
        { id: "farm" as const, label: "Farm Profile", icon: Sprout },
        { id: "review" as const, label: "Review & Submit", icon: FileText },
      ];
    }
  }, [isFinancialWizard]);

  // Determine starting step based on the wizard mode
  const [step, setStep] = useState<WizardStep>(isFinancialWizard ? "financial" : "members");

  const [currency, setCurrency] = useState<"SZL" | "USD">("SZL");
  const [accountingYear, setAccountingYear] = useState<"calendar" | "fiscal">("calendar");

  const [financialData, setFinancialData] = useState<Record<number, Record<number, number>>>(() =>
    createEmptyFinancialGrid(),
  );

  const [members, setMembers] = useState<WizardMember[]>([]);
  const [savings, setSavings] = useState<WizardSavings[]>([]);
  const [loans, setLoans] = useState<WizardLoan[]>([]);
  const [fixedDeposits, setFixedDeposits] = useState<WizardFixedDeposit[]>([]);
  const [farmCoop, setFarmCoop] = useState<WizardFarmCoop>(() => createEmptyFarmCoop());

  const submitFinancialStatement = useSubmitManualFinancialStatement(submissionId);
  const submitMembers = useSubmitManualMembers(submissionId);
  const deleteFinancialStatement = useDeleteManualFinancialStatement(submissionId);
  const deleteNonFinancialData = useDeleteManualNonFinancialData(submissionId);

  // ── Existing Data Query Loaders ──
  const { data: existingLineItems, isLoading: existingLineItemsLoading } = useQuery({
    queryKey: ["submission-line-items", submission?.financial_statement_id],
    queryFn: async () => {
      if (!submission?.financial_statement_id) return null;
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/financial-statements/{id}/line-items",
        {
          params: { path: { id: submission.financial_statement_id } },
        }
      );
      if (error) throw new Error((error as any).message || "Failed to fetch existing line items");
      return data;
    },
    enabled: !!submission?.financial_statement_id && isFinancialWizard,
  });

  const { data: existingMembers, isLoading: existingMembersLoading } = useQuery({
    queryKey: ["manual-entry-members", submissionId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/non-financial/members",
        {
          params: {
            query: {
              submission_id: submissionId,
              page_size: 1000,
            },
          },
        }
      );
      if (error) throw new Error((error as any).message || "Failed to fetch existing members");
      return data;
    },
    enabled: !isFinancialWizard,
  });

  const { data: existingSavings, isLoading: existingSavingsLoading } = useQuery({
    queryKey: ["manual-entry-savings", submissionId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/non-financial/savings",
        {
          params: {
            query: {
              submission_id: submissionId,
              page_size: 1000,
            },
          },
        }
      );
      if (error) throw new Error((error as any).message || "Failed to fetch existing savings accounts");
      return data;
    },
    enabled: !isFinancialWizard,
  });

  const { data: existingLoans, isLoading: existingLoansLoading } = useQuery({
    queryKey: ["manual-entry-loans", submissionId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/non-financial/loans",
        {
          params: {
            query: {
              submission_id: submissionId,
              page_size: 1000,
            },
          },
        }
      );
      if (error) throw new Error((error as any).message || "Failed to fetch existing loans");
      return data;
    },
    enabled: !isFinancialWizard,
  });

  const { data: existingDeposits, isLoading: existingDepositsLoading } = useQuery({
    queryKey: ["manual-entry-deposits", submissionId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/non-financial/fixed-deposits",
        {
          params: {
            query: {
              submission_id: submissionId,
              page_size: 1000,
            },
          },
        }
      );
      if (error) throw new Error((error as any).message || "Failed to fetch existing fixed deposits");
      return data;
    },
    enabled: !isFinancialWizard,
  });

  const { data: existingFarm, isLoading: existingFarmLoading } = useQuery({
    queryKey: ["manual-entry-farm", submissionId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/non-financial/farm-coop",
        {
          params: {
            query: {
              submission_id: submissionId,
              page_size: 10,
            },
          },
        }
      );
      if (error) throw new Error((error as any).message || "Failed to fetch existing farm profile");
      return data;
    },
    enabled: !isFinancialWizard,
  });

  const isDataLoading = isSubmissionLoading || 
    (isFinancialWizard 
      ? (submission?.financial_statement_id ? existingLineItemsLoading : false)
      : (existingMembersLoading || existingSavingsLoading || existingLoansLoading || existingDepositsLoading || existingFarmLoading));

  // ── Load state logic via useEffects ──
  useEffect(() => {
    if (existingLineItems) {
      const grid = createEmptyFinancialGrid();
      for (const item of existingLineItems) {
        if (item.account_code && grid[item.account_code]) {
          grid[item.account_code][item.month] = Number(item.value) || 0;
        }
      }
      setFinancialData(grid);
    }
  }, [existingLineItems]);

  useEffect(() => {
    const list = existingMembers?.data || (existingMembers as any)?.items;
    if (list) {
      setMembers(
        list.map((m: any) => ({
          _rowKey: Math.random().toString(36).slice(2),
          memberId: m.member_id,
          joinDate: m.join_date,
          status: m.status,
          exitDate: m.exit_date,
          gender: m.gender,
          ageGroup: mapAgeGroupToFrontend(m.age_group) as any,
          region: m.region,
          urbanRural: m.urban_rural,
          agmAttendance: m.agm_attendance,
          votingExercised: m.voting_exercised,
        })),
      );
    }
  }, [existingMembers]);

  useEffect(() => {
    const list = existingSavings?.data || (existingSavings as any)?.items;
    if (list) {
      setSavings(
        list.map((s: any) => ({
          _rowKey: Math.random().toString(36).slice(2),
          memberBusinessId: s.member_business_id || "",
          savingsAccountId: s.savings_account_id,
          accountType: s.account_type,
          accountOpeningDate: s.account_opening_date,
          accountStatus: s.account_status,
          contributionFrequency: s.contribution_frequency,
          lastContributionDate: s.last_contribution_date,
          numberOfContributions: s.number_of_contributions,
          balanceTrend: s.balance_trend,
          zeroBalanceFlag: s.zero_balance_flag,
          withdrawalFrequencyCategory: s.withdrawal_frequency_category,
          emergencyWithdrawalsFlag: s.emergency_withdrawals_flag,
          interestRate: Number(s.interest_rate) || 0,
          balance: Number(s.balance) || 0,
        })),
      );
    }
  }, [existingSavings]);

  useEffect(() => {
    const list = existingLoans?.data || (existingLoans as any)?.items;
    if (list) {
      setLoans(
        list.map((l: any) => ({
          _rowKey: Math.random().toString(36).slice(2),
          memberBusinessId: l.member_business_id || "",
          loanId: l.loan_id,
          loanProductType: l.loan_product_type,
          loanStartDate: l.loan_start_date,
          loanMaturityDate: l.loan_maturity_date,
          loanStatus: l.loan_status,
          borrowerType: l.borrower_type,
          youthBorrowerFlag: l.youth_borrower_flag,
          womenBorrowerFlag: l.women_borrower_flag,
          ruralBorrowerFlag: l.rural_borrower_flag,
          repaymentRegularity: l.repayment_regularity,
          daysPastDueCategory: mapDpdCategoryToFrontend(l.days_past_due_category) as any,
          missedInstallmentsCount: l.missed_installments_count,
          restructuredLoanFlag: l.restructured_loan_flag,
          numberOfRestructurings: l.number_of_restructurings,
          earlySettlementFlag: l.early_settlement_flag,
          multipleLoansFlag: l.multiple_loans_flag,
          largeBorrowerFlag: l.large_borrower_flag,
          interestRate: Number(l.interest_rate) || 0,
          balance: Number(l.balance) || 0,
          loanAmount: Number(l.loan_amount) || 0,
        })),
      );
    }
  }, [existingLoans]);

  useEffect(() => {
    const list = existingDeposits?.data || (existingDeposits as any)?.items;
    if (list) {
      setFixedDeposits(
        list.map((f: any) => ({
          _rowKey: Math.random().toString(36).slice(2),
          memberBusinessId: f.member_business_id || "",
          fixedDepositId: f.fixed_deposit_id,
          depositType: f.deposit_type,
          startDate: f.start_date,
          maturityDate: f.maturity_date,
          status: f.status,
          tenureCategory: f.tenure_category,
          originalTenureSelected: f.original_tenure_selected,
          earlyWithdrawalFlag: f.early_withdrawal_flag,
          rolloverAtMaturityFlag: f.rollover_at_maturity_flag,
          numberOfRenewals: f.number_of_renewals,
          changeInTenureAtRenewal: f.change_in_tenure_at_renewal,
          singleDepositorDependencyFlag: f.single_depositor_dependency_flag,
          interestRate: Number(f.interest_rate) || 0,
          balance: Number(f.balance) || 0,
        })),
      );
    }
  }, [existingDeposits]);

  useEffect(() => {
    const list = existingFarm?.data || (existingFarm as any)?.items;
    if (list?.[0]) {
      const f = list[0];
      setFarmCoop({
        cooperativeType: f.cooperative_type,
        primaryActivities: f.primary_activities,
        yearOfEstablishment: f.year_of_establishment || new Date().getFullYear(),
        operationalStatus: f.operational_status,
        activeProducerFlag: f.active_producer_flag,
        productionType: f.production_type,
        participationFrequency: f.participation_frequency,
        deliveryCompliance: f.delivery_compliance,
        productionCycleType: f.production_cycle_type,
        useOfProductionPlanning: f.use_of_production_planning,
        useOfSharedInputs: f.use_of_shared_inputs,
        qualityComplianceFlag: f.quality_compliance_flag,
        marketChannelType: f.market_channel_type,
        formalOfftakeAgreement: f.formal_offtake_agreement,
        buyerConcentrationFlag: f.buyer_concentration_flag,
        pricePredictabilityCategory: f.price_predictability_category,
        accessToStorage: f.access_to_storage,
        accessToProcessingFacilities: f.access_to_processing_facilities,
        transportCoordination: f.transport_coordination,
        climateExposureType: f.climate_exposure_type,
        irrigationAccess: f.irrigation_access,
        climateMitigationPractices: f.climate_mitigation_practices,
      });
    }
  }, [existingFarm]);

  // Snapshot computations for the final month of the period
  const finalMonth = accountingYear === "fiscal" ? 6 : 12;
  const getVal = useCallback(
    (code: number, m?: number) => financialData[code]?.[m || finalMonth] || 0,
    [financialData, finalMonth],
  );

  const totalAssets = useMemo(() => {
    return (
      getVal(1101) +
      getVal(1102) +
      getVal(1103) +
      getVal(1104) + // Liquid
      (getVal(1201) + getVal(1202) + getVal(1203) + getVal(1204) + getVal(1205)) + // Portfolio (provisions are added since they must be negative!)
      (getVal(1251) + getVal(1252)) + // Provisions (already negative)
      (getVal(1301) + getVal(1302) + getVal(1303) + getVal(1304) + getVal(1305)) // Other (depreciation is already negative)
    );
  }, [getVal]);

  const totalLiabilities = useMemo(() => {
    return (
      getVal(2101) +
      getVal(2102) +
      getVal(2103) +
      (getVal(2201) + getVal(2202)) +
      (getVal(2301) + getVal(2302) + getVal(2303))
    );
  }, [getVal]);

  const totalEquity = useMemo(() => {
    return (
      getVal(3101) +
      getVal(3102) +
      (getVal(3201) + getVal(3202) + getVal(3203)) +
      (getVal(3301) + getVal(3302))
    );
  }, [getVal]);

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  // Extract all Member IDs entered so far to use as drop-down selections in other tables
  const memberIds = useMemo(() => members.map((m) => m.memberId).filter(Boolean), [members]);

  const isSectionFilled = useCallback(
    (sectionId: string) => {
      switch (sectionId) {
        case "members":
          return members.length > 0;
        case "savings":
          return savings.length > 0;
        case "loans":
          return loans.length > 0;
        case "deposits":
          return fixedDeposits.length > 0;
        case "farm":
          return !!farmCoop.cooperativeType;
        default:
          return false;
      }
    },
    [members, savings, loans, fixedDeposits, farmCoop],
  );

  const handleFinancialCellChange = useCallback((code: number, monthNum: number, value: number) => {
    setFinancialData((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [monthNum]: value,
      },
    }));
  }, []);

  // ── Members ──
  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      {
        _rowKey: Math.random().toString(36).slice(2),
        memberId: `MEM-${String(prev.length + 1).padStart(3, "0")}`,
        joinDate: new Date().toISOString().slice(0, 10),
        status: "Active",
        gender: "Female",
        ageGroup: "18-35",
        region: "Manzini",
        urbanRural: "Rural",
        agmAttendance: false,
        votingExercised: false,
      } as WizardMember,
    ]);
  };

  const updateMember = useCallback(
    (key: string, field: keyof MemberRecord, value: string | boolean) => {
      setMembers((prev) => prev.map((m) => (m._rowKey === key ? { ...m, [field]: value } : m)));
    },
    [],
  );

  const removeMember = useCallback((key: string) => {
    setMembers((prev) => prev.filter((m) => m._rowKey !== key));
  }, []);

  // ── Savings ──
  const addSavings = () => {
    setSavings((prev) => [
      ...prev,
      {
        _rowKey: Math.random().toString(36).slice(2),
        memberBusinessId: memberIds[0] || "",
        savingsAccountId: `SAV-${String(prev.length + 1).padStart(3, "0")}`,
        accountType: "Voluntary",
        accountOpeningDate: new Date().toISOString().slice(0, 10),
        accountStatus: "Active",
        contributionFrequency: "Monthly",
        lastContributionDate: new Date().toISOString().slice(0, 10),
        numberOfContributions: 1,
        balanceTrend: "Stable",
        zeroBalanceFlag: false,
        withdrawalFrequencyCategory: "Low",
        emergencyWithdrawalsFlag: false,
        interestRate: 0,
        balance: 0,
      },
    ]);
  };

  const updateSavings = useCallback((key: string, field: keyof WizardSavings, value: any) => {
    setSavings((prev) => prev.map((s) => (s._rowKey === key ? { ...s, [field]: value } : s)));
  }, []);

  const removeSavings = useCallback((key: string) => {
    setSavings((prev) => prev.filter((s) => s._rowKey !== key));
  }, []);

  // ── Loans ──
  const addLoan = () => {
    setLoans((prev) => [
      ...prev,
      {
        _rowKey: Math.random().toString(36).slice(2),
        memberBusinessId: memberIds[0] || "",
        loanId: `LN-${String(prev.length + 1).padStart(3, "0")}`,
        loanProductType: "Personal",
        loanStartDate: new Date().toISOString().slice(0, 10),
        loanMaturityDate: new Date().toISOString().slice(0, 10),
        loanStatus: "Performing",
        borrowerType: "Individual",
        youthBorrowerFlag: false,
        womenBorrowerFlag: false,
        ruralBorrowerFlag: false,
        repaymentRegularity: "Regular",
        daysPastDueCategory: "0",
        missedInstallmentsCount: 0,
        restructuredLoanFlag: false,
        numberOfRestructurings: 0,
        earlySettlementFlag: false,
        multipleLoansFlag: false,
        largeBorrowerFlag: false,
        interestRate: 0.1,
        balance: 0,
        loanAmount: 0,
      },
    ]);
  };

  const updateLoan = useCallback((key: string, field: keyof WizardLoan, value: any) => {
    setLoans((prev) => prev.map((l) => (l._rowKey === key ? { ...l, [field]: value } : l)));
  }, []);

  const removeLoan = useCallback((key: string) => {
    setLoans((prev) => prev.filter((l) => l._rowKey !== key));
  }, []);

  // ── Fixed Deposits ──
  const addFixedDeposit = () => {
    setFixedDeposits((prev) => [
      ...prev,
      {
        _rowKey: Math.random().toString(36).slice(2),
        memberBusinessId: memberIds[0] || "",
        fixedDepositId: `FD-${String(prev.length + 1).padStart(3, "0")}`,
        depositType: "Standard",
        startDate: new Date().toISOString().slice(0, 10),
        maturityDate: new Date().toISOString().slice(0, 10),
        status: "Active",
        tenureCategory: "MediumTerm",
        originalTenureSelected: "12 Months",
        earlyWithdrawalFlag: false,
        rolloverAtMaturityFlag: false,
        number_of_renewals: 0,
        changeInTenureAtRenewal: false,
        singleDepositorDependencyFlag: false,
        interestRate: 0.05,
        balance: 0,
      } as unknown as WizardFixedDeposit,
    ]);
  };

  const updateFixedDeposit = useCallback(
    (key: string, field: keyof WizardFixedDeposit, value: any) => {
      setFixedDeposits((prev) =>
        prev.map((f) => (f._rowKey === key ? { ...f, [field]: value } : f)),
      );
    },
    [],
  );

  const removeFixedDeposit = useCallback((key: string) => {
    setFixedDeposits((prev) => prev.filter((f) => f._rowKey !== key));
  }, []);

  // ── Farm Coop ──
  const updateFarmCoop = useCallback((field: keyof WizardFarmCoop, value: any) => {
    setFarmCoop((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Delete actions ──
  const handleDeleteFinancial = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete the financial statement? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteFinancialStatement.mutateAsync();
      setFinancialData(createEmptyFinancialGrid());
      toast.success("Financial statement deleted successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete financial statement");
    }
  };

  const handleDeleteNonFinancial = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all non-financial databases? This will clear members, savings, loans, deposits, and farm profiles.",
      )
    )
      return;
    try {
      await deleteNonFinancialData.mutateAsync();
      setMembers([]);
      setSavings([]);
      setLoans([]);
      setFixedDeposits([]);
      setFarmCoop(createEmptyFarmCoop());
      toast.success("Non-financial databases cleared successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete non-financial databases");
    }
  };

  // ── Submit handlers ──
  const doSubmitFinancial = async () => {
    const lineItems: any[] = [];
    const getValLocal = (code: number, m: number) => financialData[code]?.[m] || 0;

    // 1. Map editable base accounts
    for (const code of ACTIVE_ACCOUNT_CODES) {
      const meta = ACCOUNT_METADATA[code];
      for (let m = 1; m <= 12; m++) {
        const val = getValLocal(code, m);
        lineItems.push({
          account_code: code,
          account_name: meta.name,
          account_category: meta.category,
          account_subcategory: meta.subcategory,
          month: m,
          value: val,
        });
      }
    }

    // 2. Compute and append all total rollup codes dynamically
    const rollupMetadata: Record<
      number,
      { name: string; category: string; subcategory: string; formula: (m: number) => number }
    > = {
      1100: {
        name: "Total Liquid Assets",
        category: "assets",
        subcategory: "liquid_assets",
        formula: (m) =>
          getValLocal(1101, m) + getValLocal(1102, m) + getValLocal(1103, m) + getValLocal(1104, m),
      },
      1200: {
        name: "Gross Loan Portfolio",
        category: "assets",
        subcategory: "loan_portfolio",
        formula: (m) =>
          getValLocal(1201, m) +
          getValLocal(1202, m) +
          getValLocal(1203, m) +
          getValLocal(1204, m) +
          getValLocal(1205, m),
      },
      1250: {
        name: "Allowance for Loan Losses",
        category: "assets",
        subcategory: "loan_loss_provisions",
        formula: (m) => getValLocal(1251, m) + getValLocal(1252, m),
      },
      1300: {
        name: "Total Other Assets",
        category: "assets",
        subcategory: "other_assets",
        formula: (m) =>
          getValLocal(1301, m) +
          getValLocal(1302, m) +
          getValLocal(1303, m) +
          getValLocal(1304, m) +
          getValLocal(1305, m),
      },
      1999: {
        name: "TOTAL ASSETS",
        category: "assets",
        subcategory: "total_assets",
        formula: (m) => {
          const liquid =
            getValLocal(1101, m) +
            getValLocal(1102, m) +
            getValLocal(1103, m) +
            getValLocal(1104, m);
          const gross =
            getValLocal(1201, m) +
            getValLocal(1202, m) +
            getValLocal(1203, m) +
            getValLocal(1204, m) +
            getValLocal(1205, m);
          const allowance = getValLocal(1251, m) + getValLocal(1252, m);
          const other =
            getValLocal(1301, m) +
            getValLocal(1302, m) +
            getValLocal(1303, m) +
            getValLocal(1304, m) +
            getValLocal(1305, m);
          return liquid + gross + allowance + other;
        },
      },
      2100: {
        name: "Total Member Deposits",
        category: "liabilities",
        subcategory: "member_deposits",
        formula: (m) => getValLocal(2101, m) + getValLocal(2102, m) + getValLocal(2103, m),
      },
      2200: {
        name: "Total Borrowings",
        category: "liabilities",
        subcategory: "borrowings",
        formula: (m) => getValLocal(2201, m) + getValLocal(2202, m),
      },
      2300: {
        name: "Total Other Liabilities",
        category: "liabilities",
        subcategory: "other_liabilities",
        formula: (m) => getValLocal(2301, m) + getValLocal(2302, m) + getValLocal(2303, m),
      },
      2999: {
        name: "TOTAL LIABILITIES",
        category: "liabilities",
        subcategory: "total_liabilities",
        formula: (m) =>
          getValLocal(2101, m) +
          getValLocal(2102, m) +
          getValLocal(2103, m) +
          getValLocal(2201, m) +
          getValLocal(2202, m) +
          getValLocal(2301, m) +
          getValLocal(2302, m) +
          getValLocal(2303, m),
      },
      3100: {
        name: "Total Member Shares",
        category: "equity",
        subcategory: "member_shares",
        formula: (m) => getValLocal(3101, m) + getValLocal(3102, m),
      },
      3200: {
        name: "Total Reserves",
        category: "equity",
        subcategory: "reserves",
        formula: (m) => getValLocal(3201, m) + getValLocal(3202, m) + getValLocal(3203, m),
      },
      3300: {
        name: "Total Retained Earnings",
        category: "equity",
        subcategory: "retained_earnings",
        formula: (m) => getValLocal(3301, m) + getValLocal(3302, m),
      },
      3999: {
        name: "TOTAL MEMBERS' EQUITY",
        category: "equity",
        subcategory: "total_equity",
        formula: (m) =>
          getValLocal(3101, m) +
          getValLocal(3102, m) +
          getValLocal(3201, m) +
          getValLocal(3202, m) +
          getValLocal(3203, m) +
          getValLocal(3301, m) +
          getValLocal(3302, m),
      },
      4100: {
        name: "Total Financial Income",
        category: "income",
        subcategory: "financial_income",
        formula: (m) => getValLocal(4101, m) + getValLocal(4102, m),
      },
      4999: {
        name: "TOTAL INCOME",
        category: "income",
        subcategory: "total_income",
        formula: (m) => getValLocal(4101, m) + getValLocal(4102, m) + getValLocal(4201, m),
      },
      5100: {
        name: "Total Financial Expenses",
        category: "expenses",
        subcategory: "financial_expenses",
        formula: (m) => getValLocal(5101, m) + getValLocal(5102, m),
      },
      5200: {
        name: "Total Operating Expenses",
        category: "expenses",
        subcategory: "operating_expenses",
        formula: (m) =>
          getValLocal(5201, m) + getValLocal(5202, m) + getValLocal(5203, m) + getValLocal(5204, m),
      },
      5999: {
        name: "TOTAL EXPENSES",
        category: "expenses",
        subcategory: "total_expenses",
        formula: (m) =>
          getValLocal(5101, m) +
          getValLocal(5102, m) +
          getValLocal(5201, m) +
          getValLocal(5202, m) +
          getValLocal(5203, m) +
          getValLocal(5204, m) +
          getValLocal(5301, m),
      },
      6999: {
        name: "NET SURPLUS/(DEFICIT)",
        category: "income",
        subcategory: "net_surplus",
        formula: (m) =>
          getValLocal(4101, m) +
          getValLocal(4102, m) +
          getValLocal(4201, m) -
          (getValLocal(5101, m) +
            getValLocal(5102, m) +
            getValLocal(5201, m) +
            getValLocal(5202, m) +
            getValLocal(5203, m) +
            getValLocal(5204, m) +
            getValLocal(5301, m)),
      },
    };

    for (const [codeStr, meta] of Object.entries(rollupMetadata)) {
      const code = Number(codeStr);
      for (let m = 1; m <= 12; m++) {
        const val = meta.formula(m);
        lineItems.push({
          account_code: code,
          account_name: meta.name,
          account_category: meta.category,
          account_subcategory: meta.subcategory,
          month: m,
          value: val,
        });
      }
    }

    await submitFinancialStatement.mutateAsync({
      accounting_year: accountingYear,
      currency,
      line_items: lineItems,
    });
  };

  const doSubmitNonFinancial = async () => {
    const hasLedgers = savings.length > 0 || loans.length > 0 || fixedDeposits.length > 0;
    if (hasLedgers && members.length === 0) {
      throw new Error(
        "You must enter members in the membership register to link with savings, loans, or fixed deposits.",
      );
    }
    const hasAnyData =
      members.length > 0 ||
      savings.length > 0 ||
      loans.length > 0 ||
      fixedDeposits.length > 0 ||
      !!farmCoop.cooperativeType;
    if (!hasAnyData) {
      throw new Error("Please enter data in at least one section before submitting.");
    }
    await submitMembers.mutateAsync({
      members: members.map((m) => ({
        member_id: m.memberId,
        join_date: m.joinDate,
        status: m.status,
        exit_date: m.exitDate ?? null,
        gender: m.gender,
        age_group: mapAgeGroup(m.ageGroup),
        region: m.region,
        urban_rural: m.urbanRural,
        agm_attendance: m.agmAttendance,
        leadership_role: m.leadershipRole ?? null,
        voting_exercised: m.votingExercised,
      })),
      savings_accounts:
        savings.length > 0
          ? savings.map((s) => ({
              member_business_id: s.memberBusinessId,
              savings_account_id: s.savingsAccountId,
              account_type: s.accountType,
              account_opening_date: s.accountOpeningDate,
              account_status: s.accountStatus,
              contribution_frequency: s.contributionFrequency,
              last_contribution_date: s.lastContributionDate || null,
              number_of_contributions: Number(s.numberOfContributions) || 0,
              balance_trend: s.balanceTrend,
              zero_balance_flag: s.zeroBalanceFlag,
              withdrawal_frequency_category: s.withdrawalFrequencyCategory,
              emergency_withdrawals_flag: s.emergencyWithdrawalsFlag,
              interest_rate: Number(s.interestRate) || 0,
              balance: Number(s.balance) || 0,
            }))
          : null,
      loans:
        loans.length > 0
          ? loans.map((l) => ({
              member_business_id: l.memberBusinessId,
              loan_id: l.loanId,
              loan_product_type: l.loanProductType,
              loan_start_date: l.loanStartDate,
              loan_maturity_date: l.loanMaturityDate,
              loan_status: l.loanStatus,
              borrower_type: l.borrowerType,
              youth_borrower_flag: l.youthBorrowerFlag,
              women_borrower_flag: l.womenBorrowerFlag,
              rural_borrower_flag: l.ruralBorrowerFlag,
              repayment_regularity: l.repaymentRegularity,
              days_past_due_category: mapDpdCategory(l.daysPastDueCategory),
              missed_installments_count: Number(l.missedInstallmentsCount) || 0,
              restructured_loan_flag: l.restructuredLoanFlag,
              number_of_restructurings: Number(l.numberOfRestructurings) || 0,
              early_settlement_flag: l.earlySettlementFlag,
              multiple_loans_flag: l.multipleLoansFlag,
              large_borrower_flag: l.largeBorrowerFlag,
              interest_rate: Number(l.interestRate) || 0,
              balance: Number(l.balance) || 0,
              loan_amount: Number(l.loanAmount) || 0,
            }))
          : null,
      fixed_deposits:
        fixedDeposits.length > 0
          ? fixedDeposits.map((f) => ({
              member_business_id: f.memberBusinessId,
              fixed_deposit_id: f.fixedDepositId,
              deposit_type: f.depositType,
              start_date: f.startDate,
              maturity_date: f.maturityDate,
              status: f.status,
              tenure_category: f.tenureCategory,
              original_tenure_selected: f.originalTenureSelected,
              early_withdrawal_flag: f.earlyWithdrawalFlag,
              rollover_at_maturity_flag: f.rolloverAtMaturityFlag,
              number_of_renewals: Number(f.numberOfRenewals) || 0,
              change_in_tenure_at_renewal: f.changeInTenureAtRenewal,
              single_depositor_dependency_flag: f.singleDepositorDependencyFlag,
              interest_rate: Number(f.interestRate) || 0,
              balance: Number(f.balance) || 0,
            }))
          : null,
      farm_coop: farmCoop.cooperativeType
        ? [
            {
              cooperative_type: farmCoop.cooperativeType,
              primary_activities: farmCoop.primaryActivities,
              year_of_establishment: Number(farmCoop.yearOfEstablishment) || null,
              operational_status: farmCoop.operationalStatus,
              active_producer_flag: farmCoop.activeProducerFlag,
              production_type: farmCoop.productionType,
              participation_frequency: farmCoop.participationFrequency,
              delivery_compliance: farmCoop.deliveryCompliance,
              production_cycle_type: farmCoop.productionCycleType,
              use_of_production_planning: farmCoop.useOfProductionPlanning,
              use_of_shared_inputs: farmCoop.useOfSharedInputs,
              quality_compliance_flag: farmCoop.qualityComplianceFlag,
              market_channel_type: farmCoop.marketChannelType,
              formal_offtake_agreement: farmCoop.formalOfftakeAgreement,
              buyer_concentration_flag: farmCoop.buyerConcentrationFlag,
              price_predictability_category: farmCoop.pricePredictabilityCategory,
              access_to_storage: farmCoop.accessToStorage,
              access_to_processing_facilities: farmCoop.accessToProcessingFacilities,
              transport_coordination: farmCoop.transportCoordination,
              climate_exposure_type: farmCoop.climateExposureType,
              irrigation_access: farmCoop.irrigationAccess,
              climate_mitigation_practices: farmCoop.climateMitigationPractices,
            },
          ]
        : null,
    });
  };

  const handleSubmitFinancialOnly = async () => {
    try {
      await doSubmitFinancial();
      toast.success("Financial statement submitted successfully");
      navigate({ to: "/app/submissions/$id", params: { id: submissionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit financial data");
    }
  };

  const handleSubmitNonFinancialOnly = async () => {
    try {
      await doSubmitNonFinancial();
      toast.success("Non-Financial databases submitted successfully");
      navigate({ to: "/app/submissions/$id", params: { id: submissionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit non-financial databases");
    }
  };

  const isSubmitting = submitFinancialStatement.isPending || submitMembers.isPending;
  const isDeletingFS = deleteFinancialStatement.isPending;
  const isDeletingNF = deleteNonFinancialData.isPending;

  if (isDataLoading) {
    return (
      <AppShell
        title={isFinancialWizard ? "Manual Entry - Financial" : "Manual Entry - Non-Financial"}
      >
        <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4 font-sans">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Loading manual entry data...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={isFinancialWizard ? "Manual Entry - Financial" : "Manual Entry - Non-Financial"}
    >
      <div className="max-w-[96%] mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 font-sans">
          <button
            onClick={() => navigate({ to: "/app/submissions/$id", params: { id: submissionId } })}
            className="size-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {isFinancialWizard
                ? "Financial Statement Manual Entry"
                : "Non-Financial Databases Manual Entry"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {submission?.reporting_year ? `Submission ${submission.reporting_year} ·` : ""}{" "}
              {isFinancialWizard
                ? "Enter monthly balance sheet and income/expense data directly"
                : "Enter membership register, savings, loans, deposits and farm activities"}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <Card className="px-4 py-3">
          <div className="flex items-center gap-0 overflow-x-auto">
            {steps.map((sItem, i) => {
              const active = sItem.id === step;
              const filled = isSectionFilled(sItem.id);
              const Icon = sItem.icon;
              return (
                <div key={sItem.id} className="flex items-center flex-shrink-0">
                  <div
                    onClick={() => setStep(sItem.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm cursor-default"
                        : filled
                          ? "text-success hover:bg-success/5"
                          : "text-muted-foreground/75 hover:bg-muted/30"
                    }`}
                  >
                    {filled ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                    <span className="hidden md:inline">{sItem.label}</span>
                    <span className="md:hidden">{i + 1}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight className="size-4 text-muted-foreground/30 mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Settings / Actions bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {step === "financial" && (
            <>
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-4 py-2 border border-border">
                <DollarSign className="size-4 text-muted-foreground" />
                <select
                  className="bg-transparent text-sm font-semibold text-foreground border-none outline-none cursor-pointer"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "SZL" | "USD")}
                >
                  <option value="SZL">SZL (Emalangeni)</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-4 py-2 border border-border">
                <TrendingUp className="size-4 text-muted-foreground" />
                <select
                  className="bg-transparent text-sm font-semibold text-foreground border-none outline-none cursor-pointer"
                  value={accountingYear}
                  onChange={(e) => setAccountingYear(e.target.value as "calendar" | "fiscal")}
                >
                  <option value="calendar">Calendar Year (Jan–Dec)</option>
                  <option value="fiscal">Fiscal Year (Jul–Jun)</option>
                </select>
              </div>
              {import.meta.env.DEV && (
                <button
                  onClick={() => {
                    setFinancialData(generateMockFinancialGrid());
                    toast.success("Test financial statement grid populated!");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors cursor-pointer focus:outline-none"
                >
                  🧪 Populate Test Data
                </button>
              )}
              {submission?.financial_statement_id && (
                <button
                  onClick={handleDeleteFinancial}
                  disabled={isDeletingFS}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/5 hover:bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors cursor-pointer disabled:opacity-50 focus:outline-none"
                >
                  {isDeletingFS ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Clear Financial Statement
                </button>
              )}
              {/* Balance checker pill */}
              <div
                className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl ${
                  isBalanced && totalAssets > 0
                    ? "bg-success/10 text-success"
                    : totalAssets === 0
                      ? "bg-muted text-muted-foreground"
                      : "bg-warning/10 text-warning-foreground"
                }`}
              >
                {isBalanced && totalAssets > 0 ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <AlertCircle className="size-3.5" />
                )}
                {currency} {fmt(totalAssets)} ·{" "}
                {totalAssets === 0
                  ? "Enter amounts below"
                  : isBalanced
                    ? "Period Ends Balanced ✓"
                    : `Period Ends Gap: ${fmt(Math.abs(totalAssets - totalLiabilities - totalEquity))}`}
              </div>
            </>
          )}

          {!isFinancialWizard && (
            <div className="ml-auto flex items-center gap-2">
              {import.meta.env.DEV && (
                <button
                  onClick={() => {
                    const mock = generateMockNonFinancialData();
                    setMembers(mock.members);
                    setSavings(mock.savings);
                    setLoans(mock.loans);
                    setFixedDeposits(mock.fixedDeposits);
                    setFarmCoop(mock.farmCoop);
                    toast.success(
                      "Test databases (membership, savings, loans, deposits, and farm profile) populated!",
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors cursor-pointer focus:outline-none"
                >
                  🧪 Populate Test Databases
                </button>
              )}
              <button
                onClick={handleDeleteNonFinancial}
                disabled={isDeletingNF}
                className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/5 hover:bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors cursor-pointer disabled:opacity-50 focus:outline-none"
              >
                {isDeletingNF ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Clear Non-Financial Databases
              </button>
            </div>
          )}
        </div>

        {/* ── STEP: Financial Statement ──────────────────────────────────── */}
        {step === "financial" && (
          <ErrorBoundary stepName="Financial Statement Step">
            <Card className="p-6">
              <FinancialExcelGrid
                accountingYear={accountingYear}
                currency={currency}
                financialData={financialData}
                onChange={handleFinancialCellChange}
              />
            </Card>
          </ErrorBoundary>
        )}

        {/* ── STEP: Members ─────────────────────────────────────────────── */}
        {step === "members" && (
          <ErrorBoundary stepName="Members Register Step">
            <MembersStep
              members={members}
              addMember={addMember}
              updateMember={updateMember}
              removeMember={removeMember}
            />
          </ErrorBoundary>
        )}

        {/* ── STEP: Savings ─────────────────────────────────────────────── */}
        {step === "savings" && (
          <ErrorBoundary stepName="Savings Ledger Step">
            <SavingsStep
              savings={savings}
              addSavings={addSavings}
              memberIds={memberIds}
              updateSavings={updateSavings}
              removeSavings={removeSavings}
            />
          </ErrorBoundary>
        )}

        {/* ── STEP: Loans ───────────────────────────────────────────────── */}
        {step === "loans" && (
          <ErrorBoundary stepName="Loans Register Step">
            <LoansStep
              loans={loans}
              addLoan={addLoan}
              memberIds={memberIds}
              updateLoan={updateLoan}
              removeLoan={removeLoan}
            />
          </ErrorBoundary>
        )}

        {/* ── STEP: Fixed Deposits ──────────────────────────────────────── */}
        {step === "deposits" && (
          <ErrorBoundary stepName="Fixed Deposits Step">
            <DepositsStep
              fixedDeposits={fixedDeposits}
              addFixedDeposit={addFixedDeposit}
              memberIds={memberIds}
              updateFixedDeposit={updateFixedDeposit}
              removeFixedDeposit={removeFixedDeposit}
            />
          </ErrorBoundary>
        )}

        {/* ── STEP: Farm Profile ────────────────────────────────────────── */}
        {step === "farm" && (
          <ErrorBoundary stepName="Farm Profile Step">
            <Card className="p-6">
              <div className="border-b border-border pb-4 mb-6 font-sans">
                <h3 className="text-sm font-bold text-foreground">Farm Cooperative Profile</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete this profile if this cooperative operates in agricultural production or
                  multipurpose activities.
                </p>
              </div>

              <FarmCoopForm data={farmCoop} onChange={updateFarmCoop} />
            </Card>
          </ErrorBoundary>
        )}

        {/* ── STEP: Review ─────────────────────────────────────────────── */}
        {step === "review" && (
          <div>
            {isFinancialWizard ? (
              <ReviewSummary
                financialData={financialData}
                accountingYear={accountingYear}
                currency={currency}
                onSubmitFinancial={handleSubmitFinancialOnly}
                isSubmitting={isSubmitting}
              />
            ) : (
              <div className="space-y-6 font-sans">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Members summary */}
                  <Card className="p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
                        <Users className="size-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Membership Register</h3>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Members</span>
                      <span className="font-mono font-semibold">{members.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-mono font-semibold">
                        {members.filter((m) => m.status === "Active").length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Female Members</span>
                      <span className="font-mono font-semibold">
                        {members.filter((m) => m.gender === "Female").length}
                      </span>
                    </div>
                  </Card>

                  {/* Ledgers Summary */}
                  <Card className="p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-8 rounded-lg bg-accent/10 grid place-items-center">
                        <DollarSign className="size-4 text-accent" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Financial Ledgers</h3>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Savings Accounts</span>
                      <span className="font-mono font-semibold">{savings.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Active Loans</span>
                      <span className="font-mono font-semibold">{loans.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Fixed Deposits</span>
                      <span className="font-mono font-semibold">{fixedDeposits.length}</span>
                    </div>
                  </Card>
                </div>

                <button
                  onClick={handleSubmitNonFinancialOnly}
                  disabled={
                    isSubmitting ||
                    (members.length === 0 &&
                      (savings.length > 0 || loans.length > 0 || fixedDeposits.length > 0))
                  }
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm focus:outline-none"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Submit Non-Financial Databases &amp; Finish
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-2 font-sans">
          <button
            onClick={() => {
              const idx = steps.findIndex((s) => s.id === step);
              if (idx > 0) setStep(steps[idx - 1].id);
            }}
            disabled={steps.findIndex((s) => s.id === step) === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            <ChevronLeft className="size-4" />
            Previous
          </button>

          {step !== "review" && (
            <button
              onClick={() => {
                const idx = steps.findIndex((s) => s.id === step);
                if (idx < steps.length - 1) setStep(steps[idx + 1].id);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
