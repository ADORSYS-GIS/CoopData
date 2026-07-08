import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2, Save } from "lucide-react";

import {
  useCreateCooperative,
  type CreateCooperativeInput,
} from "@/hooks/cooperatives/useCooperatives";
import {
  useUpdateCooperativeProfile,
  type CooperativeProfile,
} from "@/hooks/cooperatives/useCooperativeProfile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card } from "@/components/ui/card";

const COOP_TYPES = [
  "sacco",
  "multipurpose",
  "farm",
  "housing",
  "transport",
  "finance",
  "other",
] as const;

const GEO_CLASSIF = ["Urban", "Rural"] as const;
const COOP_STATUS = ["Active", "Inactive", "Suspended"] as const;
const ACCOUNTING_YEAR = ["calendar", "fiscal"] as const;
const ESWATINI_REGIONS = ["Hhohho", "Lubombo", "Manzini", "Shiselweni"] as const;

const georeferenceRegex = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  institution_type: z.enum(COOP_TYPES),
  reg_no: z
    .string()
    .min(1, "Registration number is required")
    .max(30, "Must be 30 characters or fewer"),
  tin: z.string().max(20, "Must be 20 characters or fewer").optional().or(z.literal("")),
  address: z.string().max(255).optional().or(z.literal("")),
  georeference: z
    .string()
    .regex(georeferenceRegex, "Format: lat,long (e.g. -26.3,31.1)")
    .optional()
    .or(z.literal("")),
  region: z.enum(ESWATINI_REGIONS),
  geographic_classif: z.enum(GEO_CLASSIF),
  phone: z.string().max(30).optional().or(z.literal("")),
  sector: z.string().min(1, "Sector is required"),
  status: z.enum(COOP_STATUS),
  registered_on: z.string().min(1, "Registration date is required"),
  accounting_year: z.enum(ACCOUNTING_YEAR),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface CooperativeProfileFormProps {
  existing?: CooperativeProfile | null;
  onSuccess?: () => void;
}

export const CooperativeProfileForm: React.FC<CooperativeProfileFormProps> = ({
  existing,
  onSuccess,
}) => {
  const createMut = useCreateCooperative();
  const updateMut = useUpdateCooperativeProfile();
  const isEditing = !!existing;

  const [regNoError, setRegNoError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues, unknown, ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: existing?.name ?? "",
      institution_type: (existing?.institution_type as (typeof COOP_TYPES)[number]) ?? "sacco",
      reg_no: existing?.reg_no ?? "",
      tin: existing?.tin ?? "",
      address: existing?.address ?? "",
      georeference: existing?.georeference ?? "",
      region: (existing?.region as (typeof ESWATINI_REGIONS)[number]) ?? "Hhohho",
      geographic_classif: (existing?.geographic_classif as (typeof GEO_CLASSIF)[number]) ?? "Urban",
      phone: existing?.phone ?? "",
      sector: existing?.sector ?? "",
      status: (existing?.status as (typeof COOP_STATUS)[number]) ?? "Active",
      registered_on: existing?.registered_on ?? "",
      accounting_year:
        (existing?.accounting_year as (typeof ACCOUNTING_YEAR)[number]) ?? "calendar",
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    setRegNoError(null);
    const payload = {
      ...values,
      tin: values.tin || undefined,
      address: values.address || undefined,
      georeference: values.georeference || undefined,
      phone: values.phone || undefined,
    };

    if (isEditing && existing) {
      updateMut.mutate(
        { id: existing.id, ...payload },
        {
          onSuccess: () => {
            toast.success("Cooperative profile updated.");
            onSuccess?.();
          },
          onError: (err) => {
            const msg = String(err);
            if (msg.includes("reg_no")) {
              setRegNoError("This registration number is already in use.");
            }
            toast.error("Failed to update cooperative", { description: msg });
          },
        },
      );
    } else {
      const createPayload: CreateCooperativeInput = {
        name: payload.name,
        institution_type: payload.institution_type,
        reg_no: payload.reg_no,
        tin: payload.tin,
        address: payload.address,
        georeference: payload.georeference,
        region: payload.region,
        geographic_classif: payload.geographic_classif,
        phone: payload.phone,
        sector: payload.sector,
        status: payload.status,
        registered_on: payload.registered_on,
        accounting_year: payload.accounting_year,
      };
      createMut.mutate(createPayload, {
        onSuccess: () => {
          toast.success("Cooperative created successfully.");
          form.reset();
          onSuccess?.();
        },
        onError: (err) => {
          const msg = String(err);
          if (msg.includes("reg_no") || msg.includes("Registration number")) {
            setRegNoError("This registration number is already in use.");
          }
          toast.error("Failed to create cooperative", { description: msg });
        },
      });
    }
  };

  const isSubmitting = createMut.isPending || updateMut.isPending;

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">
          {isEditing ? "Edit Cooperative Profile" : "Register New Cooperative"}
        </h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cooperative Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Mbabane SACCO" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="institution_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COOP_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reg_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. COOP2024-001" {...field} />
                  </FormControl>
                  {regNoError && (
                    <p className="text-sm font-medium text-destructive">{regNoError}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="tin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TIN (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Tax ID number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+268 ..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address (optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Street, city, postal code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ESWATINI_REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Finance" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="geographic_classif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geographic Classification</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GEO_CLASSIF.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accounting_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accounting Year</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNTING_YEAR.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a.charAt(0).toUpperCase() + a.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="georeference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Georeference (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="lat,long (e.g. -26.3,31.1)" {...field} />
                </FormControl>
                <FormDescription>GPS coordinates as latitude,longitude</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="registered_on"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registered On</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COOP_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Update Profile" : "Create Cooperative"}
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
};
