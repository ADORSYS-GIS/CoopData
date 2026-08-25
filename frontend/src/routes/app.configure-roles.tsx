import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/app-shell";
import { TerminologySettingsManager } from "@/components/settings/TerminologySettingsManager";
import { useTranslation } from "react-i18next";

function ConfigureRolesRoute() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <AppShell
        title={t("settings.terminology.cardTitle", { defaultValue: "Configure Role Labels" })}
        subtitle={t("settings.terminology.cardDesc", {
          defaultValue:
            "Customize the names shown for each organization level across the whole application",
        })}
      >
        <TerminologySettingsManager />
      </AppShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/configure-roles")({
  component: ConfigureRolesRoute,
});
