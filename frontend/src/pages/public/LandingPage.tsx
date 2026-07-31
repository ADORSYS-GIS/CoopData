import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Building2,
  BarChart3,
  Globe2,
  CheckCircle2,
  Users,
  FileBarChart,
  Lock,
  Database,
  Wifi,
  ClipboardList as ClipboardListIcon,
  ChevronRight,
  TrendingUp,
  UserCog,
  Landmark,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { ROLE_DEFAULT_ROUTE } from "@/constants/roles";
import { useTranslation } from "react-i18next";

export const LandingPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`min-h-dvh bg-background text-foreground transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}
    >
      <PublicHeader />
      <Hero />
      <TrustStrip />
      <Mission />
      <Stats />
      <Sectors />
      <Capabilities />
      <Announcements />
      <FAQ />
      <CTA />
      <PublicFooter />
    </div>
  );
};

function useLoginRedirect() {
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const handleLogin = useCallback(async () => {
    // If still loading, wait for auth check to complete first
    if (isLoading) return;
    if (isAuthenticated && user) {
      navigate({ to: ROLE_DEFAULT_ROUTE[user.role] });
    } else {
      await login();
    }
  }, [login, isAuthenticated, isLoading, user, navigate]);

  return handleLogin;
}

function PublicHeader() {
  const { t } = useTranslation();
  const handleLogin = useLoginRedirect();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/coopdatalogo.png"
            alt={t("common.logoAlt")}
            className="size-16 shrink-0 rounded-lg object-contain"
          />
        </Link>
        <nav className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:flex">
          <a href="#mission" className="transition-colors hover:text-primary">
            {t("landing.header.about")}
          </a>
          <a href="#sectors" className="transition-colors hover:text-primary">
            {t("landing.header.cooperatives")}
          </a>
          <a href="#capabilities" className="transition-colors hover:text-primary">
            {t("landing.header.capabilities")}
          </a>
          <a href="#faq" className="transition-colors hover:text-primary">
            {t("landing.header.help")}
          </a>
        </nav>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleLogin}
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {t("landing.header.signIn")}
          </button>
          <button
            onClick={handleLogin}
            className="press-feedback hidden items-center gap-2 rounded-xl bg-primary px-4.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elev-2)] transition-colors hover:bg-primary/95 sm:inline-flex"
          >
            {t("landing.header.enterPlatform")} <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useTranslation();
  const handleLogin = useLoginRedirect();

  return (
    <section className="relative overflow-hidden border-b border-border bg-surface/40">
      {/* Grid Pattern */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      {/* Decorative Blur Orbs */}
      <div className="absolute -right-40 top-0 -z-10 size-[500px] rounded-full bg-accent/10 blur-[100px]" />
      <div className="absolute -left-20 bottom-0 -z-10 size-[400px] rounded-full bg-success/5 blur-[90px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-20 lg:grid-cols-12 lg:px-8 lg:gap-10">
        <div className="lg:col-span-7 space-y-6">
          <div className="animate-hero animate-hero-delay-1 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3.5 py-1.5 text-xs font-semibold ring-1 ring-accent/20 text-accent">
            <Landmark className="size-3.5" />
            {t("landing.hero.badge")}
          </div>
          <h1 className="animate-hero animate-hero-delay-2 font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-[3.25rem] lg:leading-[1.1] text-foreground">
            {t("landing.hero.title1")}
            <span className="text-accent block mt-1">{t("landing.hero.title2")}</span>
          </h1>
          <p className="animate-hero animate-hero-delay-3 text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("landing.hero.subtitle")}
          </p>
          <div className="animate-hero animate-hero-delay-4 flex flex-wrap items-center gap-3.5 pt-2">
            <button
              onClick={handleLogin}
              className="press-feedback inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elev-2)] transition-colors hover:bg-primary/95"
            >
              {t("landing.hero.openPlatform")} <ArrowRight className="size-4" />
            </button>
            <button
              onClick={handleLogin}
              className="press-feedback inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground shadow-[var(--shadow-elev-1)] transition-colors hover:bg-muted/40"
            >
              {t("landing.hero.signInCredentials")}
            </button>
          </div>
          <dl className="animate-hero animate-hero-delay-4 mt-12 grid max-w-lg grid-cols-3 gap-8 text-sm border-t border-border/80 pt-8">
            {[
              ["12,842", t("landing.hero.statRegCoops")],
              ["2.4M", t("landing.hero.statActiveMembers")],
              ["$1.2B", t("landing.hero.statCombinedAssets")],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-heading text-2xl font-bold tracking-tight text-foreground num">
                  {v}
                </dt>
                <dd className="mt-1 text-xs text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-5 animate-panel">
          <HeroPanel />
        </div>
      </div>
    </section>
  );
}

function HeroPanel() {
  const { t } = useTranslation();
  const bars = [40, 55, 45, 65, 75, 60, 85, 95, 70, 80, 90, 100];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface card-edge shadow-[var(--shadow-elev-2)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/20">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("landing.heroPanel.liveOverview")}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-foreground">
            {t("landing.heroPanel.intelligence")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-success">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          {t("landing.heroPanel.synced")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        <MiniKpi
          label={t("landing.heroPanel.activeSaccos")}
          value="11,420"
          delta="+4.2%"
          tone="success"
        />
        <MiniKpi
          label={t("landing.heroPanel.loanPortfolio")}
          value="$842M"
          delta="1.2% NPL"
          tone="warning"
        />
        <MiniKpi
          label={t("landing.heroPanel.womenMembers")}
          value="54.1%"
          delta="+0.8 pts"
          tone="success"
        />
        <MiniKpi
          label={t("landing.heroPanel.compliance")}
          value="92.4"
          delta="-0.4 pts"
          tone="warning"
        />
      </div>
      <div className="px-5 pb-5">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("landing.heroPanel.membershipGrowth")}
        </p>
        <div className="flex h-24 items-end gap-1.5 pt-4">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t transition-colors ${
                i === bars.length - 1 ? "bg-accent animate-pulse" : "bg-accent/15"
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "success" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "text-success bg-success/10 ring-success/20"
      : "text-warning-foreground bg-warning/10 ring-warning/20";
  return (
    <div className="rounded-xl border border-border p-3.5 bg-surface hover:shadow-sm transition-shadow">
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold tracking-tight text-foreground num">
        {value}
      </p>
      <p
        className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${toneCls}`}
      >
        {delta}
      </p>
    </div>
  );
}

