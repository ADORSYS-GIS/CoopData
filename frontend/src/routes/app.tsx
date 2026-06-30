import { Outlet, createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: () => <Outlet />,
});
