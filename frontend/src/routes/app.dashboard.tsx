import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { DashboardPage } from "@/pages/shared/DashboardPage";

export const Route = createFileRoute("/app/dashboard")({
  beforeLoad: async () => {
    await requireRole("ministry");
  },
  component: DashboardPage,
});
