import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { DataCollectionPage } from "@/pages/cooperative/DataCollectionPage";

export const Route = createFileRoute("/app/data-collection")({
  beforeLoad: () => {
    requireRole("cooperative");
  },
  component: DataCollectionPage,
});
