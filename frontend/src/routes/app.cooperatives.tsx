import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { CooperativesPage } from "@/pages/apex/CooperativesPage";

export const Route = createFileRoute("/app/cooperatives")({
  beforeLoad: async () => {
    await requireRole("apex");
  },
  component: CooperativesPage,
});
