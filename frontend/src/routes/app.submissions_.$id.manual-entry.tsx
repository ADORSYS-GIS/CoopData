import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ManualEntryWizard } from "@/pages/cooperative/ManualEntryWizard";
import { z } from "zod";

const manualEntrySearchSchema = z.object({
  step: z.enum(["financial", "members", "review"]).optional(),
});

function ManualEntryRoute() {
  return (
    <ProtectedRoute>
      <ManualEntryWizard />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/submissions_/$id/manual-entry")({
  validateSearch: (search) => manualEntrySearchSchema.parse(search),
  component: ManualEntryRoute,
});
