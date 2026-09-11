// frontend/src/components/shared/LegalDocumentViewer.tsx
import React, { useEffect, useState } from "react";
import type { LegalPolicy, LegalLang } from "@/types/legalPolicy";
import { FileText, Calendar, GitCommit, ShieldCheck, Loader2 } from "lucide-react";

interface LegalDocumentViewerProps {
  policy: LegalPolicy;
  lang: LegalLang;
  className?: string;
}

const SLUG_TO_FILE: Record<string, string> = {
  privacy: "privacy.md",
  terms: "terms.md",
  cookies: "cookies.md",
  "acceptable-use": "acceptable_use.md",
  security: "security.md",
  "data-retention": "data_retention.md",
};

const LOCALE: Record<LegalLang, string> = {
  en: "en-US",
  fr: "fr-FR",
  pt: "pt-PT",
  ss: "en-SZ",
};

export const LegalDocumentViewer: React.FC<LegalDocumentViewerProps> = ({
  policy,
  lang,
  className = "",
}) => {
  const [content, setContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);

  const title =
    lang === "fr"
      ? policy.title_fr || policy.title_en
      : lang === "pt"
        ? policy.title_pt || policy.title_en
        : lang === "ss"
          ? policy.title_ss || policy.title_en
          : policy.title_en;

  const dbContent =
    lang === "fr"
      ? policy.content_fr
      : lang === "pt"
        ? policy.content_pt
        : lang === "ss"
          ? policy.content_ss
          : policy.content_en;

  useEffect(() => {
    if (dbContent && dbContent.trim().length > 0) {
      setContent(dbContent);
      setIsLoadingContent(false);
      return;
    }

    // Fallback: fetch markdown file from public locales
    setIsLoadingContent(true);
    const fileName = SLUG_TO_FILE[policy.slug] || `${policy.slug}.md`;
    const path = `/locales/${lang}/legal/${fileName}`;

    fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setContent(text);
      })
      .catch(() => {
        setContent(`# ${title}\n\n*Document content is currently unavailable.*`);
      })
      .finally(() => {
        setIsLoadingContent(false);
      });
  }, [policy, lang, dbContent, title]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-elev-1)] ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/30 px-6 py-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <ShieldCheck className="size-4" />
            <span>CoopData Official Policy</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5">
            <GitCommit className="size-3.5 text-accent" />
            <span>Version {policy.version || 1}.0</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span>Updated: {new Date(policy.updated_at).toLocaleDateString(LOCALE[lang])}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-[400px] px-6 py-6 md:px-8 md:py-8">
        {isLoadingContent ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="text-sm">Loading legal document...</p>
          </div>
        ) : (
          <div className="max-w-none text-sm leading-relaxed text-foreground">
            {content.split("\n\n").map((paragraph, idx) => {
              if (paragraph.startsWith("# ")) {
                return (
                  <h2
                    key={idx}
                    className="mb-3 mt-6 flex items-center gap-2 font-heading text-xl font-bold text-foreground"
                  >
                    <FileText className="inline size-5 text-accent" />
                    {paragraph.replace(/^#\s+/, "")}
                  </h2>
                );
              }
              if (paragraph.startsWith("## ")) {
                return (
                  <h3
                    key={idx}
                    className="mb-2 mt-5 font-heading text-lg font-semibold text-foreground"
                  >
                    {paragraph.replace(/^##\s+/, "")}
                  </h3>
                );
              }
              if (paragraph.startsWith("- ") || paragraph.startsWith("* ")) {
                const items = paragraph.split("\n");
                return (
                  <ul
                    key={idx}
                    className="my-3 list-inside list-disc space-y-1.5 text-muted-foreground"
                  >
                    {items.map((item, itemIdx) => (
                      <li key={itemIdx}>{item.replace(/^[-*]\s+/, "")}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={idx} className="my-3 text-muted-foreground">
                  {paragraph}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
