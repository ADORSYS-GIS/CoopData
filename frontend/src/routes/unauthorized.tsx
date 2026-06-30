import { createFileRoute } from "@tanstack/react-router";
import { UnauthorizedPage } from "@/components/UnauthorizedPage";

export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
});
