import {
  Building2,
  Globe,
  ShieldCheck,
  Bell,
  Database,
  Palette,
  ChevronRight,
  Lock,
  Monitor,
  User,
  Mail,
  Save,
  ArrowLeft,
  ClipboardList,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell, Card } from "@/components/app-shell";
import { useState } from "react";
import { toast } from "sonner";
import { NonFinancialCatalogManager } from "@/components/submissions/non-financial-catalog-manager";

const GROUPS = [
  {
    id: "organization",
    icon: Building2,
  },
  {
    id: "localization",
    icon: Globe,
  },
  {
    id: "security",
    icon: ShieldCheck,
  },
  {
    id: "notifications",
    icon: Bell,
  },
  {
    id: "retention",
    icon: Database,
  },
  {
    id: "indicators",
    icon: ClipboardList,
  },
];

const SECURITY_POLICIES = [
  { id: "mfa", icon: Lock },
  { id: "passwordLength", icon: ShieldCheck },
  { id: "passwordRotation", icon: Lock },
  { id: "sessionTimeout", icon: Monitor },
  { id: "failedLockout", icon: User },
  { id: "deviceTrust", icon: Monitor },
];

const NOTIFICATION_CHANNELS = [
  { id: "email", channelKey: "email", icon: Mail, enabled: true, count: 12 },
  { id: "inApp", channelKey: "inApp", icon: Bell, enabled: true, count: 24 },
  { id: "sms", channelKey: "sms", icon: Globe, enabled: false, count: 3 },
];

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>("general");
  const [channels, setChannels] = useState(NOTIFICATION_CHANNELS);

  const toggleChannel = (chId: string, channelName: string) => {
    setChannels((prev) => prev.map((c) => (c.id === chId ? { ...c, enabled: !c.enabled } : c)));
    toast.success(t("settings.notificationsToggled", { channel: channelName }));
  };

  const handleGroupClick = (group: (typeof GROUPS)[0]) => {
    if (group.id === "indicators") {
      setActiveCategory("indicators");
    } else {
      toast.info(t("settings.openingSettingsToast", { title: t(`settings.groups.${group.id}.title`) }));
    }
  };

  return (
    <AppShell
      title={t("settings.title")}
      subtitle={
        activeCategory === "indicators"
          ? t("settings.subtitleIndicators")
          : t("settings.subtitle")
      }
    >
      <div className="space-y-8">
        {activeCategory === "indicators" ? (
          <div className="space-y-6">
            <button
              onClick={() => setActiveCategory("general")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="size-3.5" /> {t("settings.backBtn")}
            </button>
            <NonFinancialCatalogManager />
          </div>
        ) : (
          <>
            {/* Settings Category Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleGroupClick(g)}
                  className="bg-surface p-5 text-left group transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between">
                    <div className="size-9 rounded-lg grid place-items-center bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                      <g.icon className="size-4" />
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-accent transition-colors mt-1" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">{t(`settings.groups.${g.id}.title`)}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(`settings.groups.${g.id}.desc`)}</p>
                </button>
              ))}
            </div>

            {/* Security Policy */}
            <Card title={t("settings.securityPolicyTitle")} subtitle={t("settings.securityPolicySubtitle")}>
              <div className="divide-y divide-border -mx-5">
                {SECURITY_POLICIES.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <p.icon className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground">{t(`settings.securityPolicies.${p.id}.label`)}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground shrink-0 tabular-nums">
                      {t(`settings.securityPolicies.${p.id}.value`)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <button
                  onClick={() => toast.success(t("settings.securityPolicyUpdateQueued"))}
                  className="press-feedback inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  <Save className="size-3.5" /> {t("settings.editPolicy")}
                </button>
              </div>
            </Card>

            {/* Notification Preferences */}
            <Card
              title={t("settings.notificationChannelsTitle")}
              subtitle={t("settings.notificationChannelsSubtitle")}
            >
              <div className="grid md:grid-cols-3 gap-4">
                {channels.map((n) => {
                  const channelName = t(`settings.channels.${n.channelKey}`);
                  return (
                    <button
                      key={n.id}
                      onClick={() => toggleChannel(n.id, channelName)}
                      className={`rounded-lg border p-4 text-left transition-all hover-lift ${
                        n.enabled ? "border-accent/25 bg-accent/[0.03]" : "border-border bg-surface"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`size-8 rounded-lg grid place-items-center ${n.enabled ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}
                        >
                          <n.icon className="size-4" />
                        </div>
                        {/* Toggle switch */}
                        <div
                          className={`w-9 h-5 rounded-full transition-colors relative ${n.enabled ? "bg-accent" : "bg-border"}`}
                        >
                          <span
                            className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${n.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                          />
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{channelName}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t("settings.eventTypesCount", { count: n.count })}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
};
export default SettingsPage;
