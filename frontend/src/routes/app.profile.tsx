import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { ProfilePage } from "@/pages/shared/ProfilePage";

export const Route = createFileRoute("/app/profile")({
  beforeLoad: () => {
    requireAuth();
  },
  component: ProfilePage,
});
