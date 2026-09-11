import { createFileRoute } from "@tanstack/react-router";
import { LegalCenterPage } from "@/pages/shared/LegalCenterPage";

export const Route = createFileRoute("/legal")({
  component: LegalCenterPage,
});
