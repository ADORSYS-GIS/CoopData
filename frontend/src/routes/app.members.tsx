import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { MemberList } from "@/pages/ministry/MemberList";

export const Route = createFileRoute("/app/members")({
  beforeLoad: () => {
    requireRole("ministry");
  },
  component: MemberList,
});
