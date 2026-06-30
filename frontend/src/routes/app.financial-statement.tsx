import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { FinancialStatementPage } from "@/pages/cooperative/FinancialStatementPage";

export const Route = createFileRoute("/app/financial-statement")({
  beforeLoad: () => {
    requireRole("cooperative");
  },
  component: FinancialStatementPage,
});
