import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { SettingsPage } from "@/pages/ministry/SettingsPage";

export const Route = createFileRoute("/app/settings")({
  beforeLoad: () => {
    requireRole("ministry");
  },
  component: SettingsPage,
});
