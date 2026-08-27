import { Shield, KeyRound, Mail, Locate, Eye, EyeOff, Loader2, Smartphone } from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useAuth, ROLES, useUserRole } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { useSecuritySettings } from "@/hooks/auth/useSecuritySettings";
import { MfaSetupDialog } from "@/components/shared/MfaSetupDialog";
import { ReEnableMfaDialog } from "@/components/shared/ReEnableMfaDialog";
import { DisableMfaDialog } from "@/components/shared/DisableMfaDialog";
import { ResetMfaDialog } from "@/components/shared/ResetMfaDialog";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function ChangePasswordCard() {
  const { t } = useOrganizationLabelsContext();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showC, setShowC] = useState(false);
  const [showN, setShowN] = useState(false);
  const [showCo, setShowCo] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!current || !next || !confirm) {
      toast.error(t("profile.fillAllFields"));
      return;
    }
    if (next !== confirm) {
      toast.error(t("profile.passwordsNoMatch"));
      return;
    }
    if (next.length < 8) {
      toast.error(t("profile.passwordTooShort"));
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
      toast.success(json.message ?? t("profile.passwordUpdated"));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("profile.unexpectedError"));
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
    <Card title={t("profile.changePassword")} subtitle={t("profile.rotateCredentials")} edge="none">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          {field(t("profile.currentPassword"), current, setCurrent, showC, () => setShowC(!showC))}
          {field(t("profile.newPassword"), next, setNext, showN, () => setShowN(!showN))}
          {field(t("profile.confirmPassword"), confirm, setConfirm, showCo, () =>
            setShowCo(!showCo),
          )}
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
            {t("profile.updatePassword")}
          </button>
        </div>
      </div>
    </Card>
  );
}

