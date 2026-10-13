import { createFileRoute } from "@tanstack/react-router";
import { LegalCenterPage } from "@/pages/shared/LegalCenterPage";

export const Route = createFileRoute("/legal")({
  validateSearch: (search: Record<string, unknown>) => ({
    doc: typeof search.doc === "string" ? search.doc : undefined,
  }),
  component: LegalCenterPage,
});
