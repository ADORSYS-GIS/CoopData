import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { NonFinancialDataPage } from "@/pages/cooperative/NonFinancialDataPage";

export const Route = createFileRoute("/app/non-financial-data")({
  beforeLoad: async () => {
    await requireRole("cooperative");
  },
  component: NonFinancialDataPage,
});
