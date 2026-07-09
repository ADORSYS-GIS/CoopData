import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CooperativeProfileForm } from "@/pages/apex/CooperativeProfile";
import {
  useCooperativeProfile,
  type CooperativeProfile,
} from "@/hooks/cooperatives/useCooperativeProfile";

export const CooperativeProfilePage: React.FC = () => {
  const { cooperativeId } = useParams({ from: "/app/cooperative-profile/$cooperativeId" });
  const navigate = useNavigate();
  const { data: existing, isLoading, error } = useCooperativeProfile(cooperativeId);

  if (isLoading) {
    return (
      <AppShell title="Edit Cooperative Profile" subtitle="Update cooperative information">
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !existing) {
    return (
      <AppShell title="Edit Cooperative Profile" subtitle="Update cooperative information">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="font-semibold text-sm">Failed to load cooperative profile</p>
          <p className="text-xs mt-1">{error ? String(error) : "Not found"}</p>
          <button
            onClick={() => navigate({ to: "/app/cooperatives" })}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Back to cooperatives
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit Cooperative Profile" subtitle="Update cooperative information">
      <div className="mb-4">
        <button
          onClick={() => navigate({ to: "/app/cooperatives" })}
          className="press-feedback inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to cooperatives
        </button>
      </div>
      <CooperativeProfileForm
        existing={existing as CooperativeProfile}
        onSuccess={() => navigate({ to: "/app/cooperatives" })}
      />
    </AppShell>
  );
};
