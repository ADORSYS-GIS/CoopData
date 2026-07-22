import React, { useState } from "react";
import { useForm, useWatch, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { financialQuestionnaireSchema, FinancialQuestionnaireValues } from "@/schema/questionnaire";
import { WizardLayout, WizardSection, WizardRow } from "@/components/shared/WizardLayout";
import { toast } from "sonner";
import { apiClient } from "@/openapi-client";
import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

const STEPS = [
  { id: "leadership", title: "Leadership & Governance", description: "Board and committee compositions" },
  { id: "staffing", title: "Staff Composition & Profile", description: "Manager and support staff breakdown" },
  { id: "training", title: "Training & Empowerment", description: "Member and staff training metrics" },
  { id: "membership", title: "Membership & Demographics", description: "Age distribution and dormancy" },
  { id: "tools", title: "Management & Governance Tools", description: "Operational manuals and bylaws" },
  { id: "compliance", title: "AGM & Audit Compliance", description: "AGM arrears and audit firm records" },
  { id: "products", title: "Products & Services", description: "Financial and non-financial services" },
  { id: "capitalization", title: "Capitalization", description: "Shares, reserves, and retained earnings" },
  { id: "savings", title: "Savings Portfolio", description: "Depositors and bank investments" },
  { id: "loans", title: "Loan Portfolio", description: "Issuance, delinquency, and fees" },
  { id: "income", title: "Other Activities Income", description: "Additional income streams" },
  { id: "periodic", title: "Periodic Reporting", description: "Incomes, assets, and liabilities" },
  { id: "qualitative", title: "Qualitative Assessment", description: "Advantages and challenges" },
];

const InputField = ({ label, name, type = "number" }: { label: string, name: string, type?: string }) => {
  const { register, formState: { errors } } = useFormContext();

  const getError = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };
  const error = getError(errors, name);

  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-muted-foreground">{label}</label>
      <input
        type={type}
        {...register(name)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
      />
      {error && (
        <span className="text-[10px] text-destructive">{error?.message as string}</span>
      )}
    </div>
  );
};

const TextAreaField = ({ label, name }: { label: string, name: string }) => {
  const { register, formState: { errors } } = useFormContext();
  const getError = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
  const error = getError(errors, name);

  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-muted-foreground">{label}</label>
      <textarea
        {...register(name)}
        rows={3}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
      />
      {error && <span className="text-[10px] text-destructive">{error?.message as string}</span>}
    </div>
  );
};

const SelectField = ({ label, name, options }: { label: string, name: string, options: string[] }) => {
  const { register, formState: { errors } } = useFormContext();
  const getError = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
  const error = getError(errors, name);

  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-muted-foreground">{label}</label>
      <select
        {...register(name)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
      >
        <option value="">-- Select option --</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <span className="text-[10px] text-destructive">{error?.message as string}</span>}
    </div>
  );
};

