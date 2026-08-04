import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface NfFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldConfig[];
  defaultValues: Record<string, string | undefined>;
  onSubmit: (values: Record<string, string | undefined>) => Promise<void>;
}

export function NfFormDialog({
  open,
  onOpenChange,
  title,
  fields,
  defaultValues,
  onSubmit,
}: NfFormDialogProps) {
  const { t } = useTranslation();
  const shape: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {};
  for (const f of fields) {
    if (f.required) {
      shape[f.name] = z.string().min(1, t("nf.requiredError", { field: f.label }));
    } else {
      shape[f.name] = z.string().optional();
    }
  }
  const schema = z.object(shape);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleSubmit = async (values: Record<string, string | undefined>) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {fields.map((field) => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name}
                render={({ field: rf }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </FormLabel>
                    <FormControl>
                      {field.type === "select" && field.options ? (
                        <Select value={rf.value} onValueChange={rf.onChange}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue
                              placeholder={t("nf.selectLabel", { label: field.label })}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={
                            field.type === "date"
                              ? "date"
                              : field.type === "number"
                                ? "number"
                                : "text"
                          }
                          step={field.type === "number" ? "0.01" : undefined}
                          className="h-8 text-xs"
                          {...rf}
                          value={rf.value ?? ""}
                        />
                      )}
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="size-3.5 animate-spin mr-1" />}
                {t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function buildMemberFields(t: TFunction): FieldConfig[] {
  return [
    { name: "member_id", label: t("columns.memberId"), type: "text", required: true },
    { name: "join_date", label: t("columns.joinDate"), type: "date", required: true },
    {
      name: "status",
      label: t("columns.status"),
      type: "select",
      required: true,
      options: [
        { value: "Active", label: t("nf.statusActive") },
        { value: "Dormant", label: t("nf.statusDormant") },
        { value: "Exited", label: t("nf.statusExited") },
      ],
    },
    { name: "exit_date", label: t("nf.exitDate"), type: "date" },
    {
      name: "gender",
      label: t("columns.gender"),
      type: "select",
      required: true,
      options: [
        { value: "Male", label: t("nf.genderMale") },
        { value: "Female", label: t("nf.genderFemale") },
        { value: "Other", label: t("nf.genderOther") },
      ],
    },
    {
      name: "age_group",
      label: t("columns.ageGroup"),
      type: "select",
      required: true,
      options: [
        { value: "<18", label: "<18" },
        { value: "18-35", label: "18-35" },
        { value: "36-50", label: "36-50" },
        { value: "50+", label: "50+" },
      ],
    },
    {
      name: "region",
      label: t("columns.region"),
      type: "select",
      required: true,
      options: [
        { value: "Hhohho", label: "Hhohho" },
        { value: "Manzini", label: "Manzini" },
        { value: "Shiselweni", label: "Shiselweni" },
        { value: "Lubombo", label: "Lubombo" },
      ],
    },
    {
      name: "urban_rural",
      label: t("columns.urbanRural"),
      type: "select",
      required: true,
      options: [
        { value: "Urban", label: t("nf.urban") },
        { value: "Rural", label: t("nf.rural") },
      ],
    },
    { name: "leadership_role", label: t("nf.leadershipRole"), type: "text" },
  ];
}

export function buildSavingsFields(t: TFunction): FieldConfig[] {
  return [
    { name: "savings_account_id", label: t("columns.accountId"), type: "text", required: true },
    { name: "member_id", label: t("columns.memberId"), type: "text", required: true },
    {
      name: "account_type",
      label: t("nf.accountType"),
      type: "select",
      required: true,
      options: [
        { value: "Voluntary", label: t("nf.typeVoluntary") },
        { value: "Mandatory", label: t("nf.typeMandatory") },
        { value: "Fixed", label: t("nf.typeFixed") },
      ],
    },
    {
      name: "account_opening_date",
      label: t("columns.openingDate"),
      type: "date",
      required: true,
    },
    { name: "account_status", label: t("nf.accountStatus"), type: "text" },
    { name: "contribution_frequency", label: t("nf.contributionFrequency"), type: "text" },
    { name: "last_contribution_date", label: t("nf.lastContributionDate"), type: "date" },
    { name: "number_of_contributions", label: t("columns.contributions"), type: "number" },
    { name: "balance_trend", label: t("nf.balanceTrend"), type: "text" },
    { name: "interest_rate", label: t("nf.interestRatePercent"), type: "number" },
    { name: "balance", label: t("columns.balance"), type: "number", required: true },
  ];
}

export function buildLoanFields(t: TFunction): FieldConfig[] {
  return [
    { name: "loan_id", label: t("columns.loanId"), type: "text", required: true },
    { name: "member_id", label: t("columns.memberId"), type: "text", required: true },
    { name: "loan_product_type", label: t("columns.productType"), type: "text", required: true },
    { name: "loan_start_date", label: t("columns.startDate"), type: "date", required: true },
    { name: "loan_maturity_date", label: t("columns.maturityDate"), type: "date", required: true },
    {
      name: "loan_status",
      label: t("columns.status"),
      type: "select",
      required: true,
      options: [
        { value: "Performing", label: t("nf.performing") },
        { value: "Arrears", label: t("nf.arrears") },
        { value: "Restructured", label: t("nf.restructured") },
        { value: "WrittenOff", label: t("nf.writtenOff") },
      ],
    },
    { name: "borrower_type", label: t("nf.borrowerType"), type: "text" },
    {
      name: "days_past_due_category",
      label: t("nf.dpdCategory"),
      type: "select",
      options: [
        { value: "0", label: "0" },
        { value: "1-30", label: "1-30" },
        { value: "31-60", label: "31-60" },
        { value: "61-90", label: "61-90" },
        { value: "91+", label: "91+" },
      ],
    },
    { name: "repayment_regularity", label: t("nf.repaymentRegularity"), type: "text" },
    { name: "interest_rate", label: t("nf.interestRatePercent"), type: "number" },
    { name: "balance", label: t("columns.balance"), type: "number", required: true },
    { name: "loan_amount", label: t("columns.loanAmount"), type: "number", required: true },
  ];
}

export function buildFdFields(t: TFunction): FieldConfig[] {
  return [
    { name: "fixed_deposit_id", label: t("columns.fdId"), type: "text", required: true },
    { name: "member_id", label: t("columns.memberId"), type: "text", required: true },
    { name: "deposit_type", label: t("columns.depositType"), type: "text", required: true },
    { name: "start_date", label: t("columns.startDate"), type: "date", required: true },
    { name: "maturity_date", label: t("columns.maturityDate"), type: "date", required: true },
    {
      name: "status",
      label: t("columns.status"),
      type: "select",
      required: true,
      options: [
        { value: "Active", label: t("nf.statusActive") },
        { value: "Matured", label: t("nf.matured") },
        { value: "Withdrawn", label: t("nf.withdrawn") },
        { value: "RolledOver", label: t("nf.rolledOver") },
      ],
    },
    { name: "tenure_category", label: t("nf.tenureCategory"), type: "text" },
    { name: "original_tenure_selected", label: t("nf.originalTenure"), type: "text" },
    { name: "number_of_renewals", label: t("columns.renewals"), type: "number" },
    { name: "interest_rate", label: t("nf.interestRatePercent"), type: "number" },
    { name: "balance", label: t("columns.balance"), type: "number", required: true },
  ];
}
