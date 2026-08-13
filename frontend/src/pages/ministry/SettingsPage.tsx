import {
  Sun,
  Moon,
  Monitor,
  User,
  Users,
  ScrollText,
  ClipboardList,
  LineChart,
  Mail,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell, Card } from "@/components/app-shell";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTheme, type Theme } from "@/lib/theme";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { NonFinancialCatalogManager } from "@/components/submissions/non-financial-catalog-manager";

const THEME_OPTIONS: { value: Theme; labelKey: string; icon: typeof Sun }[] = [
  { value: "light", labelKey: "settings.appearance.light", icon: Sun },
  { value: "dark", labelKey: "settings.appearance.dark", icon: Moon },
  { value: "system", labelKey: "settings.appearance.system", icon: Monitor },
];

const SHORTCUTS = [
  {
    to: "/app/profile",
    icon: User,
    titleKey: "settings.shortcuts.profile.title",
    descKey: "settings.shortcuts.profile.desc",
  },
  {
    to: "/app/users",
    icon: Users,
    titleKey: "settings.shortcuts.users.title",
    descKey: "settings.shortcuts.users.desc",
  },
  {
    to: "/app/audit",
    icon: ScrollText,
    titleKey: "settings.shortcuts.audit.title",
    descKey: "settings.shortcuts.audit.desc",
  },
  {
    to: "/app/questionnaire-templates",
    icon: ClipboardList,
    titleKey: "settings.shortcuts.templates.title",
    descKey: "settings.shortcuts.templates.desc",
  },
  {
    to: "/app/custom-kpis",
    icon: LineChart,
    titleKey: "settings.shortcuts.kpis.title",
    descKey: "settings.shortcuts.kpis.desc",
  },
  {
    to: "/app/invitations",
    icon: Mail,
    titleKey: "settings.shortcuts.invitations.title",
    descKey: "settings.shortcuts.invitations.desc",
  },
] as const;

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [activeCategory, setActiveCategory] = useState<string>("general");

  return (
    <AppShell
      title={t("settings.title")}
      subtitle={
        activeCategory === "indicators" ? t("settings.subtitleIndicators") : t("settings.subtitle")
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
            {/* Appearance — Light / Dark / System */}
            <Card
              title={t("settings.appearance.title")}
              subtitle={t("settings.appearance.subtitle")}
              edge="accent"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const isActive = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      aria-pressed={isActive}
                      className={`group flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover-lift ${
                        isActive
                          ? "border-accent/40 bg-accent/[0.06] shadow-[var(--shadow-elev-1)]"
                          : "border-border bg-surface hover:border-accent/25"
                      }`}
                    >
                      <span
                        className={`size-9 rounded-lg grid place-items-center transition-colors ${
                          isActive
                            ? "bg-accent/10 text-accent"
                            : "bg-muted text-muted-foreground group-hover:text-accent"
                        }`}
                      >
                        <opt.icon className="size-4" />
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          isActive ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {t(opt.labelKey)}
                      </span>
                      {isActive && <span className="ml-auto size-2 rounded-full bg-accent" />}
                    </button>
                  );
                })}
              </div>

              {/* Language preference */}
              <div className="mt-5 pt-5 border-t border-border flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.appearance.language")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("settings.appearance.languageDesc")}
                  </p>
                </div>
                <div className="shrink-0">
                  <LanguageSwitcher />
                </div>
              </div>
            </Card>

            {/* Non-Financial Indicators — the one inline configuration feature */}
            <Card
              title={t("settings.indicators.title")}
              subtitle={t("settings.indicators.desc")}
              edge="primary"
            >
              <button
                onClick={() => setActiveCategory("indicators")}
                className="press-feedback inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                <ClipboardList className="size-3.5" /> {t("settings.indicators.open")}
                <ChevronRight className="size-3.5" />
              </button>
            </Card>

            {/* Configuration Shortcuts — redirect to existing pages */}
            <Card title={t("settings.shortcuts.title")} subtitle={t("settings.shortcuts.subtitle")}>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
                {SHORTCUTS.map((s) => (
                  <Link
                    key={s.to}
                    to={s.to}
                    className="bg-surface p-5 text-left group transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between">
                      <div className="size-9 rounded-lg grid place-items-center bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                        <s.icon className="size-4" />
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-accent transition-colors mt-1" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">{t(s.titleKey)}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {t(s.descKey)}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
};
export default SettingsPage;
