import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/pages/shared/UsersPage";

export const Route = createFileRoute("/app/users/")({
  component: UsersPage,
});
