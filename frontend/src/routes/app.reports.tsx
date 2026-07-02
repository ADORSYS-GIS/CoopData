import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { ReportsPage } from "@/pages/shared/ReportsPage";

export const Route = createFileRoute("/app/reports")({
  beforeLoad: async () => {
    await requireRole("ministry");
  },
  component: ReportsPage,
});
