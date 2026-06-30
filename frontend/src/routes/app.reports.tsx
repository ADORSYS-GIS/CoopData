import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { ReportsPage } from "@/pages/shared/ReportsPage";

export const Route = createFileRoute("/app/reports")({
  beforeLoad: () => {
    requireAuth();
  },
  component: ReportsPage,
});
