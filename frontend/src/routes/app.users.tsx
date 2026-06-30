import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { UsersPage } from "@/pages/shared/UsersPage";

export const Route = createFileRoute("/app/users")({
  beforeLoad: () => {
    requireRole("ministry", "federation", "apex");
  },
  component: UsersPage,
});
