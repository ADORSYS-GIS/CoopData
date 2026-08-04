import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CooperativeProfileForm } from "@/pages/apex/CooperativeProfile";
import {
  useCooperativeProfile,
  type CooperativeProfile,
} from "@/hooks/cooperatives/useCooperativeProfile";
import { useTranslation } from "react-i18next";

export const CooperativeProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { cooperativeId } = useParams({ from: "/app/cooperative-profile/$cooperativeId" });
  const navigate = useNavigate();
  const { data: existing, isLoading, error } = useCooperativeProfile(cooperativeId);

  if (isLoading) {
    return (
      <AppShell title={t("coopProfilePage.title")} subtitle={t("coopProfilePage.subtitle")}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">{t("coopProfilePage.loading")}</p>
        </div>
      </AppShell>
    );
  }

  if (error || !existing) {
    return (
      <AppShell title={t("coopProfilePage.title")} subtitle={t("coopProfilePage.subtitle")}>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="font-semibold text-sm">{t("coopProfilePage.failed")}</p>
          <p className="text-xs mt-1">{error ? String(error) : t("coopProfilePage.notFound")}</p>
          <button
            onClick={() => navigate({ to: "/app/cooperatives" })}
            className="mt-4 text-sm text-primary hover:underline"
          >
            {t("coopProfilePage.backToCoops")}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("coopProfilePage.title")} subtitle={t("coopProfilePage.subtitle")}>
      <div className="mb-4">
        <button
          onClick={() => navigate({ to: "/app/cooperatives" })}
          className="press-feedback inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          {t("coopProfilePage.backToCoops")}
        </button>
      </div>
      <CooperativeProfileForm
        existing={existing as CooperativeProfile}
        onSuccess={() => navigate({ to: "/app/cooperatives" })}
      />
    </AppShell>
  );
};
