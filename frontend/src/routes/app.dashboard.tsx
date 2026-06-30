import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { DashboardPage } from "@/pages/shared/DashboardPage";

export const Route = createFileRoute("/app/dashboard")({
  beforeLoad: () => {
    requireAuth();
  },
  component: DashboardPage,
});