function TrustStrip() {
  const { t } = useTranslation();
  const partners = [
    { src: "/partner-1.webp", alt: "Partner 1" },
    { src: "/partner-2.webp", alt: "Partner 2" },
    { src: "/partner-3.webp", alt: "Partner 3" },
    { src: "/partner-4.png", alt: "Partner 4" },
    { src: "/partner-5.png", alt: "Partner 5" },
    { src: "/partner-7.png", alt: "Partner 7" },
    { src: "/partner-8.png", alt: "Partner 8" },
    { src: "/partner-9.png", alt: "Partner 9" },
  ];

  return (
    <section className="border-y border-border bg-muted/30 py-16 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-10">
          {t("landing.partners.title")}
        </p>
        <PartnerCarousel partners={partners} />
      </div>
    </section>
  );
}

function PartnerCarousel({ partners }: { partners: { src: string; alt: string }[] }) {
  // Duplicate the list to create a seamless infinite loop
  const doubled = [...partners, ...partners];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        // Fade edges
        maskImage:
          "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
      }}
    >
      <div
        className="flex items-center gap-12 lg:gap-16 w-max"
        style={{
          animation: "partner-scroll 28s linear infinite",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.animationPlayState = "paused")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLDivElement).style.animationPlayState = "running")
        }
      >
        {doubled.map((partner, i) => (
          <div key={i} className="shrink-0 flex items-center justify-center px-2">
            <img
              src={partner.src}
              alt={partner.alt}
              className="h-14 w-auto max-w-[140px] object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Inject keyframes via a style tag */}
      <style>{`
        @keyframes partner-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function Mission() {
  const { t } = useTranslation();
  return (
    <section id="mission" className="border-b border-border py-24 bg-surface/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t("landing.mission.badge")}
          </p>
          <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl text-foreground text-balance leading-tight">
            {t("landing.mission.title")}
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
          {[
            {
              icon: ShieldCheck,
              title: t("landing.mission.trustTitle"),
              body: t("landing.mission.trustBody"),
              edge: "card-edge-primary" as const,
            },
            {
              icon: BarChart3,
              title: t("landing.mission.evidenceTitle"),
              body: t("landing.mission.evidenceBody"),
              edge: "card-edge-info" as const,
            },
            {
              icon: Globe2,
              title: t("landing.mission.inclusiveTitle"),
              body: t("landing.mission.inclusiveBody"),
              edge: "card-edge" as const,
            },
            {
              icon: Lock,
              title: t("landing.mission.govtTitle"),
              body: t("landing.mission.govtBody"),
              edge: "card-edge-success" as const,
            },
          ].map((c) => (
            <div
              key={c.title}
              className="group relative overflow-hidden rounded-2xl bg-surface/40 p-8 transition-all hover:bg-surface hover:shadow-md border border-border/50"
            >
              <div className="absolute -right-6 -top-6 text-accent/5 transition-transform duration-500 group-hover:scale-110 group-hover:text-accent/10">
                <c.icon className="size-32" />
              </div>
              <div className="relative">
                <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent shadow-sm">
                  <c.icon className="size-6" />
                </div>
                <h3 className="font-heading mt-6 text-lg font-bold text-foreground">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const { t } = useTranslation();
  const stats = [
    { v: "12,842", l: t("landing.hero.statRegCoops"), s: t("landing.stats.regionsSub") },
    { v: "2.4M", l: t("landing.hero.statActiveMembers"), s: t("landing.stats.membersSub") },
    { v: "$1.2B", l: t("landing.stats.combinedSavings"), s: t("landing.stats.savingsSub") },
    { v: "92.4", l: t("landing.stats.nationalCompliance"), s: t("landing.stats.complianceSub") },
  ];
  return (
    <section className="bg-primary py-20 text-primary-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(var(--primary-foreground) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8 relative z-10">
        {stats.map((s) => (
          <div key={s.l} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/50">
              {s.l}
            </p>
            <p className="font-heading text-4xl font-bold tracking-tight num text-white">{s.v}</p>
            <p className="text-xs text-primary-foreground/75 font-medium">{s.s}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Sectors() {
  const { t } = useTranslation();
  const sectors = [
    {
      name: t("landing.sectors.agriTitle"),
      count: "5,394",
      desc: t("landing.sectors.agriDesc"),
      icon: Building2,
      edge: "card-edge-primary" as const,
    },
    {
      name: t("landing.sectors.saccoTitle"),
      count: "3,981",
      desc: t("landing.sectors.saccoDesc"),
      icon: Database,
      edge: "card-edge-success" as const,
    },
    {
      name: t("landing.sectors.housingTitle"),
      count: "1,413",
      desc: t("landing.sectors.housingDesc"),
      icon: Building2,
      edge: "card-edge-info" as const,
    },
    {
      name: t("landing.sectors.transportTitle"),
      count: "1,156",
      desc: t("landing.sectors.transportDesc"),
      icon: Building2,
      edge: "card-edge-warning" as const,
    },
    {
      name: t("landing.sectors.artisanTitle"),
      count: "898",
      desc: t("landing.sectors.artisanDesc"),
      icon: Building2,
      edge: "card-edge" as const,
    },
  ];
  return (
    <section id="sectors" className="border-b border-border py-24 bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border/80 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {t("landing.sectors.badge")}
            </p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight md:text-4xl text-foreground">
              {t("landing.sectors.title")}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("landing.sectors.subtitle")}
          </p>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s) => (
            <li
              key={s.name}
              className={`flex flex-col justify-between rounded-xl border border-border bg-background p-6 shadow-sm transition-transform hover:-translate-y-1 ${s.edge}`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <h3 className="font-heading text-base font-bold text-foreground">{s.name}</h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/50">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-success">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  {s.count} {t("landing.sectors.active")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Capabilities() {
  const { t } = useTranslation();
  const caps = [
    {
      icon: Users,
      title: t("landing.capabilities.rbacTitle"),
      body: t("landing.capabilities.rbacBody"),
      edge: "card-edge-primary" as const,
    },
    {
      icon: ClipboardListIcon,
      title: t("landing.capabilities.dataTitle"),
      body: t("landing.capabilities.dataBody"),
      edge: "card-edge-success" as const,
    },
    {
      icon: Wifi,
      title: t("landing.capabilities.offlineTitle"),
      body: t("landing.capabilities.offlineBody"),
      edge: "card-edge-warning" as const,
    },
    {
      icon: FileBarChart,
      title: t("landing.capabilities.reportingTitle"),
      body: t("landing.capabilities.reportingBody"),
      edge: "card-edge-info" as const,
    },
    {
      icon: BarChart3,
      title: t("landing.capabilities.analyticsTitle"),
      body: t("landing.capabilities.analyticsBody"),
      edge: "card-edge" as const,
    },
    {
      icon: Lock,
      title: t("landing.capabilities.securityTitle"),
      body: t("landing.capabilities.securityBody"),
      edge: "card-edge-danger" as const,
    },
  ];
  return (
    <section id="capabilities" className="border-b border-border bg-surface py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t("landing.capabilities.badge")}
        </p>
        <h2 className="font-heading mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl text-foreground">
          {t("landing.capabilities.title")}
        </h2>
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {caps.map((c) => (
            <li
              key={c.title}
              className="flex items-start gap-4 p-4 rounded-xl transition-colors hover:bg-surface/60"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-4 ring-accent/5">
                <c.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">{c.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Announcements() {
  const { t } = useTranslation();
  const news = [
    {
      tag: "Policy",
      date: "Oct 22, 2025",
      title: t("landing.announcements.news1Title"),
      body: t("landing.announcements.news1Body"),
      edge: "card-edge-warning" as const,
    },
    {
      tag: "Release",
      date: "Oct 18, 2025",
      title: t("landing.announcements.news2Title"),
      body: t("landing.announcements.news2Body"),
      edge: "card-edge-success" as const,
    },
    {
      tag: "Notice",
      date: "Oct 10, 2025",
      title: t("landing.announcements.news3Title"),
      body: t("landing.announcements.news3Body"),
      edge: "card-edge-danger" as const,
    },
  ];
  return (
    <section id="announcements" className="border-b border-border py-24 bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border/80 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {t("landing.announcements.badge")}
            </p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight md:text-4xl text-foreground">
              {t("landing.announcements.title")}
            </h2>
          </div>
          <a
            href="#"
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-accent hover:underline"
          >
            {t("landing.announcements.allLink")} <ChevronRight className="size-4" />
          </a>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {news.map((n) => (
            <li
              key={n.title}
              className={`flex flex-col rounded-xl bg-surface/40 p-6 transition-all hover:bg-surface hover:shadow-sm ${n.edge}`}
            >
              <div className="mb-4 flex items-center gap-3 text-xs">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                  {n.tag}
                </span>
                <span className="text-muted-foreground">{n.date}</span>
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground leading-tight">
                {n.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                {n.body}
              </p>
              <div className="mt-auto pt-4">
                <a
                  href="#"
                  className="inline-flex items-center text-sm font-semibold text-accent hover:underline"
                >
                  {t("landing.announcements.readFull")} <ChevronRight className="ml-1 size-4" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useTranslation();
  const faqs = [
    {
      q: t("landing.faq.q1"),
      a: t("landing.faq.a1"),
    },
    {
      q: t("landing.faq.q2"),
      a: t("landing.faq.a2"),
    },
    {
      q: t("landing.faq.q3"),
      a: t("landing.faq.a3"),
    },
    {
      q: t("landing.faq.q4"),
      a: t("landing.faq.a4"),
    },
  ];
  return (
    <section id="faq" className="border-b border-border bg-surface py-24">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t("landing.faq.badge")}
        </p>
        <h2 className="font-heading mt-3 text-center text-3xl font-bold tracking-tight md:text-4xl text-foreground">
          {t("landing.faq.title")}
        </h2>
        <ul className="mt-12 divide-y divide-border rounded-xl border border-border bg-background shadow-sm overflow-hidden">
          {faqs.map((f) => (
            <li key={f.q} className="p-6 bg-surface/50 hover:bg-surface transition-colors">
              <p className="flex items-start gap-2.5 text-sm font-bold text-foreground">
                <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" /> {f.q}
              </p>
              <p className="mt-2 pl-7 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="p-6 border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left font-semibold text-foreground text-sm"
      >
        <span className="flex items-center gap-2.5">
          <CheckCircle2 className="size-4.5 text-success shrink-0" />
          {q}
        </span>
        <ChevronRight
          className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"}`}
      >
        <p className="overflow-hidden pl-7 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </div>
    </li>
  );
}

function CTA() {
  const { t } = useTranslation();
  const handleLogin = useLoginRedirect();

  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-10 text-primary-foreground lg:p-14 shadow-xl card-edge-primary">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-accent/20 blur-[100px]" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/75">
            {t("landing.cta.badge")}
          </p>
          <h2 className="font-heading mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl text-white leading-tight">
            {t("landing.cta.title")}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-primary-foreground/75">
            {t("landing.cta.desc")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <button
              onClick={handleLogin}
              className="press-feedback inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-accent/90"
            >
              {t("landing.header.signIn")}
            </button>
            <button
              onClick={handleLogin}
              className="press-feedback inline-flex items-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              {t("landing.cta.explore")} <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 text-sm md:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src="/coopdatalogo.png"
              alt={t("common.logoAlt")}
              className="size-14 shrink-0 rounded-lg object-contain"
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("landing.footer.badge")}
          </p>
        </div>
        {[
          {
            h: t("landing.footer.platformCol"),
            l: [
              t("landing.footer.platform.cooperatives"),
              t("landing.footer.platform.dataCollection"),
              t("landing.footer.platform.reports"),
              t("landing.footer.platform.analytics"),
            ],
          },
          {
            h: t("landing.footer.resourcesCol"),
            l: [
              t("landing.footer.resources.documentation"),
              t("landing.footer.resources.helpCenter"),
              t("landing.footer.resources.onboardingGuides"),
              t("landing.footer.resources.apiReference"),
            ],
          },
          {
            h: t("landing.footer.legalCol"),
            l: [
              t("landing.footer.legal.privacyPolicy"),
              t("landing.footer.legal.termsOfUse"),
              t("landing.footer.legal.accessibilityStatement"),
              t("landing.footer.legal.contact"),
            ],
          },
        ].map((c) => (
          <div key={c.h} className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {c.h}
            </p>
            <ul className="space-y-2 text-xs font-semibold text-muted-foreground/90">
              {c.l.map((i) => (
                <li key={i}>
                  <a href="#" className="transition-colors hover:text-primary">
                    {i}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/80 bg-muted/10">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground lg:px-8 max-w-7xl">
          <p>{t("landing.footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            <span>
              {t("landing.footer.systemStatus")}{" "}
              <span className="font-bold text-success">{t("landing.footer.allOperational")}</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
