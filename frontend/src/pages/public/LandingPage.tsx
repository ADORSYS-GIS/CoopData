import { Link } from "@tanstack/react-router";
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
import { useState, useEffect } from "react";

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

function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Ministry Platform
            </p>
            <p className="font-heading text-lg font-bold tracking-tight text-foreground">
              CoopData
            </p>
          </div>
        </Link>
        <nav className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:flex">
          <a href="#mission" className="transition-colors hover:text-primary">
            About
          </a>
          <a href="#sectors" className="transition-colors hover:text-primary">
            Cooperatives
          </a>
          <a href="#capabilities" className="transition-colors hover:text-primary">
            Capabilities
          </a>
          <a href="#faq" className="transition-colors hover:text-primary">
            Help
          </a>
        </nav>
        <div className="flex items-center gap-2.5">
          <Link
            to="/auth/login"
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
          <Link
            to="/app/dashboard"
            className="press-feedback hidden items-center gap-2 rounded-xl bg-primary px-4.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elev-2)] transition-colors hover:bg-primary/95 sm:inline-flex"
          >
            Enter platform <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
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
            Ministry of Commerce & Cooperative Development
          </div>
          <h1 className="animate-hero animate-hero-delay-2 font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-[3.25rem] lg:leading-[1.1] text-foreground">
            The national system for cooperative
            <span className="text-accent block mt-1">data, compliance & oversight.</span>
          </h1>
          <p className="animate-hero animate-hero-delay-3 text-base leading-relaxed text-muted-foreground md:text-lg">
            CoopData centralizes registration, financial reporting, audit and analytics for every
            SACCO, agricultural union, federation and savings group — in one transparent,
            accountable platform.
          </p>
          <div className="animate-hero animate-hero-delay-4 flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              to="/app/dashboard"
              className="press-feedback inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elev-2)] transition-colors hover:bg-primary/95"
            >
              Open the platform <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/auth/login"
              className="press-feedback inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground shadow-[var(--shadow-elev-1)] transition-colors hover:bg-muted/40"
            >
              Sign in with credentials
            </Link>
          </div>
          <dl className="animate-hero animate-hero-delay-4 mt-12 grid max-w-lg grid-cols-3 gap-8 text-sm border-t border-border/80 pt-8">
            {[
              ["12,842", "Registered cooperatives"],
              ["2.4M", "Active members"],
              ["$1.2B", "Combined assets"],
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
  const bars = [40, 55, 45, 65, 75, 60, 85, 95, 70, 80, 90, 100];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface card-edge shadow-[var(--shadow-elev-2)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/20">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Live · National Overview
          </p>
          <p className="mt-0.5 text-xs font-semibold text-foreground">Cooperative Intelligence</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-success">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          Synced
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        <MiniKpi label="Active SACCOs" value="11,420" delta="+4.2%" tone="success" />
        <MiniKpi label="Loan portfolio" value="$842M" delta="1.2% NPL" tone="warning" />
        <MiniKpi label="Women members" value="54.1%" delta="+0.8 pts" tone="success" />
        <MiniKpi label="Compliance" value="92.4" delta="-0.4 pts" tone="warning" />
      </div>
      <div className="px-5 pb-5">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Membership growth — 2025
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
  const items = [
    "Ministry of Commerce",
    "Cooperative Registrar",
    "National Audit Office",
    "Reserve Bank",
    "Bureau of Statistics",
  ];
  return (
    <section className="border-b border-border bg-surface py-5.5 shadow-[var(--shadow-elev-1)]">
      <div className="mx-auto flex flex-wrap items-center justify-between gap-x-10 gap-y-3.5 px-6 lg:px-8 max-w-7xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Operated in partnership with
        </p>
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          {items.map((i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-accent" />
              {i}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Mission() {
  return (
    <section id="mission" className="border-b border-border py-24 bg-surface/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Our mandate
          </p>
          <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl text-foreground text-balance leading-tight">
            Transparent oversight for a thriving cooperative economy.
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
          {[
            {
              icon: ShieldCheck,
              title: "Trust by default",
              body: "Cryptographically auditable submissions and full role-based access — every action is logged.",
              edge: "card-edge-primary" as const,
            },
            {
              icon: BarChart3,
              title: "Evidence-based policy",
              body: "Regulators see real-time membership, capital and compliance data across all sectors.",
              edge: "card-edge-info" as const,
            },
            {
              icon: Globe2,
              title: "Inclusive by design",
              body: "Multi-language interfaces, offline data capture and tablet-first workflows for field officers.",
              edge: "card-edge" as const,
            },
            {
              icon: Lock,
              title: "Built to government standards",
              body: "MFA, device management, WCAG accessibility, and resilient national-scale infrastructure.",
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
  const stats = [
    { v: "12,842", l: "Registered cooperatives", s: "Across 4 regions" },
    { v: "2.4M", l: "Active members", s: "54% women · 38% youth" },
    { v: "$1.2B", l: "Combined savings", s: "+7.2% year on year" },
    { v: "92.4", l: "National compliance score", s: "Median across sectors" },
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
  const sectors = [
    {
      name: "Agricultural Unions",
      count: "5,394",
      desc: "Crop, dairy, livestock and irrigation cooperatives.",
      icon: Building2,
      edge: "card-edge-primary" as const,
    },
    {
      name: "Financial SACCOs",
      count: "3,981",
      desc: "Savings and credit organizations regulated by the Central Bank.",
      icon: Database,
      edge: "card-edge-success" as const,
    },
    {
      name: "Housing Groups",
      count: "1,413",
      desc: "Cooperative housing societies and tenant unions.",
      icon: Building2,
      edge: "card-edge-info" as const,
    },
    {
      name: "Transport Unions",
      count: "1,156",
      desc: "Operator unions, logistics and ride-share cooperatives.",
      icon: Building2,
      edge: "card-edge-warning" as const,
    },
    {
      name: "Artisans & Manufacturing",
      count: "898",
      desc: "Producer collectives and craft federations.",
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
              Sectors served
            </p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight md:text-4xl text-foreground">
              Every cooperative, one registry.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            CoopData supports the full lifecycle of every recognized cooperative structure under
            national law — from registration through dissolution.
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
                  {s.count} active
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
  const caps = [
    {
      icon: Users,
      title: "Role-based access for 6 user types",
      body: "From ministry officials to field officers — every action permissioned and auditable.",
      edge: "card-edge-primary" as const,
    },
    {
      icon: ClipboardListIcon,
      title: "Configurable data collection",
      body: "No-code dynamic questionnaires with conditional logic, validation and approval workflows.",
      edge: "card-edge-success" as const,
    },
    {
      icon: Wifi,
      title: "Offline-first field capture",
      body: "Progressive Web App with background sync and conflict resolution for tablet field officers.",
      edge: "card-edge-warning" as const,
    },
    {
      icon: FileBarChart,
      title: "Regulator-grade reporting",
      body: "Schedule, export and distribute PDF, XLSX, CSV and DOCX reports across the federation network.",
      edge: "card-edge-info" as const,
    },
    {
      icon: BarChart3,
      title: "PowerBI-class analytics",
      body: "Drill-down dashboards, geographic heatmaps, gender and youth indices, time comparisons.",
      edge: "card-edge" as const,
    },
    {
      icon: Lock,
      title: "Security & audit",
      body: "MFA, session management, device control, full audit timeline and access logs.",
      edge: "card-edge-danger" as const,
    },
  ];
  return (
    <section id="capabilities" className="border-b border-border bg-surface py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Capabilities</p>
        <h2 className="font-heading mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl text-foreground">
          A national-scale operating system for the cooperative sector.
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
  const news = [
    {
      tag: "Policy",
      date: "Oct 22, 2025",
      title: "New compliance scoring methodology adopted for Q4 returns",
      body: "All federations must re-baseline their internal scoring against the updated rubric by November 15.",
      edge: "card-edge-warning" as const,
    },
    {
      tag: "Release",
      date: "Oct 18, 2025",
      title: "CoopData v4.2 introduces offline questionnaires for field officers",
      body: "Field officers can now capture full audit visits offline and synchronize on reconnect.",
      edge: "card-edge-success" as const,
    },
    {
      tag: "Notice",
      date: "Oct 10, 2025",
      title: "Mandatory MFA roll-out for all federation accounts",
      body: "All federation users must enable MFA before November 30, 2025.",
      edge: "card-edge-danger" as const,
    },
  ];
  return (
    <section id="announcements" className="border-b border-border py-24 bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border/80 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              News & announcements
            </p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight md:text-4xl text-foreground">
              Updates from the Ministry.
            </h2>
          </div>
          <a
            href="#"
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-accent hover:underline"
          >
            All announcements <ChevronRight className="size-4" />
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
                  Read full update <ChevronRight className="ml-1 size-4" />
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
  const faqs = [
    {
      q: "Who can register on CoopData?",
      a: "Any cooperative recognized under the Cooperative Societies Act may be registered by an authorized federation officer or ministry official.",
    },
    {
      q: "Is the platform accessible offline?",
      a: "Yes — field officers can capture data through the Progressive Web App and synchronize automatically when connectivity is restored.",
    },
    {
      q: "What languages are supported?",
      a: "CoopData ships with English, SiSwati and Portuguese interfaces. Additional languages are added on request.",
    },
    {
      q: "How is my cooperative data protected?",
      a: "All data is encrypted in transit and at rest, with role-based access, multi-factor authentication and full audit logging.",
    },
  ];
  return (
    <section id="faq" className="border-b border-border bg-surface py-24">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          FAQ
        </p>
        <h2 className="font-heading mt-3 text-center text-3xl font-bold tracking-tight md:text-4xl text-foreground">
          Frequently asked.
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
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-10 text-primary-foreground lg:p-14 shadow-xl card-edge-primary">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-accent/20 blur-[100px]" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/75">
            Get access
          </p>
          <h2 className="font-heading mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl text-white leading-tight">
            Empower your cooperative or federation with CoopData today.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-primary-foreground/75">
            Federation officers issue access by invitation. If your organization is registered,
            contact your federation administrator.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Link
              to="/auth/login"
              className="press-feedback inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-accent/90"
            >
              Sign in
            </Link>
            <Link
              to="/app/dashboard"
              className="press-feedback inline-flex items-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              Explore the platform <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 text-sm md:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="size-3.5 text-white" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              CoopData
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A national digital service of the Ministry of Commerce & Cooperative Development.
          </p>
        </div>
        {[
          { h: "Platform", l: ["Cooperatives", "Data Collection", "Reports", "Analytics"] },
          {
            h: "Resources",
            l: ["Documentation", "Help Center", "Onboarding Guides", "API Reference"],
          },
          {
            h: "Legal",
            l: ["Privacy Policy", "Terms of Use", "Accessibility Statement", "Contact"],
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
          <p>
            © {new Date().getFullYear()} Ministry of Commerce & Cooperative Development. All rights
            reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            <span>
              System status: <span className="font-bold text-success">All systems operational</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
