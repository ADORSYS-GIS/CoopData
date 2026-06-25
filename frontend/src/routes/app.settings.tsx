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
    color: "text-accent bg-accent/10",
    edgeCls: "card-edge",
  },
  {
    icon: Globe,
    title: "Localization",
    desc: "Languages: English, SiSwati, Portuguese. Date and number formats.",
    color: "text-info bg-info/10",
    edgeCls: "card-edge-info",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    desc: "Password policy, MFA enforcement, session timeout, device trust.",
    color: "text-success bg-success/10",
    edgeCls: "card-edge-success",
  },
  {
    icon: Bell,
    title: "Notifications",
    desc: "Email, in-app, and SMS delivery for system events and alerts.",
    color: "text-warning-foreground bg-warning/15",
    edgeCls: "card-edge-warning",
  },
  {
    icon: Database,
    title: "Data Retention",
    desc: "Archival schedules, audit log retention, and export policies.",
    color: "text-accent bg-accent/10",
    edgeCls: "card-edge-primary",
  },
  {
    icon: Palette,
    title: "Appearance",
    desc: "Theme mode, accent color, dashboard layout density settings.",
    color: "text-foreground bg-muted",
    edgeCls: "card-edge",
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
      <div className="space-y-6">
        {/* Settings Category Grid */}
        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GROUPS.map((g) => (
            <li key={g.title}>
              <div
                className={`rounded-xl border border-border bg-surface p-5 hover-lift cursor-pointer h-full flex flex-col ${g.edgeCls}`}
                onClick={() => toast.info(`Opening ${g.title} settings...`)}
              >
                <div className={`size-10 rounded-xl grid place-items-center ${g.color}`}>
                  <g.icon className="size-5" />
                </div>
                <p className="mt-4 font-heading font-bold text-foreground">{g.title}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed flex-1">
                  {g.desc}
                </p>
                <button className="press-feedback mt-4 inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline self-start">
                  Configure <ChevronRight className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* Security Policy */}
        <Card
          title="Security Policy"
          subtitle="Enforced across all 10,235 accounts — system-wide hardened configuration"
          action={
            <button
              onClick={() => toast.success("Security policy update queued for review.")}
              className="press-feedback inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
            >
              <Save className="size-3.5" /> Edit policy
            </button>
          }
        >
          <ul className="divide-y divide-border -my-2">
            {SECURITY_POLICIES.map((p) => (
              <li
                key={p.k}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-muted/20 -mx-5 px-5 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-xl bg-muted grid place-items-center shrink-0">
                    <p.icon className="size-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-foreground truncate">{p.k}</span>
                </div>
                <span className="text-sm font-bold text-foreground shrink-0">{p.v}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Notification Preferences */}
        <Card
          title="Notification Channels"
          subtitle="Default delivery methods for system events and compliance alerts"
        >
          <div className="grid md:grid-cols-3 gap-4">
            {channels.map((n) => (
              <div
                key={n.channel}
                onClick={() => toggleChannel(n.channel)}
                className={`rounded-xl border p-4 cursor-pointer hover-lift transition-all ${
                  n.enabled ? "border-accent/30 bg-accent/5" : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`size-9 rounded-xl grid place-items-center ${n.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    <n.icon className="size-4" />
                  </div>
                  <div
                    className={`w-8 h-4 rounded-full transition-colors relative ${n.enabled ? "bg-success" : "bg-muted"}`}
                  >
                    <span
                      className={`absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-transform ${n.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                    />
                  </div>
                </div>
                <p className="text-sm font-bold text-foreground">{n.channel}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{n.count} event types</p>
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${n.enabled ? "text-success" : "text-muted-foreground"}`}
                >
                  {n.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
