import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { SubmissionsPage } from "@/pages/shared/SubmissionsPage";

export const Route = createFileRoute("/app/submissions")({
  beforeLoad: async () => {
    await requireRole("ministry");
  },
  component: SubmissionsPage,
});
