import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const shape: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {};
  for (const f of fields) {
    if (f.required) {
      shape[f.name] = z.string().min(1, `${f.label} is required`);
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
                      {field.required && (
                        <span className="text-destructive ml-0.5">*</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      {field.type === "select" && field.options ? (
                        <Select
                          value={rf.value}
                          onValueChange={rf.onChange}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={`Select ${field.label}`} />
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
                          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                )}
                Save
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export const MEMBER_FIELDS: FieldConfig[] = [
  { name: "member_id", label: "Member ID", type: "text", required: true },
  { name: "join_date", label: "Join Date", type: "date", required: true },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { value: "Active", label: "Active" },
      { value: "Dormant", label: "Dormant" },
      { value: "Exited", label: "Exited" },
    ],
  },
  { name: "exit_date", label: "Exit Date", type: "date" },
  {
    name: "gender",
    label: "Gender",
    type: "select",
    required: true,
    options: [
      { value: "Male", label: "Male" },
      { value: "Female", label: "Female" },
      { value: "Other", label: "Other" },
    ],
  },
  {
    name: "age_group",
    label: "Age Group",
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
    label: "Region",
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
    label: "Urban/Rural",
    type: "select",
    required: true,
    options: [
      { value: "Urban", label: "Urban" },
      { value: "Rural", label: "Rural" },
    ],
  },
  { name: "leadership_role", label: "Leadership Role", type: "text" },
];

export const SAVINGS_FIELDS: FieldConfig[] = [
  { name: "savings_account_id", label: "Account ID", type: "text", required: true },
  { name: "member_id", label: "Member ID", type: "text", required: true },
  {
    name: "account_type",
    label: "Account Type",
    type: "select",
    required: true,
    options: [
      { value: "Voluntary", label: "Voluntary" },
      { value: "Mandatory", label: "Mandatory" },
      { value: "Fixed", label: "Fixed" },
    ],
  },
  { name: "account_opening_date", label: "Opening Date", type: "date", required: true },
  { name: "account_status", label: "Account Status", type: "text" },
  { name: "contribution_frequency", label: "Contribution Frequency", type: "text" },
  { name: "last_contribution_date", label: "Last Contribution Date", type: "date" },
  { name: "number_of_contributions", label: "Contributions", type: "number" },
  { name: "balance_trend", label: "Balance Trend", type: "text" },
  { name: "interest_rate", label: "Interest Rate (%)", type: "number" },
  { name: "balance", label: "Balance", type: "number", required: true },
];

export const LOAN_FIELDS: FieldConfig[] = [
  { name: "loan_id", label: "Loan ID", type: "text", required: true },
  { name: "member_id", label: "Member ID", type: "text", required: true },
  { name: "loan_product_type", label: "Product Type", type: "text", required: true },
  { name: "loan_start_date", label: "Start Date", type: "date", required: true },
  { name: "loan_maturity_date", label: "Maturity Date", type: "date", required: true },
  {
    name: "loan_status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { value: "Performing", label: "Performing" },
      { value: "Arrears", label: "Arrears" },
      { value: "Restructured", label: "Restructured" },
      { value: "WrittenOff", label: "Written Off" },
    ],
  },
  { name: "borrower_type", label: "Borrower Type", type: "text" },
  {
    name: "days_past_due_category",
    label: "DPD Category",
    type: "select",
    options: [
      { value: "0", label: "0" },
      { value: "1-30", label: "1-30" },
      { value: "31-60", label: "31-60" },
      { value: "61-90", label: "61-90" },
      { value: "91+", label: "91+" },
    ],
  },
  { name: "repayment_regularity", label: "Repayment Regularity", type: "text" },
  { name: "interest_rate", label: "Interest Rate (%)", type: "number" },
  { name: "balance", label: "Balance", type: "number", required: true },
  { name: "loan_amount", label: "Loan Amount", type: "number", required: true },
];

export const FD_FIELDS: FieldConfig[] = [
  { name: "fixed_deposit_id", label: "FD ID", type: "text", required: true },
  { name: "member_id", label: "Member ID", type: "text", required: true },
  { name: "deposit_type", label: "Deposit Type", type: "text", required: true },
  { name: "start_date", label: "Start Date", type: "date", required: true },
  { name: "maturity_date", label: "Maturity Date", type: "date", required: true },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { value: "Active", label: "Active" },
      { value: "Matured", label: "Matured" },
      { value: "Withdrawn", label: "Withdrawn" },
      { value: "RolledOver", label: "Rolled Over" },
    ],
  },
  { name: "tenure_category", label: "Tenure Category", type: "text" },
  { name: "original_tenure_selected", label: "Original Tenure", type: "text" },
  { name: "number_of_renewals", label: "Renewals", type: "number" },
  { name: "interest_rate", label: "Interest Rate (%)", type: "number" },
  { name: "balance", label: "Balance", type: "number", required: true },
];
