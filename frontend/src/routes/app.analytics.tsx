import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { AnalyticsPage } from "@/pages/shared/AnalyticsPage";

export const Route = createFileRoute("/app/analytics")({
  beforeLoad: () => {
    requireAuth();
  },
  component: AnalyticsPage,
});
