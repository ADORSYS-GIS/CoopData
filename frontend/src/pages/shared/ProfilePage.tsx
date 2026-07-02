import { Shield, KeyRound, Mail, Locate, Eye, EyeOff, Clock, Loader2 } from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useAuth, ROLES, useUserRole } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showC, setShowC] = useState(false);
  const [showN, setShowN] = useState(false);
  const [showCo, setShowCo] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!current || !next || !confirm) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (next !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const { getAccessToken } = await import("@/services/shared/authService");
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/me/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          current_password: current,
          new_password: next,
          logout_sessions: false,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        toast.error(json.message ?? json.error ?? `Error ${res.status}`);
        return;
      }
      toast.success(json.message ?? "Password updated successfully!");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    show: boolean,
    toggle: () => void,
  ) => (
    <div>
      <label className="block text-xs font-semibold mb-1.5 text-foreground">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
        />
        <button
          type="button"
          onClick={toggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </div>
  );

  return (
    <Card title="Change Account Password" subtitle="Rotate your credentials securely" edge="none">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          {field("Current Password", current, setCurrent, showC, () => setShowC(!showC))}
          {field("New Password", next, setNext, showN, () => setShowN(!showN))}
          {field("Confirm Password", confirm, setConfirm, showCo, () => setShowCo(!showCo))}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handle}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Update password
          </button>
        </div>
      </div>
    </Card>
  );
}

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const role = useUserRole();
  const [mfaActive, setMfaActive] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(60);

  if (!role || !user) return null;

  const currentRole = ROLES.find((r) => r.id === role) || { label: "Workspace Member" };

  const getRoleCapabilities = () => {
    switch (role) {
      case "ministry":
        return [
          {
            name: "User Account Provisioning",
            allowed: true,
            scope: "Regional & Cooperative managers",
          },
          {
            name: "Filing Approvals / Sign-off",
            allowed: true,
            scope: "National compliance scale",
          },
          { name: "Access System Audit Trails", allowed: true, scope: "View only" },
          { name: "System Configuration", allowed: true, scope: "National settings" },
          { name: "View All Cooperatives", allowed: true, scope: "National scope" },
        ];
      case "federation":
        return [
          {
            name: "User Account Provisioning",
            allowed: true,
            scope: "Cooperative Managers under federation",
          },
          { name: "Filing Approvals / Sign-off", allowed: true, scope: "Federation submissions" },
          { name: "Access System Audit Trails", allowed: true, scope: "Federation scope" },
          { name: "View Cooperatives", allowed: true, scope: "Federation scope" },
          { name: "Generate Reports", allowed: true, scope: "Federation scope" },
        ];
      case "apex":
        return [
          {
            name: "Review Cooperative Submissions",
            allowed: true,
            scope: "Cooperatives under apex",
          },
          {
            name: "Approve / Reject / Request Changes",
            allowed: true,
            scope: "Cooperative submissions",
          },
          { name: "Manage Cooperatives", allowed: true, scope: "Apex scope" },
          { name: "Create Cooperative Users", allowed: true, scope: "Apex scope" },
          { name: "Generate Reports", allowed: true, scope: "Apex scope" },
        ];
      case "cooperative":
        return [
          { name: "Filing Returns & Disclosures", allowed: true, scope: "Own Cooperative only" },
          { name: "Manage Cooperative Roster", allowed: true, scope: "Own Cooperative only" },
          { name: "View Own Reports", allowed: true, scope: "Own Cooperative only" },
          { name: "Submit Financial Statements", allowed: true, scope: "Own Cooperative only" },
        ];
      default:
        return [];
    }
  };

  const capabilities = getRoleCapabilities();
  const allowedCount = capabilities.filter((c) => c.allowed).length;

  return (
    <AppShell
      title="User Profile"
      subtitle="Manage your identity settings and security configurations"
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Hero */}
        <Card edge="primary">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative">
              <div className="size-20 rounded-2xl bg-gradient-to-br from-accent to-accent/70 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-accent/20">
                {user.initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-success ring-[3px] ring-surface" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-heading text-xl font-bold text-foreground">{user.name}</h2>
                <StatusPill tone="success">Active Session</StatusPill>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{currentRole.label}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-accent" /> {user.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Locate className="size-3.5 text-accent" /> {user.region} Region
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="size-3.5 text-accent" /> {allowedCount} of{" "}
                  {capabilities.length} permissions granted
                </span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left — Security only */}
          <div className="lg:col-span-1">
            <Card
              title="Security Preferences"
              subtitle="Account protection settings"
              edge="warning"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-accent" />
                      <p className="text-sm font-semibold text-foreground">
                        Multi-Factor Authentication
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Require secondary email OTP verification on login
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setMfaActive(!mfaActive);
                      toast.success(`MFA ${!mfaActive ? "ENABLED" : "DISABLED"}`);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${mfaActive ? "bg-success border-success" : "bg-muted border-border"}`}
                  >
                    <span
                      className={`pointer-events-none inline-block size-[18px] rounded-full bg-surface shadow-sm transition-transform ${mfaActive ? "translate-x-[18px]" : "translate-x-0"}`}
                    />
                  </button>
                </div>
                <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-accent" />
                      <span className="text-sm font-semibold text-foreground">
                        Auto-Lockout Session
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-accent tabular-nums">
                      {sessionTimeout} min
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="180"
                    step="15"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                    className="w-full accent-accent h-1.5 rounded-lg outline-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                    <span>15 min</span>
                    <span>180 min</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right — Permissions + Password */}
          <div className="lg:col-span-2 space-y-6">
            <Card
              title="Role Scope & Ecosystem Permissions"
              subtitle="Your explicit security credentials matrix"
              edge="accent"
            >
              <div className="-mx-5 -mb-5 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      <th className="px-5 py-3">Permission Scope</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3">Access Area</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {capabilities.map((cap, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`size-1.5 rounded-full shrink-0 ${cap.allowed ? "bg-success" : "bg-destructive"}`}
                            />
                            <span className="font-semibold text-foreground">{cap.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <StatusPill tone={cap.allowed ? "success" : "danger"}>
                            {cap.allowed ? "Allowed" : "Restricted"}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{cap.scope}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <ChangePasswordCard />
          </div>
        </div>
      </div>
    </AppShell>
  );
};
