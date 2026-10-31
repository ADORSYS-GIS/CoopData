import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MambuLinksPanel } from "@/components/mambu/MambuLinksPanel";
import { MambuMappingPanel } from "@/components/mambu/MambuMappingPanel";
import { MambuSyncPanel } from "@/components/mambu/MambuSyncPanel";
import { useAuth } from "@/context/AuthContext";
import type { MambuScope } from "@/hooks/mambu/useMambu";

const SUBTITLE: Record<MambuScope, string> = {
  ministry: "Pull SACCO data from Mambu into CoopData for Ministry review.",
  apex: "Pull the data of your cooperatives from Mambu into drafts you can check and submit.",
  cooperative: "Pull your SACCO data from Mambu into a draft you can check and submit.",
};

export const MambuSyncPage: React.FC = () => {
  const { t } = useTranslation();
  const { role } = useAuth();
  const scope: MambuScope = role === "apex" || role === "cooperative" ? role : "ministry";

  return (
    <AppShell
      title={t("mambu.pageTitle", { defaultValue: "Mambu Sync" })}
      subtitle={t(`mambu.pageSubtitle.${scope}`, { defaultValue: SUBTITLE[scope] })}
    >
      {scope !== "ministry" ? (
        <MambuSyncPanel scope={scope} />
      ) : (
        <Tabs defaultValue="sync" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sync">{t("mambu.tabSync", { defaultValue: "Sync" })}</TabsTrigger>
            <TabsTrigger value="links">
              {t("mambu.tabLinks", { defaultValue: "SACCO links" })}
            </TabsTrigger>
            <TabsTrigger value="mapping">
              {t("mambu.tabMapping", { defaultValue: "Ledger mapping" })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sync">
            <MambuSyncPanel scope="ministry" />
          </TabsContent>
          <TabsContent value="links">
            <MambuLinksPanel />
          </TabsContent>
          <TabsContent value="mapping">
            <MambuMappingPanel />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
};
