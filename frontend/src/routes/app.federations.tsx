import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { FederationsPage } from "@/pages/ministry/FederationsPage";

export const Route = createFileRoute("/app/federations")({
  beforeLoad: async () => {
    console.log("[app.federations] beforeLoad called");
    await requireRole("ministry");
    console.log("[app.federations] requireRole passed");
  },
  component: FederationsPage,
});
