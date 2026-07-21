import React, { useState } from "react";
import { useForm, useWatch, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { nonFinancialQuestionnaireSchema, NonFinancialQuestionnaireValues } from "@/schema/questionnaire";
import { WizardLayout, WizardSection, WizardRow } from "@/components/shared/WizardLayout";
import { toast } from "sonner";
import { apiClient } from "@/openapi-client";
import { ArrowRight, ArrowLeft } from "lucide-react";

const STEPS = [
  { id: "demographics", title: "Membership & Demographics", description: "Active & registered member breakdown" },
  { id: "leadership", title: "Board & Committees", description: "Committee compositions and education" },
  { id: "staffing", title: "Staffing & Governance", description: "Staff counts and meeting frequencies" },
  { id: "fees_capital", title: "Fees & Capitalization", description: "Subscriptions, share values, and reserves" },
  { id: "compliance", title: "Compliance & Audit Dates", description: "AGM attendance and last audit records" },
  { id: "empowerment", title: "Member Empowerment", description: "Training metrics and quality ratings" },
  { id: "main_activity", title: "Main Activity", description: "Performance of primary coop activity" },
  { id: "other_activity", title: "Other Activities", description: "Secondary income sources" },
  { id: "threats", title: "Main Threats", description: "Liabilities, disputes, competitors" },
  { id: "savings", title: "Savings Portfolio", description: "Depositors and investments" },
  { id: "loans", title: "Loan Portfolio", description: "Issuance, delinquency, and fees" },
  { id: "periodic", title: "Periodic Reporting", description: "Financial snapshots" },
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
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                checked
                  ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                  : "border-border bg-background hover:bg-muted/50 text-foreground"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {}}
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

export const NonFinancialQuestionnaireWizard: React.FC<{
  submissionId: string;
  onComplete: () => void;
}> = ({ submissionId, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NonFinancialQuestionnaireValues>({
    resolver: zodResolver(nonFinancialQuestionnaireSchema),
    mode: "onChange",
    defaultValues: {
      submission_id: submissionId,
      basic_data: {
        registered_members_male: 0, registered_members_female: 0,
        active_members_male: 0, active_members_female: 0,
        active_members_17_under_male: 0, active_members_17_under_female: 0,
        active_members_18_25_male: 0, active_members_18_25_female: 0,
        active_members_26_35_male: 0, active_members_26_35_female: 0,
        active_members_36_60_male: 0, active_members_36_60_female: 0,
        active_members_61_plus_male: 0, active_members_61_plus_female: 0,
        board_members_male: 0, board_members_female: 0,
        exec_committee_male: 0, exec_committee_female: 0,
        credit_committee_male: 0, credit_committee_female: 0,
        education_committee_male: 0, education_committee_female: 0,
        supervisory_committee_male: 0, supervisory_committee_female: 0,
        chair_education: "", vice_chair_education: "", treasurer_education: "", secretary_education: "",
        committee_elected_date: "", committee_oriented_date: "", agm_last_held_date: "",
        agm_attendance_male: 0, agm_attendance_female: 0,
        member_joining_fee: 0, annual_subscription_fee: 0, share_nominal_value: 0, share_capital_contribution_per_member: 0,
        total_share_capital_male: 0, total_share_capital_female: 0,
        borrowed_funds: 0, donations_grants: 0, statutory_reserve_book_value: 0, actual_statutory_reserves: 0,
        manager_gender: "", manager_academic_level: "", manager_coop_training_level: "", society_status: "",
        last_audit_date: "", last_inspection_date: "", last_mgmt_report_date: "", last_budget_date: "", last_committee_profile_date: "", last_audit_firm: "",
        staff_manager_male: 0, staff_manager_female: 0,
        staff_ass_manager_male: 0, staff_ass_manager_female: 0,
        staff_acc_male: 0, staff_acc_female: 0,
        staff_other_mgmt_male: 0, staff_other_mgmt_female: 0,
        staff_support_male: 0, staff_support_female: 0,
        committee_meeting_frequency: "", meeting_purposes: [],
      },
      member_empowerment: {
        members_trained_last_year: 0, leaders_trained_last_year: 0, staff_trained_last_year: 0,
        training_sponsor: "", training_quality_rating: "",
        member_training_needs: [], leader_training_needs: [], staff_training_needs: [],
        willing_to_cover_training_cost_pct: 0,
      },
      main_activity_performance: [],
      other_activities_income: [],
      main_threats: {
        owed_to_creditors_outsiders: 0, owed_to_creditors_members: 0, outstanding_owed_to_banks: 0,
        outstanding_owed_by_members: 0, outstanding_payments_to_members: 0,
        number_of_competitors: 0, disputes_resolved: 0, disputes_unresolved: 0,
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
      periodic_reporting: {
        report_frequencies: [],
        current_total_income: 0, last_total_income: 0,
        current_expenditure: 0, last_expenditure: 0,
        current_net_income: 0, last_net_income: 0,
        current_surplus_distr: 0, last_surplus_distr: 0,
        non_current_assets: 0, total_current_assets: 0, total_liabilities: 0, total_equity: 0,
        accumulated_reserves_book_value: 0, actual_reserves_in_bank: 0,
      },
      qualitative_assessment: {
        competitor_advantages: [], success_reasons: [], failure_challenges: [], recommendations: [], respondent_comments: "",
      }
    },
  });

  const { formState: { errors }, trigger } = form;
  const values = useWatch({ control: form.control });

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
      "basic_data.registered_members_male",
      "basic_data.registered_members_female",
      "basic_data.active_members_male",
      "basic_data.active_members_female",
      "basic_data.active_members_17_under_male",
      "basic_data.active_members_17_under_female",
      "basic_data.active_members_18_25_male",
      "basic_data.active_members_18_25_female",
      "basic_data.active_members_26_35_male",
      "basic_data.active_members_26_35_female",
      "basic_data.active_members_36_60_male",
      "basic_data.active_members_36_60_female",
      "basic_data.active_members_61_plus_male",
      "basic_data.active_members_61_plus_female",
    ],
    1: [
      "basic_data.board_members_male",
      "basic_data.board_members_female",
      "basic_data.exec_committee_male",
      "basic_data.exec_committee_female",
      "basic_data.credit_committee_male",
      "basic_data.credit_committee_female",
      "basic_data.education_committee_male",
      "basic_data.education_committee_female",
      "basic_data.supervisory_committee_male",
      "basic_data.supervisory_committee_female",
    ],
    2: [
      "basic_data.staff_manager_male",
      "basic_data.staff_manager_female",
      "basic_data.staff_ass_manager_male",
      "basic_data.staff_ass_manager_female",
      "basic_data.staff_acc_male",
      "basic_data.staff_acc_female",
      "basic_data.staff_other_mgmt_male",
      "basic_data.staff_other_mgmt_female",
      "basic_data.staff_support_male",
      "basic_data.staff_support_female",
    ],
    3: [
      "basic_data.member_joining_fee",
      "basic_data.annual_subscription_fee",
      "basic_data.share_nominal_value",
      "basic_data.share_capital_contribution_per_member",
      "basic_data.total_share_capital_male",
      "basic_data.total_share_capital_female",
      "basic_data.borrowed_funds",
      "basic_data.donations_grants",
      "basic_data.statutory_reserve_book_value",
      "basic_data.actual_statutory_reserves",
    ],
    5: [
      "member_empowerment.members_trained_last_year",
      "member_empowerment.leaders_trained_last_year",
      "member_empowerment.staff_trained_last_year",
      "member_empowerment.willing_to_cover_training_cost_pct",
    ],
    8: [
      "main_threats.owed_to_creditors_outsiders",
      "main_threats.owed_to_creditors_members",
      "main_threats.outstanding_owed_to_banks",
      "main_threats.outstanding_owed_by_members",
      "main_threats.outstanding_payments_to_members",
      "main_threats.number_of_competitors",
      "main_threats.disputes_resolved",
      "main_threats.disputes_unresolved",
    ],
    9: [
      "savings_portfolio.depositors_male",
      "savings_portfolio.depositors_female",
      "savings_portfolio.total_savings_male",
      "savings_portfolio.total_savings_female",
      "savings_portfolio.invested_in_bank",
      "savings_portfolio.invested_in_shares",
      "savings_portfolio.other_investments",
    ],
    10: [
      "loan_portfolio.loans_issued_male",
      "loan_portfolio.loans_issued_female",
      "loan_portfolio.loans_issued_coops",
    ],
    11: [
      "periodic_reporting.current_total_income",
      "periodic_reporting.current_expenditure",
      "periodic_reporting.current_net_income",
      "periodic_reporting.total_current_assets",
      "periodic_reporting.total_liabilities",
      "periodic_reporting.total_equity",
    ],
  };

  const handleNext = async () => {
    const fieldsToValidate = STEP_FIELDS[currentStep] || [];
    if (fieldsToValidate.length > 0) {
      const isValid = await trigger(fieldsToValidate as any);
      if (!isValid) {
        toast.error("Please complete the required fields in this step before continuing.");
        const firstErrorField = fieldsToValidate.find(f => {
          const parts = f.split('.');
          return parts.reduce((acc, p) => acc && (acc as any)[p], errors);
        });
        if (firstErrorField) {
          form.setFocus(firstErrorField as any);
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

  const onSubmit = async (data: NonFinancialQuestionnaireValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await apiClient.POST("/api/v1/cooperative/questionnaire/non-financial", {
        body: data as any,
      });
      if (error) throw new Error((error as any).message || "Submission failed");
      toast.success("Non-Financial Questionnaire submitted successfully");
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (errors: any) => {
    console.error("Non-financial questionnaire validation errors:", errors);

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
      if (firstErrorPath.startsWith("member_empowerment")) targetStep = 5;
      else if (firstErrorPath.startsWith("main_activity_performance")) targetStep = 6;
      else if (firstErrorPath.startsWith("other_activities_income")) targetStep = 7;
      else if (firstErrorPath.startsWith("main_threats")) targetStep = 8;
      else if (firstErrorPath.startsWith("savings_portfolio")) targetStep = 9;
      else if (firstErrorPath.startsWith("loan_portfolio")) targetStep = 10;
      else if (firstErrorPath.startsWith("periodic_reporting")) targetStep = 11;
      else if (firstErrorPath.startsWith("qualitative_assessment")) targetStep = 12;

      setCurrentStep(targetStep);

      setTimeout(() => {
        const inputEl = document.querySelector(`[name="${firstErrorPath}"]`) as HTMLElement | null;
        if (inputEl) {
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputEl.focus();
        } else {
          form.setFocus(firstErrorPath as any);
        }
      }, 100);

      toast.error(`Please fix validation error on Step ${targetStep + 1} (${STEPS[targetStep]?.title}): ${firstErrorPath}`);
    } else {
      toast.error("Form submission failed validation. Please check any un-filled required fields.");
    }
  };

  return (
    <WizardLayout
      title="Non-Financial Questionnaire"
      subtitle="Complete the manual entry operational forms step-by-step"
      steps={STEPS}
      currentStepIndex={currentStep}
      completedSteps={completedSteps}
      totalFields={total}
      completedFields={filled}
      onStepChange={setCurrentStep}
      isSubmitting={isSubmitting}
    >
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onError)}>
          <div className="bg-surface border border-border rounded-xl p-6 min-h-[400px]">
          
          {/* STEP 1: Membership & Demographics */}
          {currentStep === 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Membership Register & Age Breakdown">
                <WizardRow>
                  <InputField label="Registered Members (Male)" name="basic_data.registered_members_male" />
                  <InputField label="Registered Members (Female)" name="basic_data.registered_members_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Active Members (Male)" name="basic_data.active_members_male" />
                  <InputField label="Active Members (Female)" name="basic_data.active_members_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Active ≤17 yrs (Male)" name="basic_data.active_members_17_under_male" />
                  <InputField label="Active ≤17 yrs (Female)" name="basic_data.active_members_17_under_female" />
                  <InputField label="Active 18-25 yrs (Male)" name="basic_data.active_members_18_25_male" />
                  <InputField label="Active 18-25 yrs (Female)" name="basic_data.active_members_18_25_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Active 26-35 yrs (Male)" name="basic_data.active_members_26_35_male" />
                  <InputField label="Active 26-35 yrs (Female)" name="basic_data.active_members_26_35_female" />
                  <InputField label="Active 36-60 yrs (Male)" name="basic_data.active_members_36_60_male" />
                  <InputField label="Active 36-60 yrs (Female)" name="basic_data.active_members_36_60_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Active 61+ yrs (Male)" name="basic_data.active_members_61_plus_male" />
                  <InputField label="Active 61+ yrs (Female)" name="basic_data.active_members_61_plus_female" />
                  <InputField type="text" label="Society Status (Active, Dormant, New, Liquidation)" name="basic_data.society_status" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 2: Board & Committees */}
          {currentStep === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Board & Committees Composition">
                <WizardRow>
                  <InputField label="Board Members (Male)" name="basic_data.board_members_male" />
                  <InputField label="Board Members (Female)" name="basic_data.board_members_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Exec Committee (Male)" name="basic_data.exec_committee_male" />
                  <InputField label="Exec Committee (Female)" name="basic_data.exec_committee_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Credit Committee (Male)" name="basic_data.credit_committee_male" />
                  <InputField label="Credit Committee (Female)" name="basic_data.credit_committee_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Education Committee (Male)" name="basic_data.education_committee_male" />
                  <InputField label="Education Committee (Female)" name="basic_data.education_committee_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Supervisory Committee (Male)" name="basic_data.supervisory_committee_male" />
                  <InputField label="Supervisory Committee (Female)" name="basic_data.supervisory_committee_female" />
                </WizardRow>
                <WizardRow>
                  <InputField type="text" label="Chairperson Education" name="basic_data.chair_education" />
                  <InputField type="text" label="Vice Chairperson Education" name="basic_data.vice_chair_education" />
                  <InputField type="text" label="Treasurer Education" name="basic_data.treasurer_education" />
                  <InputField type="text" label="Secretary Education" name="basic_data.secretary_education" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 3: Staffing & Governance */}
          {currentStep === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Staffing & Governance Meetings">
                <WizardRow>
                  <InputField label="Manager / CEO (Male)" name="basic_data.staff_manager_male" />
                  <InputField label="Manager / CEO (Female)" name="basic_data.staff_manager_female" />
                  <InputField type="text" label="Manager Gender" name="basic_data.manager_gender" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Ass. Manager (Male)" name="basic_data.staff_ass_manager_male" />
                  <InputField label="Ass. Manager (Female)" name="basic_data.staff_ass_manager_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Bookkeeper (Male)" name="basic_data.staff_acc_male" />
                  <InputField label="Bookkeeper (Female)" name="basic_data.staff_acc_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Other Mgmt (Male)" name="basic_data.staff_other_mgmt_male" />
                  <InputField label="Other Mgmt (Female)" name="basic_data.staff_other_mgmt_female" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Support Staff (Male)" name="basic_data.staff_support_male" />
                  <InputField label="Support Staff (Female)" name="basic_data.staff_support_female" />
                </WizardRow>
                <WizardRow>
                  <InputField type="text" label="Manager Academic Level" name="basic_data.manager_academic_level" />
                  <InputField type="text" label="Manager Co-op Training Level" name="basic_data.manager_coop_training_level" />
                  <InputField type="text" label="Committee Meeting Frequency" name="basic_data.committee_meeting_frequency" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 4: Fees & Capitalization */}
          {currentStep === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Fees, Subscriptions & Capitalization">
                 <WizardRow>
                  <InputField label="Member Joining Fee (E)" name="basic_data.member_joining_fee" />
                  <InputField label="Annual Subscription Fee (E)" name="basic_data.annual_subscription_fee" />
                  <InputField label="Share Nominal Value (E)" name="basic_data.share_nominal_value" />
                  <InputField label="Share Contribution / Member (E)" name="basic_data.share_capital_contribution_per_member" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Total Share Capital (Male)" name="basic_data.total_share_capital_male" />
                  <InputField label="Total Share Capital (Female)" name="basic_data.total_share_capital_female" />
                  <InputField label="Borrowed Funds (E)" name="basic_data.borrowed_funds" />
                  <InputField label="Donations & Grants (E)" name="basic_data.donations_grants" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Statutory Reserve Book Value (E)" name="basic_data.statutory_reserve_book_value" />
                  <InputField label="Actual Statutory Reserves (E)" name="basic_data.actual_statutory_reserves" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 5: Compliance & Audit Dates */}
          {currentStep === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Compliance & Audit Dates">
                <WizardRow>
                  <InputField type="text" label="Committee Elected Date" name="basic_data.committee_elected_date" />
                  <InputField type="text" label="Committee Oriented Date" name="basic_data.committee_oriented_date" />
                  <InputField type="text" label="AGM Last Held Date" name="basic_data.agm_last_held_date" />
                </WizardRow>
                <WizardRow>
                  <InputField label="AGM Attendance (Male)" name="basic_data.agm_attendance_male" />
                  <InputField label="AGM Attendance (Female)" name="basic_data.agm_attendance_female" />
                </WizardRow>
                <WizardRow>
                  <InputField type="text" label="Last Audit Date" name="basic_data.last_audit_date" />
                  <InputField type="text" label="Last Inspection Date" name="basic_data.last_inspection_date" />
                  <InputField type="text" label="Last Mgmt Report Date" name="basic_data.last_mgmt_report_date" />
                </WizardRow>
                <WizardRow>
                  <InputField type="text" label="Last Budget Date" name="basic_data.last_budget_date" />
                  <InputField type="text" label="Last Committee Profile Date" name="basic_data.last_committee_profile_date" />
                  <InputField type="text" label="Last Audit Firm Name" name="basic_data.last_audit_firm" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 6: Member Empowerment */}
          {currentStep === 5 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Training Metrics">
                <WizardRow>
                  <InputField label="Members Trained Last Year" name="member_empowerment.members_trained_last_year" />
                  <InputField label="Leaders Trained Last Year" name="member_empowerment.leaders_trained_last_year" />
                  <InputField label="Staff Trained Last Year" name="member_empowerment.staff_trained_last_year" />
                </WizardRow>
                <WizardRow>
                  <InputField type="text" label="Training Sponsor" name="member_empowerment.training_sponsor" />
                  <InputField type="text" label="Training Quality Rating" name="member_empowerment.training_quality_rating" />
                  <InputField label="Willing to cover cost (%)" name="member_empowerment.willing_to_cover_training_cost_pct" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 7: Main Activity Performance */}
          {currentStep === 6 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Primary Operations">
                <WizardRow>
                  <InputField type="text" label="Main Activity Name" name="main_activity_performance.0.activity_name" />
                  <InputField type="text" label="Unit of Measure" name="main_activity_performance.0.unit_of_measure" />
                  <InputField label="Annual Output Volume" name="main_activity_performance.0.annual_output" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Total Income (E)" name="main_activity_performance.0.total_income" />
                  <InputField label="Total Expenses (E)" name="main_activity_performance.0.total_expenses" />
                  <InputField label="Net Surplus (E)" name="main_activity_performance.0.net_surplus" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 8: Other Activities Income */}
          {currentStep === 7 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Secondary Income Streams">
                <WizardRow>
                  <InputField type="text" label="Secondary Activity Name" name="other_activities_income.0.activity_name" />
                  <InputField label="Annual Income (E)" name="other_activities_income.0.annual_income" />
                  <InputField label="Annual Expenditure (E)" name="other_activities_income.0.annual_expenditure" />
                  <InputField label="Net Profit (E)" name="other_activities_income.0.net_profit" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 9: Main Threats */}
          {currentStep === 8 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Liabilities & Disputes">
                <WizardRow>
                  <InputField label="Owed to Creditors (Outsiders)" name="main_threats.owed_to_creditors_outsiders" />
                  <InputField label="Owed to Creditors (Members)" name="main_threats.owed_to_creditors_members" />
                  <InputField label="Outstanding Owed to Banks" name="main_threats.outstanding_owed_to_banks" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Outstanding Owed by Members" name="main_threats.outstanding_owed_by_members" />
                  <InputField label="Outstanding Payments to Members" name="main_threats.outstanding_payments_to_members" />
                  <InputField label="Number of Competitors" name="main_threats.number_of_competitors" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Disputes Resolved" name="main_threats.disputes_resolved" />
                  <InputField label="Disputes Unresolved" name="main_threats.disputes_unresolved" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 10: Savings Portfolio */}
          {currentStep === 9 && (
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

          {/* STEP 11: Loan Portfolio */}
          {currentStep === 10 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Loan Issuance & Delinquency">
                <WizardRow>
                  <InputField label="Loans Issued (Male)" name="loan_portfolio.loans_issued_male" />
                  <InputField label="Loans Issued (Female)" name="loan_portfolio.loans_issued_female" />
                  <InputField label="Loans Issued (Coops)" name="loan_portfolio.loans_issued_coops" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Outstanding Acc (Male)" name="loan_portfolio.outstanding_accounts_male" />
                  <InputField label="Outstanding Acc (Female)" name="loan_portfolio.outstanding_accounts_female" />
                  <InputField label="Outstanding Acc (Coops)" name="loan_portfolio.outstanding_accounts_coops" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Delinquent Value (0-30 days)" name="loan_portfolio.delinquent_value_0_30_days" />
                  <InputField label="Delinquent Value (31-365 days)" name="loan_portfolio.delinquent_value_31_365_days" />
                </WizardRow>
                <WizardRow>
                  <InputField label="Written Off Value" name="loan_portfolio.written_off_value" />
                  <InputField label="Average Loan Term (Months)" name="loan_portfolio.average_loan_term_months" />
                  <InputField type="text" label="Interest Rate Method" name="loan_portfolio.interest_rate_method" />
                </WizardRow>
              </WizardSection>
            </div>
          )}

          {/* STEP 12: Periodic Reporting */}
          {currentStep === 11 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <WizardSection title="Income & Expenditure">
                <WizardRow>
                  <InputField label="Current Total Income" name="periodic_reporting.current_total_income" />
                  <InputField label="Current Expenditure" name="periodic_reporting.current_expenditure" />
                  <InputField label="Current Net Income" name="periodic_reporting.current_net_income" />
                </WizardRow>
              </WizardSection>

              <WizardSection title="Balance Sheet Items">
                <WizardRow>
                  <InputField label="Total Current Assets" name="periodic_reporting.total_current_assets" />
                  <InputField label="Total Liabilities" name="periodic_reporting.total_liabilities" />
                  <InputField label="Total Equity" name="periodic_reporting.total_equity" />
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
              Submit Operational Questionnaire
            </button>
          )}
        </div>
        </form>
      </FormProvider>
    </WizardLayout>
  );
};
