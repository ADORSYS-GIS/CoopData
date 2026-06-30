import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  ArrowRight,
  Landmark,
  UserCog,
  Users,
  ClipboardList,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ROLES, ROLE_USERS, type Role } from "@/constants/roles";
import { redirectIfAuthenticated } from "@/lib/route-guards";

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role>("ministry");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/app/dashboard" });
    }
  }, [isAuthenticated, navigate]);

  const handleKeycloakLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Keycloak login failed:", error);
    }
  };

  const getIcon = (iconName: string) => {
    const map: Record<string, React.ElementType> = {
      Landmark,
      UserCog,
      Users,
      ClipboardList,
    };
    return map[iconName] ?? Landmark;
  };

  const activeUser = ROLE_USERS[selectedRole];

  return (
    <div className="min-h-dvh grid lg:grid-cols-5 bg-background">
      {/* Left Brand Panel */}
      <aside className="hidden lg:flex lg:col-span-2 flex-col justify-between bg-primary text-primary-foreground p-10 relative overflow-hidden">
        {/* Geometric background pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--primary-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--primary-foreground) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -left-16 bottom-1/3 size-64 rounded-full bg-accent/15 blur-3xl" />

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 relative z-10">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent shadow-lg">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/50">
              Ministry Platform
            </p>
            <p className="font-heading text-[15px] font-bold tracking-tight">CoopData</p>
          </div>
        </Link>

        {/* Main brand content */}
        <div className="relative z-10 space-y-6">
          <div className="flex size-12 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/30">
            <Lock className="size-5 text-accent" />
          </div>
          <div>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance leading-snug">
              Trusted access for every cooperative stakeholder.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
              CoopData enforces role-based access and device verification for every ministry
              official, federation officer, cooperative manager, and regional officer.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "Role-specific dashboards and permissions",
              "Secure data submission and validation",
              "Full audit trail on every action",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-sm text-primary-foreground/80"
              >
                <CheckCircle2 className="size-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-primary-foreground/40 relative z-10">
          © {new Date().getFullYear()} Ministry of Commerce & Cooperative Development
        </p>
      </aside>

      {/* Right Form Panel */}
      <main
        className={`flex flex-col lg:col-span-3 overflow-y-auto transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1, 0.3, 1)" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 lg:px-10 border-b border-border bg-surface/60 backdrop-blur-sm">
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1.5"
          >
            ← Back to home
          </Link>
          <p className="text-xs text-muted-foreground">
            Need access?{" "}
            <a href="#" className="font-semibold text-accent hover:underline">
              Request invitation
            </a>
          </p>
        </div>

        {/* Form content */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10 lg:px-14 xl:px-20 max-w-3xl mx-auto w-full">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-accent/20 mb-5">
              <ShieldCheck className="size-3.5" /> Secure Platform
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Sign in to CoopData
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Authenticate via your organization's identity provider.
            </p>
          </div>

          {/* Keycloak Login Button */}
          <button
            onClick={handleKeycloakLogin}
            disabled={isLoading}
            className="press-feedback inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Connecting…
              </>
            ) : (
              <>
                <Lock className="size-4" />
                Sign in with Keycloak
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          {/* Development mock login section */}
          {import.meta.env.DEV && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dev Mode
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Quick Role Switch (Dev Only)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {ROLES.map((role) => {
                    const IconComponent = getIcon(role.icon);
                    const isSelected = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRole(role.id)}
                        className={[
                          "flex flex-col items-start text-left p-4 rounded-xl border transition-all duration-200 press-feedback",
                          isSelected
                            ? "border-accent bg-accent/5 shadow-[0_0_0_2px_oklch(0.5_0.17_240/0.25),inset_0_3px_0_var(--accent)]"
                            : "border-border bg-surface hover:bg-muted/40 hover:border-border/80",
                        ].join(" ")}
                      >
                        <div
                          className={`flex size-8 items-center justify-center rounded-lg mb-3 transition-colors ${
                            isSelected ? "bg-accent text-white" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <IconComponent className="size-4" />
                        </div>
                        <p
                          className={`text-xs font-bold ${isSelected ? "text-accent" : "text-foreground"}`}
                        >
                          {role.shortLabel}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                          {role.description.split("—")[1]?.trim() || role.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface overflow-hidden mt-4">
                <div className="p-5 flex flex-col justify-between gap-4">
                  <div className="bg-muted/60 rounded-lg p-3.5 text-xs leading-relaxed space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Persona:</span>
                      <span className="text-muted-foreground">{activeUser.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Access level:</span>
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        {selectedRole.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Region:</span>
                      <span className="text-muted-foreground">{activeUser.region}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground text-center mt-6">
            By signing in you acknowledge this is the official CoopData platform for the Ministry of
            Commerce & Cooperative Development of Eswatini.
          </p>
        </div>
      </main>
    </div>
  );
};
