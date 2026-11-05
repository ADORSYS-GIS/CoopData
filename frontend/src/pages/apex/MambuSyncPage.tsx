import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MambuMappingPanel } from "@/components/mambu/MambuMappingPanel";
import { MambuProductMappingPanel } from "@/components/mambu/MambuProductMappingPanel";
import { MambuSyncPanel } from "@/components/mambu/MambuSyncPanel";

/** Mambu sync of the apex: link cooperatives, sync them, and map accounts and products. */
export const MambuSyncPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <AppShell
      title={t("mambu.pageTitle", { defaultValue: "Mambu Sync" })}
      subtitle={t("mambu.pageSubtitle.apex", {
        defaultValue:
          "Pull the data of your cooperatives from Mambu into drafts you check and submit.",
      })}
    >
      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sync">{t("mambu.tabSync", { defaultValue: "Sync" })}</TabsTrigger>
          <TabsTrigger value="mapping">
            {t("mambu.tabMapping", { defaultValue: "Mapping" })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sync">
          <MambuSyncPanel />
        </TabsContent>
        <TabsContent value="mapping" className="space-y-6">
          <MambuMappingPanel />
          <MambuProductMappingPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};
