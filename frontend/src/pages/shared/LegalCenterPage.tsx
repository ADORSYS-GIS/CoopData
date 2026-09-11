// frontend/src/pages/shared/LegalCenterPage.tsx
import React, { useState } from "react";
import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";
import { LegalDocumentViewer } from "@/components/shared/LegalDocumentViewer";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { Shield, FileText, Lock, ArrowLeft, Edit3 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const LegalCenterPage: React.FC = () => {
  const { policies, isLoading } = useLegalDocuments();
  const [selectedSlug, setSelectedSlug] = useState<string>("privacy");
  const [lang, setLang] = useState<"en" | "fr">("en");

  const currentPolicy =
    policies.find((p) => p.slug === selectedSlug) ||
    policies[0] || {
      id: "fallback",
      policy_id: "fallback",
      slug: "privacy",
      title_en: "Privacy Policy",
      title_fr: "Politique de confidentialité",
      content_en: "",
      content_fr: "",
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/app/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-slate-100">CoopData Legal Center</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Official governance policies, terms, privacy, and compliance documentation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle currentLang={lang} onLanguageChange={(l) => setLang(l)} />
          <Link
            to="/app/admin-legal"
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg transition-all"
          >
            <Edit3 className="w-4 h-4 text-emerald-400" />
            <span>Policy Editor (Admin)</span>
          </Link>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            Legal Documents
          </h2>

          <div className="space-y-1">
            {policies.map((p) => {
              const isSelected = p.slug === selectedSlug;
              const displayTitle = lang === "fr" ? p.title_fr || p.title_en : p.title_en;

              return (
                <button
                  key={p.slug}
                  onClick={() => setSelectedSlug(p.slug)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-950/30"
                      : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                  }`}
                >
                  <FileText className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-slate-400"}`} />
                  <span className="flex-1 truncate">{displayTitle}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                    v{p.version || 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl space-y-2 text-xs text-slate-400 mt-6">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Compliance Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              These policies are binding under the Eswatini Cooperative Societies Act and CoopData digital governance standards.
            </p>
          </div>
        </div>

        {/* Right Main Viewer */}
        <div className="lg:col-span-3">
          <LegalDocumentViewer policy={currentPolicy} lang={lang} />
        </div>
      </div>
    </div>
  );
};
