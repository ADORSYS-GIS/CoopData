import { createFileRoute } from "@tanstack/react-router";
import {
  COOPERATIVES as INITIAL_COOPERATIVES,
  SUBMISSIONS as INITIAL_SUBMISSIONS,
  ACTIVITY_FEED as INITIAL_ACTIVITY_FEED,
  USERS as INITIAL_USERS,
} from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { MinistryDashboard } from "@/components/dashboards/ministry-dashboard";
import { FederationDashboard } from "@/components/dashboards/federation-dashboard";
import { ApexDashboard } from "@/components/dashboards/apex-dashboard";
import { CooperativeDashboard } from "@/components/dashboards/cooperative-dashboard";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CoopData" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { role } = useAuth();

  // Shared state simulation so changes persist in memory
  const [usersList] = useState(INITIAL_USERS);
  const [submissions, setSubmissions] = useState(INITIAL_SUBMISSIONS);
  const [activities, setActivities] = useState(INITIAL_ACTIVITY_FEED);
  const [cooperatives, setCooperatives] = useState(INITIAL_COOPERATIVES);

  // Suppress unused variable warnings — usersList will be used in future entity management
  void usersList;

  switch (role) {
    case "ministry":
      return <MinistryDashboard cooperatives={cooperatives} activities={activities} />;
    case "federation":
      return (
        <FederationDashboard
          submissions={submissions}
          setSubmissions={setSubmissions}
          activities={activities}
          setActivities={setActivities}
        />
      );
    case "apex":
      return (
        <ApexDashboard
          cooperatives={cooperatives}
          setCooperatives={setCooperatives}
          submissions={submissions}
          setSubmissions={setSubmissions}
        />
      );
    case "cooperative":
      return (
        <CooperativeDashboard
          submissions={submissions}
          setSubmissions={setSubmissions}
          activities={activities}
          setActivities={setActivities}
        />
      );
    default:
      return <MinistryDashboard cooperatives={cooperatives} activities={activities} />;
  }
}
