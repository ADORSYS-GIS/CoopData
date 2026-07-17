import { AppShell } from "@/components/app-shell";
import { type Role, useUserRole } from "@/lib/auth";
import { ReportExportPanel } from "@/components/reports/report-export-panel";

const titleByRole: Record<Role, string> = {
  ministry: "Reporting Center",
  federation: "Federation Reports",
  apex: "Apex Reports",
  cooperative: "My Reports",
};

const subtitleByRole: Record<Role, string> = {
  ministry: "Generate and download intelligence reports across the cooperative ecosystem",
  federation: "Generate and download reports for your federation and its apex organizations",
  apex: "Generate and download reports for cooperatives under your apex organization",
  cooperative: "View and export reports from your submitted data and analytics",
};

export const ReportsPage: React.FC = () => {
  const role = useUserRole();
  if (!role) return null;

  return (
    <AppShell title={titleByRole[role]} subtitle={subtitleByRole[role]}>
      <div className="space-y-8">
        {/* Export Panel */}
        <ReportExportPanel />
      </div>
    </AppShell>
  );
};
