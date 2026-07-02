import {
  COOPERATIVES as INITIAL_COOPERATIVES,
  SUBMISSIONS as INITIAL_SUBMISSIONS,
  ACTIVITY_FEED as INITIAL_ACTIVITY_FEED,
  USERS as INITIAL_USERS,
} from "@/lib/mock-data";
import { useUserRole } from "@/lib/auth";
import { useState } from "react";
import { MinistryDashboard } from "@/components/dashboards/ministry-dashboard";
import { FederationDashboard } from "@/components/dashboards/federation-dashboard";
import { ApexDashboard } from "@/components/dashboards/apex-dashboard";
import { CooperativeDashboard } from "@/components/dashboards/cooperative-dashboard";

export const DashboardPage: React.FC = () => {
  const role = useUserRole();

  const [usersList] = useState(INITIAL_USERS);
  const [submissions, setSubmissions] = useState(INITIAL_SUBMISSIONS);
  const [activities, setActivities] = useState(INITIAL_ACTIVITY_FEED);
  const [cooperatives, setCooperatives] = useState(INITIAL_COOPERATIVES);

  void usersList;

  if (!role) return null;

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
};
