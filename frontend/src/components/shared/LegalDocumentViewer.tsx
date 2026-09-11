// frontend/src/components/shared/LegalDocumentViewer.tsx
import React, { useEffect, useState } from "react";
import type { LegalPolicy } from "@/types/legalPolicy";
import { FileText, Calendar, GitCommit, ShieldCheck, Loader2 } from "lucide-react";

interface LegalDocumentViewerProps {
  policy: LegalPolicy;
  lang: "en" | "fr";
  className?: string;
}

const SLUG_TO_FILE: Record<string, string> = {
  privacy: "privacy_policy.md",
  terms: "terms_of_service.md",
  cookie: "cookie_policy.md",
  disclaimer: "disclaimer.md",
  code_of_conduct: "acceptable_use.md",
  data_processing: "data_retention.md",
};

export const LegalDocumentViewer: React.FC<LegalDocumentViewerProps> = ({
  policy,
  lang,
  className = "",
}) => {
  const [content, setContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);

  const title = lang === "fr" ? policy.title_fr || policy.title_en : policy.title_en;
  const dbContent = lang === "fr" ? policy.content_fr : policy.content_en;

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
    <div className={`bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl overflow-hidden backdrop-blur-md ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>CoopData Official Policy</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-md border border-slate-700/50">
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Version {policy.version || 1}.0</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-md border border-slate-700/50">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Updated: {new Date(policy.updated_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 md:p-8 min-h-[400px]">
        {isLoadingContent ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm">Loading legal document...</p>
          </div>
        ) : (
          <div className="prose prose-invert prose-emerald max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h2:border-b prose-h2:border-slate-800 prose-h2:pb-2 prose-p:text-slate-300 prose-p:leading-relaxed prose-li:text-slate-300">
            {content.split("\n\n").map((paragraph, idx) => {
              if (paragraph.startsWith("# ")) {
                return (
                  <h2 key={idx} className="text-xl font-bold text-slate-100 mt-6 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400 inline" />
                    {paragraph.replace(/^#\s+/, "")}
                  </h2>
                );
              }
              if (paragraph.startsWith("## ")) {
                return (
                  <h3 key={idx} className="text-lg font-semibold text-slate-200 mt-5 mb-2">
                    {paragraph.replace(/^##\s+/, "")}
                  </h3>
                );
              }
              if (paragraph.startsWith("- ") || paragraph.startsWith("* ")) {
                const items = paragraph.split("\n");
                return (
                  <ul key={idx} className="list-disc list-inside space-y-1.5 my-3 text-slate-300">
                    {items.map((item, itemIdx) => (
                      <li key={itemIdx}>{item.replace(/^[-*]\s+/, "")}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={idx} className="text-slate-300 leading-relaxed my-3">
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
