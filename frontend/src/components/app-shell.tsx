import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Inbox,
  FileBarChart,
  PieChart,
  BarChart3,
  Settings,
  Search,
  Bell,
  Globe,
  HelpCircle,
  Menu,
  X,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Landmark,
  Network,
  Mail,
  UserPlus,
  UserCog,
  ScrollText,
  Users,
  Database,
  Info,
  Scale,
  Calculator,
  Gauge,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { ROLES, ROLE_NAV, ROLE_NAV_ITEMS, type NavGroupId } from "@/constants/roles";
import { useTheme } from "@/lib/theme";
import { UnauthorizedPage } from "@/components/UnauthorizedPage";
import { Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./shared/LanguageSwitcher";

type NavItem = { to: string; label: string; icon: LucideIcon; badge?: string };

const NAV_GROUPS: { id: NavGroupId; label: string; items: NavItem[] }[] = [
  {
    id: "oversight",
    label: "Oversight",
    items: [
      { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/federations", label: "Federations", icon: Landmark },
      { to: "/app/invitations", label: "Invitations", icon: Mail },
      { to: "/app/members", label: "Members", icon: UserPlus },
      { to: "/app/apexes", label: "Apexes", icon: Network },
      { to: "/app/cooperatives", label: "Cooperatives", icon: Building2 },
      { to: "/app/submissions", label: "Submissions", icon: Inbox },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { to: "/app/reports", label: "Reports", icon: FileBarChart },
      { to: "/app/analytics", label: "Analytics", icon: PieChart },
      { to: "/app/basic-analytics", label: "Basic Analytics", icon: BarChart3 },
      { to: "/app/benchmarking", label: "Benchmarking", icon: Scale },
      { to: "/app/basic-benchmarking", label: "Basic Benchmarking", icon: Gauge },
      { to: "/app/custom-kpis", label: "Custom KPIs", icon: Calculator },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/app/settings", label: "Settings", icon: Settings },
      { to: "/app/configure-roles", label: "Configure Levels", icon: Tags },
      { to: "/app/questionnaire-templates", label: "Questionnaire Forms", icon: ClipboardList },
      { to: "/app/users", label: "Users & Roles", icon: Users },
      { to: "/app/audit", label: "Audit Log", icon: ScrollText },
      { to: "/app/profile", label: "Profile", icon: UserCog },
    ],
  },
];

function Sidebar({
  mobile,
  collapsed,
  onClose,
  onToggleCollapse,
}: {
  mobile?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}) {
  const { t } = useTranslation();
  const { getLabel } = useOrganizationLabelsContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout, role } = useAuth();

  const getGroupLabel = (group: { id: NavGroupId; label: string }) => {
    if (group.id === "oversight") return t("nav.oversight");
    if (group.id === "intelligence") return t("nav.intelligence");
    if (group.id === "system") return t("nav.system");
    return group.label;
  };

  const getItemLabel = (item: { to: string; label: string }) => {
    if (item.to === "/app/dashboard") return t("nav.dashboard");
    if (item.to === "/app/federations")
      return getLabel("federation", "plural_label", t("nav.federations"));
    if (item.to === "/app/invitations") return t("nav.invitations");
    if (item.to === "/app/members") return t("nav.members");
    if (item.to === "/app/apexes") return getLabel("apex", "plural_label", t("nav.apexes"));
    if (item.to === "/app/cooperatives")
      return getLabel("cooperative", "plural_label", t("nav.cooperatives"));
    if (item.to === "/app/submissions") return t("nav.submissions");

    if (item.to === "/app/reports") return t("nav.reports");
    if (item.to === "/app/analytics") return t("nav.analytics");
    if (item.to === "/app/basic-analytics") return t("nav.basicAnalytics");
    if (item.to === "/app/benchmarking") return t("nav.benchmarking");
    if (item.to === "/app/basic-benchmarking") return t("nav.basicBenchmarking");
    if (item.to === "/app/custom-kpis") return t("nav.customKpis");

    if (item.to === "/app/audit") return t("nav.auditLog");
    if (item.to === "/app/questionnaire-templates") return t("nav.questionnaireForms");
    if (item.to === "/app/users") return t("nav.usersAndRoles");
    if (item.to === "/app/settings") return t("nav.settings");
    if (item.to === "/app/configure-roles")
      return t("nav.configureRoles", { defaultValue: "Configure Levels" });
    if (item.to === "/app/profile") return t("nav.profile");
    return item.label;
  };

  const effectiveRole = role ?? "ministry";
  const currentRole = ROLES.find((r) => r.id === effectiveRole)!;

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
  };

  const visibleGroups = ROLE_NAV[effectiveRole];
  const filteredGroups = NAV_GROUPS.filter((g) => visibleGroups.includes(g.id))
    .map((group) => {
      const allowedItems = ROLE_NAV_ITEMS[effectiveRole][group.id] || [];
      return { ...group, items: group.items.filter((item) => allowedItems.includes(item.to)) };
    })
    .filter((g) => g.items.length > 0);

  const isCollapsed = collapsed && !mobile;

  const userContextLabel = useMemo(() => {
    if (isCollapsed) return null;
    const ctx =
      effectiveRole === "ministry"
        ? t("common.national")
        : effectiveRole === "federation"
          ? (user?.organizationName ?? user?.region ?? null)
          : effectiveRole === "apex" || effectiveRole === "cooperative"
            ? (user?.cooperationName ?? user?.region ?? null)
            : null;
    return ctx ? (
      <p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">{ctx}</p>
    ) : null;
  }, [isCollapsed, effectiveRole, user, t]);

  return (
    <aside
      className={`flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      } ${mobile ? "h-dvh" : "sticky top-0 h-dvh overflow-hidden"}`}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-5 py-6 border-b border-sidebar-border ${isCollapsed ? "justify-center px-0" : ""}`}
      >
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/coopdatalogo.png"
            alt={t("common.logoAlt")}
            className={`shrink-0 rounded-lg object-contain ${isCollapsed ? "size-11" : "size-20 py-1"}`}
          />
        </Link>
        {/* Collapse toggle — desktop only */}
        {!mobile && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`flex size-7 items-center justify-center rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors shrink-0 ${isCollapsed ? "" : "ml-auto"}`}
            aria-label={isCollapsed ? t("common.expandSidebar") : t("common.collapseSidebar")}
            title={isCollapsed ? t("common.expandSidebar") : t("common.collapseSidebar")}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        )}
        {mobile && onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            aria-label={t("common.closeMenu")}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-4 space-y-5 ${isCollapsed ? "px-2" : "px-3"}`}>
        {filteredGroups.map((group) => (
          <div key={group.id}>
            {!isCollapsed && (
              <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.22em] text-sidebar-foreground/60">
                {getGroupLabel(group)}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                const translatedLabel = getItemLabel(item);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => {
                        onClose?.();
                      }}
                      title={isCollapsed ? translatedLabel : undefined}
                      className={[
                        "group flex items-center rounded-lg text-[13px] font-medium transition-all duration-150",
                        isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5",
                        active
                          ? "bg-accent/15 text-accent shadow-sm ring-1 ring-inset ring-accent/20"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      ].join(" ")}
                    >
                      <Icon
                        className={`size-[17px] shrink-0 transition-colors ${
                          active
                            ? "text-accent"
                            : "text-sidebar-foreground/75 group-hover:text-sidebar-accent-foreground"
                        }`}
                        aria-hidden
                      />
                      {!isCollapsed && (
                        <>
                          <span className="truncate">{translatedLabel}</span>
                          {item.badge && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                              {item.badge}
                            </span>
                          )}
                          {active && (
                            <ChevronRight className="ml-auto size-3.5 text-accent/70 shrink-0" />
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile footer */}
      <div
        className={`border-t border-sidebar-border py-3 space-y-2 ${isCollapsed ? "px-2" : "px-3"}`}
      >
        <div
          className={`flex items-center rounded-lg bg-sidebar-accent/50 ${isCollapsed ? "justify-center py-2" : "gap-3 px-3 py-2.5"}`}
        >
          <Link
            to="/app/profile"
            onClick={onClose}
            title={isCollapsed ? t("nav.profile") : undefined}
            className={`flex items-center min-w-0 flex-1 hover:opacity-80 transition-opacity ${isCollapsed ? "justify-center" : "gap-3"}`}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white ring-2 ring-accent/30">
              {user?.initials ?? "??"}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate text-sidebar-foreground">
                  {user?.name ?? t("common.unknown")}
                </p>
                <p className="text-[11px] text-sidebar-foreground/75 truncate">
                  {t(`roles.${currentRole.id}`)}
                </p>
                {userContextLabel}
              </div>
            )}
          </Link>
          {!isCollapsed && (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-md p-1.5 hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t("common.logout")}
            >
              {isLoggingOut ? (
                <span className="size-3.5 block rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <LogOut className="size-3.5" />
              )}
            </button>
          )}
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-success animate-pulse shrink-0" />
            <span className="text-[11px] text-sidebar-foreground/70 font-medium">
              {t("common.allSystemsOperational")}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

function Topbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
  };

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10">
            <Sidebar mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors lg:hidden"
            aria-label={t("common.openMenu")}
          >
            <Menu className="size-4.5" />
          </button>
          <Link to="/" className="hidden size-9 shrink-0 rounded-lg object-contain lg:block">
            <img
              src="/coopdatalogo.png"
              alt={t("common.logoAlt")}
              className="size-9 rounded-lg object-contain"
            />
          </Link>
          <div className="min-w-0">
            <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground truncate leading-tight">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("common.searchPlaceholder")}
              className="w-full rounded-lg border border-transparent bg-muted py-1.5 pl-8.5 pr-3 text-sm transition-all focus:border-ring focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:flex">
              ⌘K
            </kbd>
          </div>

          {/* Language Selector */}
          <LanguageSwitcher className="mr-1" />

          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            aria-label={t("common.themeLabel", { theme })}
            title={t("common.themeTitle", {
              theme: theme === "system" ? `${t("common.system")} (${resolvedTheme})` : theme,
            })}
          >
            {resolvedTheme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>

          {actions}
        </div>
      </header>
    </>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  // Redirect to login if not authenticated — must be in useEffect, not render body
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-accent" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-dvh flex bg-background">
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-full">{children}</main>
      </div>
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
}) {
  const map = {
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/15 text-warning-foreground ring-warning/30",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
    info: "bg-info/10 text-info ring-info/20",
    neutral: "bg-muted text-muted-foreground ring-border",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${map[tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

/**
 * Card — every card in the app gets a subtle colored top-edge accent.
 * Pass `edge` to choose the color: "accent" (default), "success", "warning", "danger", "info", "primary", "none".
 */
export function Card({
  title,
  subtitle,
  action,
  info,
  children,
  className = "",
  bodyClassName = "",
  edge = "none",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  info?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  edge?: "accent" | "success" | "warning" | "danger" | "info" | "primary" | "none";
}) {
  // Color lines are disabled to align with a clean, solid, professional dashboard design
  const edgeCls = "shadow-[var(--shadow-elev-1)]";

  return (
    <section
      className={`rounded-xl border border-border bg-surface ${edgeCls} transition-shadow hover:shadow-[var(--shadow-elev-2)] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="font-heading text-[14px] font-semibold text-foreground flex items-center gap-1.5 truncate">
                {title}
                {info && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex focus:outline-none rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <Info className="size-3.5 text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      className="max-w-xs whitespace-normal z-[60] p-3 shadow-xl"
                    >
                      <p className="text-sm font-normal normal-case tracking-normal text-foreground leading-snug">
                        {info}
                      </p>
                    </PopoverContent>
                  </Popover>
                )}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/**
 * StatCard — KPI metric card with ghost icon watermark background + left edge color accent.
 * Use for all small stat/metric grids across the app (not for large wrapper cards).
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  info,
  tone = "primary",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle?: string;
  info?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "accent";
  children?: ReactNode;
}) {
  const iconBadgeCls =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning-foreground"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : tone === "info"
            ? "bg-info/10 text-info"
            : tone === "accent"
              ? "bg-accent/10 text-accent"
              : "bg-primary/10 text-primary";

  const ghostCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "danger"
          ? "text-destructive"
          : tone === "info"
            ? "text-info"
            : tone === "accent"
              ? "text-accent"
              : "text-primary";

  const toneBorderCls =
    tone === "success"
      ? "border-l-4 border-l-success"
      : tone === "warning"
        ? "border-l-4 border-l-warning"
        : tone === "danger"
          ? "border-l-4 border-l-destructive"
          : tone === "info"
            ? "border-l-4 border-l-info"
            : tone === "accent"
              ? "border-l-4 border-l-accent"
              : "border-l-4 border-l-primary";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-surface p-5 hover-lift shadow-[var(--shadow-elev-1)] ${toneBorderCls}`}
    >
      {/* Ghost watermark icon */}
      <Icon
        className={`pointer-events-none absolute -right-3 -bottom-3 size-24 opacity-[0.05] ${ghostCls}`}
        strokeWidth={1}
      />
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-tight truncate">
            {label}
          </p>
          {info && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex focus:outline-none rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Info className="size-3 text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                className="max-w-xs whitespace-normal z-[60] p-3 shadow-xl"
              >
                <p className="text-sm font-normal normal-case tracking-normal text-foreground leading-snug">
                  {info}
                </p>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className={`size-8 rounded-lg grid place-items-center shrink-0 ${iconBadgeCls}`}>
          <Icon className="size-4" />
        </div>
      </div>
      {/* Value */}
      <p className="mt-4 font-heading text-2xl font-bold tracking-tight num text-foreground">
        {value}
      </p>
      {/* Subtitle */}
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground leading-snug truncate">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
