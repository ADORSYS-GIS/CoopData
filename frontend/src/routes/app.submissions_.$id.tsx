import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function SubmissionDetailLayout() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/submissions_/$id")({
  component: SubmissionDetailLayout,
});
