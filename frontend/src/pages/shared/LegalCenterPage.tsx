// frontend/src/pages/shared/LegalCenterPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";
import { LegalDocumentViewer } from "@/components/shared/LegalDocumentViewer";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import type { LegalLang } from "@/types/legalPolicy";
import { Shield, FileText, ArrowLeft, Edit3 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const LegalCenterPage: React.FC = () => {
  const { policies, isLoading } = useLegalDocuments();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { doc?: string };
  const [lang, setLang] = useState<LegalLang>("en");

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
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-accent" />
                <h1 className="font-heading text-xl font-bold text-foreground">
                  CoopData Legal Center
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Official governance policies, terms, privacy, and compliance documentation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle currentLang={lang} onLanguageChange={(l) => setLang(l)} />
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Left Navigation Sidebar */}
          <div className="lg:col-span-1">
            <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Legal Documents
            </h2>

            <div className="space-y-1">
              {isLoading ? (
                <p className="px-1 text-xs text-muted-foreground">Loading documents...</p>
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
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-xs font-medium transition-all ${
                        isSelected
                          ? "border-accent/40 bg-accent/10 text-foreground shadow-[var(--shadow-elev-1)]"
                          : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <FileText
                        className={`size-4 shrink-0 ${isSelected ? "text-accent" : "text-muted-foreground"}`}
                      />
                      <span className="flex-1 truncate">{displayTitle}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        v{p.version || 1}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-6 space-y-2 rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-accent">
                <Shield className="size-3.5" />
                <span>Compliance Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                These policies are binding under the Eswatini Cooperative Societies Act and CoopData
                digital governance standards.
              </p>
            </div>
          </div>

          {/* Right Main Viewer */}
          <div className="lg:col-span-3">
            <LegalDocumentViewer policy={currentPolicy} lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
};
