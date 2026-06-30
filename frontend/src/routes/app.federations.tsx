import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { FederationsPage } from "@/pages/ministry/FederationsPage";

export const Route = createFileRoute("/app/federations")({
  beforeLoad: () => {
    requireRole("ministry");
  },
  component: FederationsPage,
});
