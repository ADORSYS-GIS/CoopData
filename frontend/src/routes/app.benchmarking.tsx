import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BenchmarkingPage } from "@/pages/shared/BenchmarkingPage";

function BenchmarkingRoute() {
  return (
    <ProtectedRoute allowedRoles={["ministry", "federation", "apex"]}>
      <BenchmarkingPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/benchmarking")({
  component: BenchmarkingRoute,
});