export const ProfilePage: React.FC = () => {
  const { t, replaceOrgTerms } = useOrganizationLabelsContext();
  const { user } = useAuth();
  const role = useUserRole();
  const { data: security, isLoading: securityLoading } = useSecuritySettings();
  const mfaEnabled = security?.mfa_enabled ?? false;
  const mfaConfigured = security?.mfa_configured ?? false;
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [mfaReenableOpen, setMfaReenableOpen] = useState(false);
  const [mfaDisableOpen, setMfaDisableOpen] = useState(false);
  const [mfaResetOpen, setMfaResetOpen] = useState(false);

  const handleToggleMfa = async () => {
    if (!mfaEnabled) {
      if (mfaConfigured) {
        // Soft-disabled: the credential was preserved, so re-enable with the
        // existing authenticator entry — no new QR code needed.
        setMfaReenableOpen(true);
      } else {
        // Never set up: two-step flow — open the inline QR setup dialog.
        setMfaSetupOpen(true);
      }
      return;
    }
    // Disabling requires password confirmation.
    setMfaDisableOpen(true);
  };

  if (!role || !user) return null;

  const currentRole = ROLES.find((r) => r.id === role) || { label: "Workspace Member" };

  const getRoleCapabilities = () => {
    switch (role) {
      case "ministry":
        return [
          {
            name: t("profile.caps.userProvisioning"),
            allowed: true,
            scope: t("profile.caps.scope.regionalCoopManagers"),
          },
          {
            name: t("profile.caps.filingApprovals"),
            allowed: true,
            scope: t("profile.caps.scope.nationalCompliance"),
          },
          {
            name: t("profile.caps.auditTrails"),
            allowed: true,
            scope: t("profile.caps.scope.viewOnly"),
          },
          {
            name: t("profile.caps.systemConfig"),
            allowed: true,
            scope: t("profile.caps.scope.nationalSettings"),
          },
          {
            name: t("profile.caps.viewAllCoops"),
            allowed: true,
            scope: t("profile.caps.scope.nationalScope"),
          },
        ];
      case "federation":
        return [
          {
            name: t("profile.caps.userProvisioning"),
            allowed: true,
            scope: t("profile.caps.scope.coopManagersFed"),
          },
          {
            name: t("profile.caps.filingApprovals"),
            allowed: true,
            scope: t("profile.caps.scope.federationSubmissions"),
          },
          {
            name: t("profile.caps.auditTrails"),
            allowed: true,
            scope: t("profile.caps.scope.federationScope"),
          },
          {
            name: t("profile.caps.viewCooperatives"),
            allowed: true,
            scope: t("profile.caps.scope.federationScope"),
          },
          {
            name: t("profile.caps.generateReports"),
            allowed: true,
            scope: t("profile.caps.scope.federationScope"),
          },
        ];
      case "apex":
        return [
          {
            name: t("profile.caps.reviewSubmissions"),
            allowed: true,
            scope: t("profile.caps.scope.coopsUnderApex"),
          },
          {
            name: t("profile.caps.approveReject"),
            allowed: true,
            scope: t("profile.caps.scope.coopSubmissions"),
          },
          {
            name: t("profile.caps.manageCoops"),
            allowed: true,
            scope: t("profile.caps.scope.apexScope"),
          },
          {
            name: t("profile.caps.createCoopUsers"),
            allowed: true,
            scope: t("profile.caps.scope.apexScope"),
          },
          {
            name: t("profile.caps.generateReports"),
            allowed: true,
            scope: t("profile.caps.scope.apexScope"),
          },
        ];
      case "cooperative":
        return [
          {
            name: t("profile.caps.filingReturns"),
            allowed: true,
            scope: t("profile.caps.scope.ownCoopOnly"),
          },
          {
            name: t("profile.caps.manageRoster"),
            allowed: true,
            scope: t("profile.caps.scope.ownCoopOnly"),
          },
          {
            name: t("profile.caps.viewOwnReports"),
            allowed: true,
            scope: t("profile.caps.scope.ownCoopOnly"),
          },
          {
            name: t("profile.caps.submitStatements"),
            allowed: true,
            scope: t("profile.caps.scope.ownCoopOnly"),
          },
        ];
      default:
        return [];
    }
  };

  const capabilities = getRoleCapabilities();
  const allowedCount = capabilities.filter((c) => c.allowed).length;

  return (
    <AppShell title={t("profile.title")} subtitle={t("profile.subtitle")}>
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
                <StatusPill tone="success">{t("profile.activeSession")}</StatusPill>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {replaceOrgTerms(currentRole.label)}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-accent" /> {user.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Locate className="size-3.5 text-accent" /> {user.region} {t("profile.region")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="size-3.5 text-accent" /> {allowedCount} {t("profile.of")}{" "}
                  {capabilities.length} {t("profile.permissionsGranted")}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left — Security & Language */}
          <div className="lg:col-span-1 space-y-6">
            <Card
              title={t("profile.securityPreferences")}
              subtitle={t("profile.accountProtection")}
              edge="warning"
            >
              <div className="space-y-4">
                <div className="flex flex-col p-4 rounded-xl border border-border bg-muted/30 gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="size-4 text-accent" />
                        <p className="text-sm font-semibold text-foreground">{t("profile.mfa")}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {mfaEnabled
                          ? t("profile.mfaDesc")
                          : mfaConfigured
                            ? t(
                                "profile.mfaSoftDisabledDesc",
                                "Disabled — your authenticator entry is preserved",
                              )
                            : t("profile.mfaDesc")}
                      </p>
                    </div>
                    <div className="pt-0.5 shrink-0">
                      <button
                        onClick={handleToggleMfa}
                        disabled={securityLoading}
                        role="switch"
                        aria-checked={mfaEnabled}
                        aria-label={t("profile.mfa")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
                          mfaEnabled ? "bg-success border-success" : "bg-muted border-border"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span
                          className={`pointer-events-none inline-block size-[18px] rounded-full bg-surface shadow-sm transition-transform flex items-center justify-center ${
                            mfaEnabled ? "translate-x-[18px]" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {mfaEnabled && (
                    <div className="pt-3 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => setMfaResetOpen(true)}
                        disabled={securityLoading}
                        className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent/5 px-4 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/10 hover:shadow-sm active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Smartphone className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:rotate-[-5deg]" />
                        {t("profile.mfaChangeDevice", "Change device")}
                      </button>
                    </div>
                  )}
                </div>
                {securityLoading && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    {t("profile.loadingSecurity")}
                  </p>
                )}
              </div>
            </Card>

            <Card
              title={t("profile.languagePreference")}
              subtitle={t("profile.chooseLanguage")}
              edge="info"
            >
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("profile.languageDesc")}
                </p>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/30">
                  <span className="text-sm font-semibold text-foreground">
                    {t("profile.language")}
                  </span>
                  <div className="ml-auto">
                    <LanguageSwitcher />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right — Permissions + Password */}
          <div className="lg:col-span-2 space-y-6">
            <Card
              title={t("profile.roleScope")}
              subtitle={t("profile.securityCredentialsMatrix")}
              edge="accent"
            >
              <div className="-mx-5 -mb-5 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      <th className="px-5 py-3">{t("profile.permissionScope")}</th>
                      <th className="px-5 py-3 text-center">{t("profile.status")}</th>
                      <th className="px-5 py-3">{t("profile.accessArea")}</th>
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
                            {cap.allowed ? t("profile.allowed") : t("profile.restricted")}
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

      <MfaSetupDialog open={mfaSetupOpen} onOpenChange={setMfaSetupOpen} />
      <ReEnableMfaDialog open={mfaReenableOpen} onOpenChange={setMfaReenableOpen} />
      <DisableMfaDialog open={mfaDisableOpen} onOpenChange={setMfaDisableOpen} />
      <ResetMfaDialog open={mfaResetOpen} onOpenChange={setMfaResetOpen} />
    </AppShell>
  );
};
