import { createFileRoute } from "@tanstack/react-router";
import {
  User,
  Shield,
  KeyRound,
  History,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  BadgeAlert,
  Fingerprint,
  Mail,
  Locate,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  Activity,
  Clock,
  Monitor,
  Smartphone,
  Globe,
} from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useAuth, ROLES } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "My Profile — CoopData" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { role, user } = useAuth();

  const [mfaActive, setMfaActive] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [passwords, setPasswords] = useState({ current: "", newPassword: "", confirm: "" });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const currentRole = ROLES.find((r) => r.id === role) || {
    label: "Workspace Member",
    description: "Standard account",
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.newPassword || !passwords.confirm) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    toast.success("Password updated successfully!");
    setPasswords({ current: "", newPassword: "", confirm: "" });
  };

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

  const renderOrgDetails = () => {
    switch (role) {
      case "ministry":
        return [
          { label: "Department", value: "Directorate of Cooperative Societies" },
          { label: "Ministry", value: "Ministry of Commerce, Industry & Trade" },
          { label: "Office", value: "Government Headquarters, Mbabane" },
          { label: "Authority Code", value: "MCT-COORD-001", mono: true },
        ];
      case "federation":
        return [
          { label: "Federation Division", value: "Manzini Regional Cooperative Federation" },
          { label: "Primary Office", value: "Office 4, Central Union Building, Manzini" },
          { label: "Cooperatives Under Management", value: "142 registered cooperatives" },
          { label: "Federation License Code", value: "FED-MZN-2012", mono: true },
        ];
      case "apex":
        return [
          { label: "Apex Organization", value: "Hhohho & Lubombo Apex Cooperative Union" },
          { label: "Primary Office", value: "Apex Building, Mbabane" },
          { label: "Cooperatives Under Management", value: "28 registered cooperatives" },
          { label: "Apex License Code", value: "APEX-HH-LB-001", mono: true },
        ];
      case "cooperative":
        return [
          { label: "Registered Cooperative", value: "Lubombo Dairy Cooperative" },
          { label: "Registration Number", value: "COP-2015-00214", mono: true },
          { label: "Sector", value: "Agricultural Unions" },
          { label: "District Registry Office", value: "Siteki Hub" },
        ];
      default:
        return [];
    }
  };

  const sessionLogs = [
    {
      date: "Today, 10:02 AM",
      ip: "197.104.22.84",
      device: "Chrome 124.0 (Linux x86_64)",
      deviceType: "desktop" as const,
      region: user.region,
      status: "active" as const,
    },
    {
      date: "Yesterday, 02:40 PM",
      ip: "197.104.22.84",
      device: "Chrome 124.0 (Linux x86_64)",
      deviceType: "desktop" as const,
      region: user.region,
      status: "closed" as const,
    },
    {
      date: "June 14, 2026, 09:12 AM",
      ip: "196.44.110.12",
      device: "Firefox 120 (Android)",
      deviceType: "mobile" as const,
      region: "Manzini",
      status: "closed" as const,
    },
    {
      date: "June 10, 2026, 08:30 AM",
      ip: "197.104.22.84",
      device: "Safari 17 (macOS)",
      deviceType: "desktop" as const,
      region: user.region,
      status: "closed" as const,
    },
  ];

  const capabilities = getRoleCapabilities();
  const allowedCount = capabilities.filter((c) => c.allowed).length;

  return (
    <AppShell
      title="User Profile"
      subtitle="Manage your identity settings and security configurations"
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ── Hero Profile Card ── */}
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
          {/* ── Left Column ── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Organization Details */}
            <Card title="Organization Details" subtitle="Workspace association" edge="info">
              <div className="space-y-0">
                {renderOrgDetails().map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex justify-between items-start gap-3 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                    <span
                      className={`text-xs text-right ${row.mono ? "font-mono text-[11px]" : "font-semibold"} text-foreground`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Security Preferences */}
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
                      toast.success(`MFA security set to ${!mfaActive ? "ENABLED" : "DISABLED"}`);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      mfaActive ? "bg-success border-success" : "bg-muted border-border"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block size-[18px] rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out ${
                        mfaActive ? "translate-x-[18px]" : "translate-x-0"
                      }`}
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

          {/* ── Right Column ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Permissions Matrix */}
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
                      <tr key={i} className="hover:bg-muted/30 transition-colors group">
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

            {/* Change Password */}
            <Card
              title="Change Account Password"
              subtitle="Rotate your credentials securely"
              edge="none"
            >
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        required
                        value={passwords.current}
                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrentPw ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        required
                        value={passwords.newPassword}
                        onChange={(e) =>
                          setPasswords({ ...passwords, newPassword: e.target.value })
                        }
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-foreground">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        required
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPw ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm press-feedback"
                  >
                    <KeyRound className="size-4" /> Update password
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>

        {/* ── Session Access Logs ── */}
        <Card
          title="Recent Session Access Logs"
          subtitle="Verify locations and devices utilized for account login"
          edge="none"
        >
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Login Date</th>
                  <th className="px-5 py-3">IP Address</th>
                  <th className="px-5 py-3">Device Agent</th>
                  <th className="px-5 py-3">Region</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessionLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-semibold text-foreground">{log.date}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground">{log.ip}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {log.deviceType === "desktop" ? (
                          <Monitor className="size-3.5 text-accent shrink-0" />
                        ) : (
                          <Smartphone className="size-3.5 text-accent shrink-0" />
                        )}
                        <span>{log.device}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{log.region} Region</td>
                    <td className="px-5 py-3 text-center">
                      <StatusPill tone={log.status === "active" ? "success" : "neutral"}>
                        {log.status === "active" ? "Active" : "Closed"}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
