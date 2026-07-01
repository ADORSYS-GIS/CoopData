import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function UsersLayout() {
  return (
    <ProtectedRoute allowedRoles={["ministry", "federation", "apex"]}>
      <Outlet />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/users")({
  component: UsersLayout,
});
