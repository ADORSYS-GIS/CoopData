import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { InvitationList } from "@/pages/ministry/InvitationList";

export const Route = createFileRoute("/app/invitations")({
  beforeLoad: async () => {
    await requireRole("ministry");
  },
  component: InvitationList,
});
