import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { SubmissionsPage } from "@/pages/shared/SubmissionsPage";

export const Route = createFileRoute("/app/submissions")({
  beforeLoad: () => {
    requireAuth();
  },
  component: SubmissionsPage,
});
