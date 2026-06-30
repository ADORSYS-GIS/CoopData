import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { SubmissionDetailPage } from "@/pages/shared/SubmissionDetailPage";

export const Route = createFileRoute("/app/submissions_/$id")({
  beforeLoad: () => {
    requireAuth();
  },
  component: SubmissionDetailPage,
});
