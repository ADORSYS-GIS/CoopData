import { createFileRoute } from "@tanstack/react-router";
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
  Check,
} from "lucide-react";
import { AppShell, Card } from "@/components/app-shell";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — CoopData" }] }),
  component: SettingsPage,
});

const GROUPS = [
  {
    icon: Building2,
    title: "Organization",
    desc: "Ministry profile, legal entity, branding and disclosure policies.",
  },
  {
    icon: Globe,
    title: "Localization",
    desc: "Languages: English, SiSwati, Portuguese. Date and number formats.",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    desc: "Password policy, MFA enforcement, session timeout, device trust.",
  },
  {
    icon: Bell,
    title: "Notifications",
    desc: "Email, in-app, and SMS delivery for system events and alerts.",
  },
  {
    icon: Database,
    title: "Data Retention",
    desc: "Archival schedules, audit log retention, and export policies.",
  },
  {
    icon: Palette,
    title: "Appearance",
    desc: "Theme mode, accent color, dashboard layout density settings.",
  },
];

const SECURITY_POLICIES = [
  { k: "Multi-factor authentication", v: "Required for all roles", icon: Lock },
  { k: "Minimum password length", v: "14 characters", icon: ShieldCheck },
  { k: "Password rotation cycle", v: "Every 90 days", icon: Lock },
  { k: "Session idle timeout", v: "30 minutes of inactivity", icon: Monitor },
  { k: "Failed login lockout", v: "5 attempts · 15 min lockout", icon: User },
  { k: "Device trust window", v: "30 days per device", icon: Monitor },
];

const NOTIFICATION_CHANNELS = [
  { channel: "Email", icon: Mail, enabled: true, count: 12 },
  { channel: "In-app", icon: Bell, enabled: true, count: 24 },
  { channel: "SMS", icon: Globe, enabled: false, count: 3 },
];

function SettingsPage() {
  const [channels, setChannels] = useState(NOTIFICATION_CHANNELS);

  const toggleChannel = (ch: string) => {
    setChannels((prev) => prev.map((c) => (c.channel === ch ? { ...c, enabled: !c.enabled } : c)));
    toast.success(`${ch} notifications toggled.`);
  };

  return (
    <AppShell
      title="Settings"
      subtitle="Platform configuration, security policy, and notification preferences"
    >
      <div className="space-y-8">
        {/* Settings Category Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {GROUPS.map((g) => (
            <button
              key={g.title}
              onClick={() => toast.info(`Opening ${g.title} settings...`)}
              className="bg-surface p-5 text-left group transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between">
                <div className="size-9 rounded-lg grid place-items-center bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                  <g.icon className="size-4" />
                </div>
                <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-accent transition-colors mt-1" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{g.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.desc}</p>
            </button>
          ))}
        </div>

        {/* Security Policy */}
        <Card title="Security Policy" subtitle="Enforced across all 10,235 accounts">
          <div className="divide-y divide-border -mx-5">
            {SECURITY_POLICIES.map((p) => (
              <div
                key={p.k}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <p.icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{p.k}</span>
                </div>
                <span className="text-sm font-medium text-foreground shrink-0 tabular-nums">
                  {p.v}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex justify-end">
            <button
              onClick={() => toast.success("Security policy update queued for review.")}
              className="press-feedback inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
            >
              <Save className="size-3.5" /> Edit policy
            </button>
          </div>
        </Card>

        {/* Notification Preferences */}
        <Card
          title="Notification Channels"
          subtitle="Default delivery methods for system events and compliance alerts"
        >
          <div className="grid md:grid-cols-3 gap-4">
            {channels.map((n) => (
              <button
                key={n.channel}
                onClick={() => toggleChannel(n.channel)}
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
                <p className="text-sm font-semibold text-foreground">{n.channel}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{n.count} event types</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
