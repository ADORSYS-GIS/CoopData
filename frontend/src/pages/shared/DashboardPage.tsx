import { useUserRole } from "@/lib/auth";
import { MinistryDashboard } from "@/components/dashboards/ministry-dashboard";
import { FederationDashboard } from "@/components/dashboards/federation-dashboard";
import { ApexDashboard } from "@/components/dashboards/apex-dashboard";
import { CooperativeDashboard } from "@/components/dashboards/cooperative-dashboard";
import { Navigate } from "@tanstack/react-router";

export const DashboardPage: React.FC = () => {
  const role = useUserRole();

  if (!role) {
    return <Navigate to="/unauthorized" />;
  }

  switch (role) {
    case "ministry":
      return <MinistryDashboard />;
    case "federation":
      return <FederationDashboard />;
    case "apex":
      return <ApexDashboard />;
    case "cooperative":
      return <CooperativeDashboard />;
  }
};