const RadioGroup = ({ label, name, options }: { label: string, name: string, options: string[] }) => {
  const { watch, setValue } = useFormContext();
  const currentValue: string = watch(name) || "";

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {options.map((opt) => {
          const selected = currentValue === opt;
          return (
            <div
              key={opt}
              onClick={() => setValue(name, opt, { shouldValidate: true, shouldDirty: true })}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                selected
                  ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                  : "border-border bg-background hover:bg-muted/50 text-foreground"
              }`}
            >
              <input
                type="radio"
                checked={selected}
                onChange={() => {}}
                className="border-border text-primary focus:ring-primary h-4 w-4 pointer-events-none"
              />
              <span>{opt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CheckboxGroup = ({ label, name, options }: { label: string, name: string, options: string[] }) => {
  const { watch, setValue } = useFormContext();
  const currentValues: string[] = watch(name) || [];

  const handleToggle = (opt: string) => {
    if (currentValues.includes(opt)) {
      setValue(name, currentValues.filter(v => v !== opt), { shouldValidate: true, shouldDirty: true });
    } else {
      setValue(name, [...currentValues, opt], { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {options.map((opt) => {
          const checked = currentValues.includes(opt);
          return (
            <div
              key={opt}
              onClick={() => handleToggle(opt)}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all select-none ${checked
                  ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                  : "border-border bg-background hover:bg-muted/50 text-foreground"
                }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => { }}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4 pointer-events-none"
              />
              <span>{opt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const FinancialQuestionnaireWizard: React.FC<{
  submissionId: string;
  onComplete: () => void;
  initialData?: any;
}> = ({ submissionId, onComplete, initialData }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FinancialQuestionnaireValues>({
    resolver: zodResolver(financialQuestionnaireSchema),
    mode: "onChange",
    defaultValues: initialData || {
      submission_id: submissionId,
      leadership_and_management: {
        board_members_male: 0, board_members_female: 0,
        exec_committee_male: 0, exec_committee_female: 0,
        credit_committee_male: 0, credit_committee_female: 0,
        education_committee_male: 0, education_committee_female: 0,
        supervisory_committee_male: 0, supervisory_committee_female: 0,
        chair_education: "", vice_chair_education: "", treasurer_education: "", secretary_education: "",
        staff_manager_male: 0, staff_manager_female: 0,
        staff_ass_manager_male: 0, staff_ass_manager_female: 0,
        staff_acc_male: 0, staff_acc_female: 0,
        staff_other_mgmt_male: 0, staff_other_mgmt_female: 0,
        staff_support_male: 0, staff_support_female: 0,
        manager_academic_level: "", manager_coop_training_level: "",
        members_trained_last_year: 0, leaders_trained_last_year: 0, staff_trained_last_year: 0,
        training_sponsor: "", training_quality_rating: "",
        member_training_needs: [], leader_training_needs: [], staff_training_needs: [],
        willing_to_cover_training_cost_pct: 0,
        registered_members_male: 0, registered_members_female: 0,
        active_members_male: 0, active_members_female: 0,
        active_members_youth_17_under: 0, active_members_18_25: 0, active_members_26_35: 0, active_members_36_60: 0, active_members_61_plus: 0,
        society_status: "", dormant_members_male: 0, dormant_members_female: 0,
        dormancy_reasons: [], dormancy_effect: "",
        management_tools: [], governance_tools: [],
        agm_up_to_date: false, agm_arrears_months: 0, agm_arrears_reasons: [], agm_attendance_male: 0, agm_attendance_female: 0,
        last_audit_date: "", last_inspection_date: "", last_mgmt_report_date: "", last_budget_date: "", last_committee_profile_date: "", last_audit_firm: "",
        financial_products: [], non_financial_products: [],
      },
      capitalization: {
        share_nominal_value: 0, share_capital_contribution_per_member: 0,
        total_share_capital_male: 0, total_share_capital_female: 0,
        borrowed_funds: 0, donations_grants: 0,
        accumulated_statutory_reserves_book_value: 0, actual_accumulated_statutory_reserves: 0, retained_earnings: 0,
      },
      savings_portfolio: {
        depositors_male: 0, depositors_female: 0, total_savings_male: 0, total_savings_female: 0,
        products_interest_rates: [], invested_in_bank: 0, invested_in_shares: 0, other_investments: 0,
      },
      loan_portfolio: {
        loans_issued_male: 0, loans_issued_female: 0, loans_issued_coops: 0,
        value_issued_male: 0, value_issued_female: 0, value_issued_coops: 0,
        outstanding_accounts_male: 0, outstanding_accounts_female: 0, outstanding_accounts_coops: 0,
        outstanding_value_male: 0, outstanding_value_female: 0, outstanding_value_coops: 0,
        delinquent_accounts_male: 0, delinquent_accounts_female: 0, delinquent_accounts_coops: 0,
        delinquent_value_male: 0, delinquent_value_female: 0, delinquent_value_coops: 0,
        delinquent_value_0_30_days: 0, delinquent_value_31_365_days: 0,
        provision_0_30_days: 0, provision_31_365_days: 0,
        written_off_value: 0, recovered_loans_12_months: 0,
        average_loan_term_months: 0, average_interest_rate_pct: 0,
        fees_stationery: 0, fees_application: 0, fees_loan_protection: 0, fees_penalties: 0, fees_others: 0,
        interest_rate_method: "",
      },
      other_activities_income: [],
      periodic_financial_reporting: {
        report_frequencies: [],
        current_total_income: 0, last_total_income: 0,
        current_expenditure: 0, last_expenditure: 0,
        current_net_income: 0, last_net_income: 0,
        current_surplus_distr: 0, last_surplus_distr: 0,
        non_current_assets: 0, total_current_assets: 0, current_liabilities: 0, long_term_liabilities: 0, total_equity: 0,
        accumulated_reserves_book_value: 0, actual_reserves_in_bank: 0,
      },
      qualitative_assessment: {
        competitor_advantages: [], success_reasons: [], failure_challenges: [], recommendations: [], respondent_comments: "",
      },
    },
  });

  const { formState: { errors }, trigger } = form;
  const values = useWatch({ control: form.control });

  // Very basic progress calculation based on non-zero / non-empty values
  // A complete implementation would strictly check required Zod fields
  const calculateProgress = () => {
    let total = 0;
    let filled = 0;

    const countFields = (obj: any) => {
      if (!obj) return;
      Object.keys(obj).forEach(key => {
        if (key === "submission_id") return;
        const val = obj[key];
        if (typeof val === 'object' && !Array.isArray(val)) {
          countFields(val);
        } else {
          total++;
          if (Array.isArray(val)) {
            if (val.length > 0) filled++;
          } else if (typeof val === 'number') {
            if (val > 0) filled++;
          } else if (typeof val === 'string') {
            if (val.trim() !== '') filled++;
          } else if (typeof val === 'boolean') {
            filled++;
          }
        }
      });
    };

    countFields(values);
    return { total, filled };
  };

  const { total, filled } = calculateProgress();

  const STEP_FIELDS: Record<number, string[]> = {
    0: [
      "leadership_and_management.board_members_male",
      "leadership_and_management.board_members_female",
      "leadership_and_management.exec_committee_male",
      "leadership_and_management.exec_committee_female",
      "leadership_and_management.credit_committee_male",
      "leadership_and_management.credit_committee_female",
      "leadership_and_management.education_committee_male",
      "leadership_and_management.education_committee_female",
      "leadership_and_management.supervisory_committee_male",
      "leadership_and_management.supervisory_committee_female",
    ],
    1: [
      "leadership_and_management.staff_manager_male",
      "leadership_and_management.staff_manager_female",
      "leadership_and_management.staff_ass_manager_male",
      "leadership_and_management.staff_ass_manager_female",
      "leadership_and_management.staff_acc_male",
      "leadership_and_management.staff_acc_female",
      "leadership_and_management.staff_other_mgmt_male",
      "leadership_and_management.staff_other_mgmt_female",
      "leadership_and_management.staff_support_male",
      "leadership_and_management.staff_support_female",
    ],
    2: [
      "leadership_and_management.members_trained_last_year",
      "leadership_and_management.leaders_trained_last_year",
      "leadership_and_management.staff_trained_last_year",
      "leadership_and_management.willing_to_cover_training_cost_pct",
    ],
    3: [
      "leadership_and_management.registered_members_male",
      "leadership_and_management.registered_members_female",
      "leadership_and_management.active_members_male",
      "leadership_and_management.active_members_female",
      "leadership_and_management.active_members_youth_17_under",
      "leadership_and_management.active_members_18_25",
      "leadership_and_management.active_members_26_35",
      "leadership_and_management.active_members_36_60",
      "leadership_and_management.active_members_61_plus",
      "leadership_and_management.dormant_members_male",
      "leadership_and_management.dormant_members_female",
    ],
    4: [
      "leadership_and_management.management_tools",
      "leadership_and_management.governance_tools",
    ],
    5: [
      "leadership_and_management.agm_attendance_male",
      "leadership_and_management.agm_attendance_female",
    ],
    6: [
      "leadership_and_management.financial_products.0",
      "leadership_and_management.non_financial_products.0",
    ],
    7: [
      "capitalization.share_nominal_value",
      "capitalization.share_capital_contribution_per_member",
      "capitalization.total_share_capital_male",
      "capitalization.total_share_capital_female",
      "capitalization.borrowed_funds",
      "capitalization.donations_grants",
      "capitalization.accumulated_statutory_reserves_book_value",
      "capitalization.actual_accumulated_statutory_reserves",
      "capitalization.retained_earnings",
    ],
    8: [
      "savings_portfolio.depositors_male",
      "savings_portfolio.depositors_female",
      "savings_portfolio.total_savings_male",
      "savings_portfolio.total_savings_female",
      "savings_portfolio.invested_in_bank",
      "savings_portfolio.invested_in_shares",
      "savings_portfolio.other_investments",
    ],
    9: [
      "loan_portfolio.loans_issued_male",
      "loan_portfolio.loans_issued_female",
      "loan_portfolio.loans_issued_coops",
      "loan_portfolio.value_issued_male",
      "loan_portfolio.value_issued_female",
      "loan_portfolio.value_issued_coops",
    ],
    11: [
      "periodic_financial_reporting.current_total_income",
      "periodic_financial_reporting.current_expenditure",
      "periodic_financial_reporting.current_net_income",
      "periodic_financial_reporting.total_current_assets",
      "periodic_financial_reporting.total_equity",
    ],
  };

  const handleNext = async () => {
    const fieldsToValidate = STEP_FIELDS[currentStep] || [];
    if (fieldsToValidate.length > 0) {
      const isValid = await trigger(fieldsToValidate as any);
      if (!isValid) {
        if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate([100, 50, 100]);
        }
        
        toast.error("Please fill in valid values for this step before continuing.");
        
        const firstErrorField = fieldsToValidate.find(f => {
          const parts = f.split('.');
          return parts.reduce((acc, p) => acc && (acc as any)[p], errors);
        }) || fieldsToValidate[0];
        
        if (firstErrorField) {
          const inputEl = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement | null;
          if (inputEl) {
            inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            inputEl.focus();
          } else {
            form.setFocus(firstErrorField as any);
          }
        }
        return;
      }
    }

    setCompletedSteps(prev => Array.from(new Set([...prev, STEPS[currentStep].id])));
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(curr => curr + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
    }
  };

  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  const onSubmit = async (data: FinancialQuestionnaireValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await apiClient.POST("/api/v1/cooperative/questionnaire/financial", {
        body: data as any,
      });
      if (error) throw new Error((error as any).message || "Submission failed");
      toast.success("Financial Questionnaire Saved & Ready for Submission!");
      setIsSubmittedSuccess(true);
      onComplete();
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (errors: any) => {
    console.error("Financial questionnaire validation errors:", errors);
    
    const getErrorPaths = (obj: any, prefix = ""): string[] => {
      let paths: string[] = [];
      for (const key in obj) {
        if (!obj[key]) continue;
        const currentPath = prefix ? `${prefix}.${key}` : key;
        if (obj[key].message || obj[key].type) {
          paths.push(currentPath);
        } else if (typeof obj[key] === "object") {
          paths.push(...getErrorPaths(obj[key], currentPath));
        }
      }
      return paths;
    };

    const errorPaths = getErrorPaths(errors);
    if (errorPaths.length > 0) {
      const firstErrorPath = errorPaths[0];
      
      let targetStep = 0;
      for (const stepIdxStr in STEP_FIELDS) {
        const stepIdx = Number(stepIdxStr);
        if (STEP_FIELDS[stepIdx]?.includes(firstErrorPath)) {
          targetStep = stepIdx;
          break;
        }
      }
      if (firstErrorPath.startsWith("capitalization")) targetStep = 7;
      else if (firstErrorPath.startsWith("savings_portfolio")) targetStep = 8;
      else if (firstErrorPath.startsWith("loan_portfolio")) targetStep = 9;
      else if (firstErrorPath.startsWith("other_activities_income")) targetStep = 10;
      else if (firstErrorPath.startsWith("periodic_financial_reporting")) targetStep = 11;
      else if (firstErrorPath.startsWith("qualitative_assessment")) targetStep = 12;

      setCurrentStep(targetStep);

      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([100, 50, 100]);
      }

      setTimeout(() => {
        const inputEl = document.querySelector(`[name="${firstErrorPath}"]`) as HTMLElement | null;
        if (inputEl) {
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputEl.focus();
        } else {
          form.setFocus(firstErrorPath as any);
        }
      }, 100);

      const friendlyFieldName = firstErrorPath
        .split(".")
        .pop()
        ?.replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()) || firstErrorPath;

      toast.error(
        `Please provide a valid value for "${friendlyFieldName}" in Step ${targetStep + 1} (${STEPS[targetStep].title})`
      );} else {
      toast.error("Form submission failed validation. Please check any un-filled required fields.");
    }
  };

  return (
    <WizardLayout
      title="Financial Questionnaire"
      subtitle="Complete the manual entry forms step-by-step"
      steps={STEPS}
      currentStepIndex={currentStep}
      completedSteps={completedSteps}
      totalFields={total}
      completedFields={filled}
      onStepChange={setCurrentStep}
      isSubmitting={isSubmitting}
      isEditing={!!initialData}
    >
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onError)}>
          <div className="bg-surface border border-border rounded-xl p-6 min-h-[400px]">

            {/* STEP 1: Leadership & Governance */}
            {currentStep === 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Board & Committees Composition">
                  <WizardRow>
                    <InputField label="Board Members (Male)" name="leadership_and_management.board_members_male" />
                    <InputField label="Board Members (Female)" name="leadership_and_management.board_members_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Exec Committee (Male)" name="leadership_and_management.exec_committee_male" />
                    <InputField label="Exec Committee (Female)" name="leadership_and_management.exec_committee_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Credit Committee (Male)" name="leadership_and_management.credit_committee_male" />
                    <InputField label="Credit Committee (Female)" name="leadership_and_management.credit_committee_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Education Committee (Male)" name="leadership_and_management.education_committee_male" />
                    <InputField label="Education Committee (Female)" name="leadership_and_management.education_committee_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Supervisory Committee (Male)" name="leadership_and_management.supervisory_committee_male" />
                    <InputField label="Supervisory Committee (Female)" name="leadership_and_management.supervisory_committee_female" />
                  </WizardRow>
                </WizardSection>

                <WizardSection title="Executive Committee Education">
                  <WizardRow>
                    <InputField type="text" label="Chairperson Education Level" name="leadership_and_management.chair_education" />
                    <InputField type="text" label="Vice Chairperson Education Level" name="leadership_and_management.vice_chair_education" />
                    <InputField type="text" label="Treasurer Education Level" name="leadership_and_management.treasurer_education" />
                    <InputField type="text" label="Secretary Education Level" name="leadership_and_management.secretary_education" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 2: Staff Composition & Profile */}
            {currentStep === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Staff Composition & Management Profile">
                  <WizardRow>
                    <InputField label="Manager / CEO / GM (Male)" name="leadership_and_management.staff_manager_male" />
                    <InputField label="Manager / CEO / GM (Female)" name="leadership_and_management.staff_manager_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Ass. Manager (Male)" name="leadership_and_management.staff_ass_manager_male" />
                    <InputField label="Ass. Manager (Female)" name="leadership_and_management.staff_ass_manager_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Accountant / Bookkeeper (Male)" name="leadership_and_management.staff_acc_male" />
                    <InputField label="Accountant / Bookkeeper (Female)" name="leadership_and_management.staff_acc_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Other Mgmt Level Staff (Male)" name="leadership_and_management.staff_other_mgmt_male" />
                    <InputField label="Other Mgmt Level Staff (Female)" name="leadership_and_management.staff_other_mgmt_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Other Support / Contract Staff (Male)" name="leadership_and_management.staff_support_male" />
                    <InputField label="Other Support / Contract Staff (Female)" name="leadership_and_management.staff_support_female" />
                  </WizardRow>
                  <WizardRow>
                    <SelectField
                      label="Manager Academic Level"
                      name="leadership_and_management.manager_academic_level"
                      options={["None", "Informal", "Primary", "Secondary", "Tertiary"]}
                    />
                    <InputField type="text" label="Manager Co-op Training Level (e.g. Accounting, Admin)" name="leadership_and_management.manager_coop_training_level" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 3: Member & Staff Training */}
            {currentStep === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Member & Staff Training">
                  <WizardRow>
                    <InputField label="Members Trained Last Year" name="leadership_and_management.members_trained_last_year" />
                    <InputField label="Leaders Trained Last Year" name="leadership_and_management.leaders_trained_last_year" />
                    <InputField label="Staff Trained Last Year" name="leadership_and_management.staff_trained_last_year" />
                  </WizardRow>
                  <RadioGroup
                    label="Who sponsored most of these trainings?"
                    name="leadership_and_management.training_sponsor"
                    options={["SACCO", "The Government", "Apex", "Others specify"]}
                  />
                  <RadioGroup
                    label="Rate overall quality of training provided"
                    name="leadership_and_management.training_quality_rating"
                    options={["Very Good", "Good", "Fair", "Poor", "Very Poor"]}
                  />
                  <InputField label="Cost Covered by SACCO (%)" name="leadership_and_management.willing_to_cover_training_cost_pct" />
                </WizardSection>
              </div>
            )}

            {/* STEP 4: Membership & Demographics */}
            {currentStep === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="SACCO Membership & Demographics">
                  <WizardRow>
                    <InputField label="Registered Members (Male)" name="leadership_and_management.registered_members_male" />
                    <InputField label="Registered Members (Female)" name="leadership_and_management.registered_members_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Active Members (Male)" name="leadership_and_management.active_members_male" />
                    <InputField label="Active Members (Female)" name="leadership_and_management.active_members_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Active Members (Youth ≤17)" name="leadership_and_management.active_members_youth_17_under" />
                    <InputField label="Active Members (18-25 yrs)" name="leadership_and_management.active_members_18_25" />
                    <InputField label="Active Members (26-35 yrs)" name="leadership_and_management.active_members_26_35" />
                    <InputField label="Active Members (36-60 yrs)" name="leadership_and_management.active_members_36_60" />
                    <InputField label="Active Members (61+ yrs)" name="leadership_and_management.active_members_61_plus" />
                  </WizardRow>
                  <WizardRow>
                    <SelectField
                      label="Society Status"
                      name="leadership_and_management.society_status"
                      options={["Active", "Dormant", "New", "Under Liquidation"]}
                    />
                    <InputField label="Dormant Members (Male)" name="leadership_and_management.dormant_members_male" />
                    <InputField label="Dormant Members (Female)" name="leadership_and_management.dormant_members_female" />
                  </WizardRow>
                  <div className="mt-4 space-y-4">
                    <CheckboxGroup
                      label="Three Major Reasons for Member Dormancy / Dropout"
                      name="leadership_and_management.dormancy_reasons"
                      options={[
                        "Loan default",
                        "Lack of commitment and vision",
                        "Lack of patience",
                        "Conflict between members",
                        "Lack of minimum requirements",
                        "Shifted to other areas",
                        "Joined other SACCO.",
                        "Others specify",
                      ]}
                    />
                    <RadioGroup
                      label="Main Effect of Member Dormancy / Dropout"
                      name="leadership_and_management.dormancy_effect"
                      options={[
                        "Had no effect",
                        "Negative public image for SACCO",
                        "Deprived SACCO of good membership",
                        "Reduced business performance",
                        "Other (specify)",
                      ]}
                    />
                  </div>
                </WizardSection>
              </div>
            )}

            {/* STEP 5: Management & Governance Tools */}
            {currentStep === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Management & Governance Tools">
                  <CheckboxGroup
                    label="Management Tools in Place (Tick all that apply)"
                    name="leadership_and_management.management_tools"
                    options={[
                      "Business plan",
                      "Accounting manual",
                      "Operational manual",
                      "Credit policy",
                      "Audit/Inspection manual",
                      "Human resource plan",
                      "Strategic Plan",
                      "Cash Flow Statement",
                      "Operating Budget",
                      "Others (specify)",
                    ]}
                  />
                  <div className="mt-4">
                    <CheckboxGroup
                      label="Governance Tools in Place (Tick all that apply)"
                      name="leadership_and_management.governance_tools"
                      options={[
                        "Bylaws",
                        "Committee manual",
                        "Cooperative Act",
                        "CCD's orders",
                        "Others (specify)",
                      ]}
                    />
                  </div>
                </WizardSection>
              </div>
            )}

            {/* STEP 6: AGM Compliance & Audit Compliance */}
            {currentStep === 5 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="AGM Compliance & Audit Compliance">
                  <WizardRow>
                    <InputField label="AGM Arrears (Months)" name="leadership_and_management.agm_arrears_months" />
                    <InputField label="AGM Attendance (Male)" name="leadership_and_management.agm_attendance_male" />
                    <InputField label="AGM Attendance (Female)" name="leadership_and_management.agm_attendance_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField type="text" label="Date of Last Audit (YYYY-MM-DD)" name="leadership_and_management.last_audit_date" />
                    <InputField type="text" label="Date of Last Inspection (YYYY-MM-DD)" name="leadership_and_management.last_inspection_date" />
                    <InputField type="text" label="Date of Last Mgmt Report (YYYY-MM-DD)" name="leadership_and_management.last_mgmt_report_date" />
                  </WizardRow>
                  <WizardRow>
                    <InputField type="text" label="Date of Last Budget (YYYY-MM-DD)" name="leadership_and_management.last_budget_date" />
                    <InputField type="text" label="Date of Last Committee Profile" name="leadership_and_management.last_committee_profile_date" />
                    <InputField type="text" label="Name of Last Audit Firm" name="leadership_and_management.last_audit_firm" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 7: Products & Services */}
            {currentStep === 6 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Financial & Non-Financial Products / Services">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Financial Services / Products Provided (Specify up to 5)</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField type="text" label="Financial Product 1" name="leadership_and_management.financial_products.0" />
                        <InputField type="text" label="Financial Product 2" name="leadership_and_management.financial_products.1" />
                        <InputField type="text" label="Financial Product 3" name="leadership_and_management.financial_products.2" />
                        <InputField type="text" label="Financial Product 4" name="leadership_and_management.financial_products.3" />
                        <InputField type="text" label="Financial Product 5" name="leadership_and_management.financial_products.4" />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <label className="block text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Non-Financial Services / Products Provided (Specify up to 5)</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InputField type="text" label="Non-Financial Product 1" name="leadership_and_management.non_financial_products.0" />
                        <InputField type="text" label="Non-Financial Product 2" name="leadership_and_management.non_financial_products.1" />
                        <InputField type="text" label="Non-Financial Product 3" name="leadership_and_management.non_financial_products.2" />
                        <InputField type="text" label="Non-Financial Product 4" name="leadership_and_management.non_financial_products.3" />
                        <InputField type="text" label="Non-Financial Product 5" name="leadership_and_management.non_financial_products.4" />
                      </div>
                    </div>
                  </div>
                </WizardSection>
              </div>
            )}

            {/* STEP 8: Capitalization */}
            {currentStep === 7 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Share Capital">
                  <WizardRow>
                    <InputField label="Nominal Value per Share (E)" name="capitalization.share_nominal_value" />
                    <InputField label="Expected Contribution per Member (E)" name="capitalization.share_capital_contribution_per_member" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Total Share Capital (Male)" name="capitalization.total_share_capital_male" />
                    <InputField label="Total Share Capital (Female)" name="capitalization.total_share_capital_female" />
                  </WizardRow>
                </WizardSection>

                <WizardSection title="Reserves & Earnings">
                  <WizardRow>
                    <InputField label="Accumulated Statutory Reserves (Book Value)" name="capitalization.accumulated_statutory_reserves_book_value" />
                    <InputField label="Actual Accumulated Statutory Reserves" name="capitalization.actual_accumulated_statutory_reserves" />
                    <InputField label="Retained Earnings" name="capitalization.retained_earnings" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 9: Savings Portfolio */}
            {currentStep === 8 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Depositors">
                  <WizardRow>
                    <InputField label="Number of Depositors (Male)" name="savings_portfolio.depositors_male" />
                    <InputField label="Number of Depositors (Female)" name="savings_portfolio.depositors_female" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Total Net Savings Value (Male)" name="savings_portfolio.total_savings_male" />
                    <InputField label="Total Net Savings Value (Female)" name="savings_portfolio.total_savings_female" />
                  </WizardRow>
                </WizardSection>

                <WizardSection title="Investments">
                  <WizardRow>
                    <InputField label="Invested in Bank (E)" name="savings_portfolio.invested_in_bank" />
                    <InputField label="Invested in Shares (E)" name="savings_portfolio.invested_in_shares" />
                    <InputField label="Other Investments (E)" name="savings_portfolio.other_investments" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 10: Loan Portfolio */}
            {currentStep === 9 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Loan Issuance">
                  <WizardRow>
                    <InputField label="Loans Issued (Male)" name="loan_portfolio.loans_issued_male" />
                    <InputField label="Loans Issued (Female)" name="loan_portfolio.loans_issued_female" />
                    <InputField label="Loans Issued (Coops)" name="loan_portfolio.loans_issued_coops" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Value Issued (Male)" name="loan_portfolio.value_issued_male" />
                    <InputField label="Value Issued (Female)" name="loan_portfolio.value_issued_female" />
                    <InputField label="Value Issued (Coops)" name="loan_portfolio.value_issued_coops" />
                  </WizardRow>
                </WizardSection>

                <WizardSection title="Outstanding Accounts">
                  <WizardRow>
                    <InputField label="Outstanding Acc (Male)" name="loan_portfolio.outstanding_accounts_male" />
                    <InputField label="Outstanding Acc (Female)" name="loan_portfolio.outstanding_accounts_female" />
                    <InputField label="Outstanding Acc (Coops)" name="loan_portfolio.outstanding_accounts_coops" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Outstanding Value (Male)" name="loan_portfolio.outstanding_value_male" />
                    <InputField label="Outstanding Value (Female)" name="loan_portfolio.outstanding_value_female" />
                    <InputField label="Outstanding Value (Coops)" name="loan_portfolio.outstanding_value_coops" />
                  </WizardRow>
                </WizardSection>

                <WizardSection title="Delinquency & Provisions">
                  <WizardRow>
                    <InputField label="Delinquent Value (0-30 days)" name="loan_portfolio.delinquent_value_0_30_days" />
                    <InputField label="Delinquent Value (31-365 days)" name="loan_portfolio.delinquent_value_31_365_days" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Provision (0-30 days)" name="loan_portfolio.provision_0_30_days" />
                    <InputField label="Provision (31-365 days)" name="loan_portfolio.provision_31_365_days" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Written Off Value" name="loan_portfolio.written_off_value" />
                    <InputField label="Recovered Loans (12 months)" name="loan_portfolio.recovered_loans_12_months" />
                  </WizardRow>
                </WizardSection>

                <WizardSection title="Fees & Interest Rates">
                  <WizardRow>
                    <InputField label="Average Loan Term (Months)" name="loan_portfolio.average_loan_term_months" />
                    <InputField label="Average Interest Rate (%)" name="loan_portfolio.average_interest_rate_pct" />
                    <InputField type="text" label="Interest Rate Method" name="loan_portfolio.interest_rate_method" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Fees: Stationery" name="loan_portfolio.fees_stationery" />
                    <InputField label="Fees: Application" name="loan_portfolio.fees_application" />
                    <InputField label="Fees: Loan Protection" name="loan_portfolio.fees_loan_protection" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Fees: Penalties" name="loan_portfolio.fees_penalties" />
                    <InputField label="Fees: Others" name="loan_portfolio.fees_others" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 11: Other Activities Income */}
            {currentStep === 10 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Additional Income Streams">
                  <WizardRow>
                    <InputField type="text" label="Primary Other Activity Name" name="other_activities_income.0.activity_name" />
                    <InputField label="Annual Income (E)" name="other_activities_income.0.annual_income" />
                    <InputField label="Annual Expenditure (E)" name="other_activities_income.0.annual_expenditure" />
                    <InputField label="Net Profit (E)" name="other_activities_income.0.net_profit" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 12: Periodic Financial Reporting */}
            {currentStep === 11 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Income & Expenditure">
                  <WizardRow>
                    <InputField label="Current Total Income" name="periodic_financial_reporting.current_total_income" />
                    <InputField label="Current Expenditure" name="periodic_financial_reporting.current_expenditure" />
                    <InputField label="Current Net Income" name="periodic_financial_reporting.current_net_income" />
                  </WizardRow>
                </WizardSection>

                <WizardSection title="Balance Sheet Items">
                  <WizardRow>
                    <InputField label="Total Current Assets" name="periodic_financial_reporting.total_current_assets" />
                    <InputField label="Non-Current Assets" name="periodic_financial_reporting.non_current_assets" />
                    <InputField label="Total Equity" name="periodic_financial_reporting.total_equity" />
                  </WizardRow>
                  <WizardRow>
                    <InputField label="Current Liabilities" name="periodic_financial_reporting.current_liabilities" />
                    <InputField label="Long-Term Liabilities" name="periodic_financial_reporting.long_term_liabilities" />
                  </WizardRow>
                </WizardSection>
              </div>
            )}

            {/* STEP 13: Qualitative Assessment */}
            {currentStep === 12 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <WizardSection title="Qualitative Feedback & Assessment">
                  <div className="space-y-4">
                    <CheckboxGroup
                      label="Key Competitor Advantages"
                      name="qualitative_assessment.competitor_advantages"
                      options={[
                        "Better interest rates",
                        "Faster loan processing",
                        "Less collateral required",
                        "Digital/mobile services",
                        "Better marketing",
                      ]}
                    />
                    <CheckboxGroup
                      label="Key Factors for Success"
                      name="qualitative_assessment.success_reasons"
                      options={[
                        "Strong leadership",
                        "High member participation",
                        "Good financial management",
                        "Diverse product offerings",
                        "Effective training",
                      ]}
                    />
                    <CheckboxGroup
                      label="Key Challenges & Obstacles"
                      name="qualitative_assessment.failure_challenges"
                      options={[
                        "High loan delinquency",
                        "Lack of capital",
                        "Low member engagement",
                        "Staff turnover",
                        "Market competition",
                      ]}
                    />
                    <CheckboxGroup
                      label="Strategic Recommendations"
                      name="qualitative_assessment.recommendations"
                      options={[
                        "Increase member training",
                        "Adopt digital banking",
                        "Improve credit appraisal",
                        "Expand product line",
                        "Strengthen governance",
                      ]}
                    />
                    <TextAreaField
                      label="Respondent Comments / General Remarks"
                      name="qualitative_assessment.respondent_comments"
                    />
                  </div>
                </WizardSection>
              </div>
            )}

          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <ArrowLeft className="size-4" /> Previous
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Continue <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-2 text-sm font-semibold text-success-foreground hover:bg-success/90 shadow-sm transition-colors"
              >
                {initialData ? "Save Changes" : "Save & Mark Ready for Submission"}
              </button>
            )}
          </div>
        </form>
      </FormProvider>
    </WizardLayout>
  );
};
