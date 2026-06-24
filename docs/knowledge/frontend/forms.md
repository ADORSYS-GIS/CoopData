# Form Implementation Guide

> **Core Philosophy**: Forms leverage **React Hook Form** + **Zod** + **shadcn/ui** components. In our offline-first architecture, form submissions write to the local database instantly (optimistic UI), close modal windows, and register transactions to the background sync queue if the network is unavailable.

---

## 1. Schema Validation (Zod)

Define type-safe schemas outside the component. They govern field constraints, default values, and local translation error messaging.

```typescript
import { z } from "zod";

export const organizationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  domain: z.string().url("Must be a valid domain URL"),
  type: z.enum(["coop", "union"]),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
export type AddOrganizationPayload = Omit<OrganizationFormValues, "id">;
```

---

## 2. Structural Blueprint: Standard Offline-Ready Form

Implement forms using input wrapper helpers. The submit handler handles database actions and provides network-appropriate feedback.

```typescript
// File: frontend/src/components/shared/AddOrganizationForm.tsx
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { organizationFormSchema, OrganizationFormValues } from "./schemas";

interface AddOrganizationFormProps {
  onSubmit: (data: OrganizationFormValues) => void;
  isSubmitting?: boolean;
  isOffline?: boolean;
}

export const AddOrganizationForm: React.FC<AddOrganizationFormProps> = ({
  onSubmit,
  isSubmitting = false,
  isOffline = false,
}) => {
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: "",
      domain: "",
      type: "coop",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Name Field */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter organization name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Domain Field */}
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Type Select Field */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="coop">Cooperative</SelectItem>
                  <SelectItem value="union">Federation/Union</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit triggers showing loader / offline notice */}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Saving..." : isOffline ? "Save Locally" : "Submit"}
        </Button>
      </form>
    </Form>
  );
};
```

---

## 3. Integration with Mutations (Optimistic UI Writes)

When the form submits, the page invokes the corresponding mutation hook. The repository handles creating a local temp UUID, caching the form locally immediately, and returning control.

```typescript
// File: frontend/src/pages/admin/ManageOrganizationsPage.tsx
import { useCreateOrganization } from "@/hooks/organizations/useCreateOrganization";
import { useOnlineStatus } from "@/hooks/utils/useOnlineStatus";
import { AddOrganizationForm } from "@/components/shared/AddOrganizationForm";
import { toast } from "sonner";

export const ManageOrganizationsPage = () => {
  const isOffline = !useOnlineStatus();
  const { mutate, isPending } = useCreateOrganization();

  const handleFormSubmit = (data: OrganizationFormValues) => {
    mutate(data, {
      onSuccess: () => {
        toast.success(
          isOffline
            ? "Saved locally! Changes will sync once connection is restored."
            : "Organization created successfully."
        );
        setIsOpen(false); // Close dialogue instantly
      },
      onError: (err) => {
        toast.error("Failed to submit form: " + err.message);
      }
    });
  };

  return (
    <AddOrganizationForm 
      onSubmit={handleFormSubmit} 
      isSubmitting={isPending} 
      isOffline={isOffline} 
    />
  );
};
```

---

## 4. Handling Offline-Blocked Form Fields

Certain fields or entire forms cannot be processed offline (e.g. initiating key exchange or querying a remote email domain availability).

*   **Design Rule**: Detect offline status and add `disabled={isOffline}` to the fields, rendering a helpful tooltip explanation.

```tsx
<FormField
  control={form.control}
  name="externalToken"
  render={({ field }) => (
    <FormItem>
      <FormLabel className={isOffline ? "text-slate-400" : ""}>External OAuth Token</FormLabel>
      <FormControl>
        <Input 
          {...field} 
          disabled={isOffline} 
          placeholder={isOffline ? "Connection required to set token" : "Token value"} 
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## Checklist

- [ ] Form schemas are defined using Zod validation.
- [ ] UI rendering wraps controls in standard `@/components/ui/form` hooks.
- [ ] Submit buttons render dynamic messages based on connectivity (e.g. "Save Locally" vs "Submit").
- [ ] Mutations perform optimistic updates, resetting state and closing forms immediately.
- [ ] Submit buttons are disabled and show loading spinners when mutations are processing.
- [ ] Fields requiring active network connections receive `disabled={isOffline}` properties.
- [ ] Error messages use localized labels rather than hardcoded string parameters.
