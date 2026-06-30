import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { ApexesPage } from "@/pages/federation/ApexesPage";

export const Route = createFileRoute("/app/apexes")({
  beforeLoad: () => {
    requireRole("federation");
  },
  component: ApexesPage,
});
