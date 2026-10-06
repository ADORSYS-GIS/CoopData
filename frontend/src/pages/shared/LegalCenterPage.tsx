// frontend/src/pages/shared/LegalCenterPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";
import { LegalDocumentViewer } from "@/components/shared/LegalDocumentViewer";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { useTranslation } from "react-i18next";
import { normalizeAppLang } from "@/lib/contentLocalization";
import { Mail, FileText, ArrowLeft, Scale, PenTool } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";

export const LegalCenterPage: React.FC = () => {
  const { policies, isLoading } = useLegalDocuments();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { doc?: string };
  const { t, i18n } = useTranslation();
  // The documents follow the app language; the selector changes both together.
  const lang = normalizeAppLang(i18n.resolvedLanguage ?? i18n.language);
  const { user } = useAuth();

  // Ministry admins can see which policy versions are published
  const isAdmin = user?.role === "ministry";

  const initialSlug =
    search.doc && policies.some((p) => p.slug === search.doc) ? search.doc : "privacy";
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug);

  useEffect(() => {
    if (search.doc && policies.some((p) => p.slug === search.doc)) {
      setSelectedSlug(search.doc);
    }
  }, [search.doc, policies]);

  const currentPolicy = policies.find((p) => p.slug === selectedSlug) ||
    policies[0] || {
      id: "fallback",
      policy_id: "fallback",
      slug: "privacy",
      title_en: "Privacy Policy",
      title_fr: "Politique de confidentialité",
      title_pt: "Política de Privacidade",
      title_ss: "Inqubomgomo Yebumfihlo",
      content_en: "",
      content_fr: "",
      content_pt: "",
      content_ss: "",
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

  const selectDoc = (slug: string) => {
    setSelectedSlug(slug);
    navigate({ to: ".", search: { doc: slug } });
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-[90rem] px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid size-9 place-items-center rounded-xl border border-border bg-surface text-muted-foreground shadow-[var(--shadow-elev-1)] transition-all hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-accent/10">
                  <Scale className="size-4 text-accent" />
                </div>
                <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
                  {t("legal.center.title", "CoopData Legal Centre")}
                </h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "legal.center.subtitle",
                  "The terms, policies and notices that govern the use of CoopData.",
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            {isAdmin && (
              <Link
                to="/app/admin-legal"
                className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-[var(--shadow-elev-1)] transition-all hover:bg-muted hover:text-foreground"
              >
                <PenTool className="size-3.5 text-accent" />
                <span>{t("legal.center.publishedVersions", "Published versions")}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left Navigation Sidebar */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {t("legal.center.documents", "Legal documents")}
            </h2>

            <div className="space-y-1.5">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded-xl border border-border bg-muted/50"
                    />
                  ))}
                </div>
              ) : (
                policies.map((p) => {
                  const isSelected = p.slug === selectedSlug;
                  const displayTitle =
                    lang === "fr"
                      ? p.title_fr || p.title_en
                      : lang === "pt"
                        ? p.title_pt || p.title_en
                        : lang === "ss"
                          ? p.title_ss || p.title_en
                          : p.title_en;

                  return (
                    <button
                      key={p.slug}
                      onClick={() => selectDoc(p.slug)}
                      className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] font-medium transition-all ${
                        isSelected
                          ? "border-accent/30 bg-accent/8 text-foreground shadow-[var(--shadow-elev-1)]"
                          : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div
                        className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
                          isSelected
                            ? "bg-accent/15 text-accent"
                            : "bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent"
                        }`}
                      >
                        <FileText className="size-4" />
                      </div>
                      <span className="line-clamp-2 flex-1 leading-snug">{displayTitle}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                          isSelected ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        v{p.version || 1}.0
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Contact for questions about the policies */}
            <div className="mt-8 space-y-2 rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-accent">
                <Mail className="size-4" aria-hidden />
                <span>{t("legal.center.questionsTitle", "Questions?")}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t(
                  "legal.center.questionsBody",
                  "For questions about these documents or requests about your data, contact us:",
                )}
              </p>
              <a
                href="mailto:eswatini@dgrv.coop"
                className="inline-block text-xs font-semibold text-accent hover:underline"
              >
                eswatini@dgrv.coop
              </a>
            </div>
          </div>

          {/* Right Main Viewer */}
          <div className="min-w-0">
            <LegalDocumentViewer policy={currentPolicy} lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
};
