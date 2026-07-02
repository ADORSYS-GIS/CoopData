import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DataCollectionPage } from "@/pages/cooperative/DataCollectionPage";

function DataCollectionRoute() {
  return (
    <ProtectedRoute allowedRoles={["cooperative"]}>
      <DataCollectionPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/data-collection")({
  component: DataCollectionRoute,
});
