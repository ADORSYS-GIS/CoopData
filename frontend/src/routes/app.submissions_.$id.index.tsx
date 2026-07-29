import { createFileRoute } from "@tanstack/react-router";
import { SubmissionDetailPage } from "@/pages/shared/SubmissionDetailPage";

export const Route = createFileRoute("/app/submissions_/$id/")({
  component: SubmissionDetailPage,
});
