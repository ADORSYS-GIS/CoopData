import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SubmissionDetailPage } from "@/pages/shared/SubmissionDetailPage";

function SubmissionDetailRoute() {
  return (
    <ProtectedRoute>
      <SubmissionDetailPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/submissions_/$id")({
  component: SubmissionDetailRoute,
});
