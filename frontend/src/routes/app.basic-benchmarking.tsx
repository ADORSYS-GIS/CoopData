import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BasicBenchmarkingPage } from "@/pages/shared/BasicBenchmarkingPage";

function BasicBenchmarkingRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry", "federation", "apex", "cooperative"]}>
      <BasicBenchmarkingPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/basic-benchmarking")({
  component: BasicBenchmarkingRoute,
});
