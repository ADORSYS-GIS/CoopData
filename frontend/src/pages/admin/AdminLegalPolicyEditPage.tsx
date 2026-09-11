// frontend/src/pages/admin/AdminLegalPolicyEditPage.tsx
import React, { useState, useEffect } from "react";
import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";
import {
  Shield,
  ArrowLeft,
  Save,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { LegalLang } from "@/types/legalPolicy";

const LANGS: { code: LegalLang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" },
  { code: "ss", label: "Siswati" },
];

export const AdminLegalPolicyEditPage: React.FC = () => {
  const { policies, isLoading, createPolicy, updatePolicy, isUpdating } = useLegalDocuments();
  const [selectedSlug, setSelectedSlug] = useState<string>("privacy");
  const [activeTab, setActiveTab] = useState<LegalLang>("en");
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [titlePt, setTitlePt] = useState("");
  const [titleSs, setTitleSs] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [contentFr, setContentFr] = useState("");
  const [contentPt, setContentPt] = useState("");
  const [contentSs, setContentSs] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const selectedPolicy = policies.find((p) => p.slug === selectedSlug);

  useEffect(() => {
    if (selectedPolicy) {
      setTitleEn(selectedPolicy.title_en || "");
      setTitleFr(selectedPolicy.title_fr || "");
      setTitlePt(selectedPolicy.title_pt || "");
      setTitleSs(selectedPolicy.title_ss || "");
      setContentEn(selectedPolicy.content_en || "");
      setContentFr(selectedPolicy.content_fr || "");
      setContentPt(selectedPolicy.content_pt || "");
      setContentSs(selectedPolicy.content_ss || "");
    }
  }, [selectedPolicy]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (
        selectedPolicy &&
        selectedPolicy.policy_id &&
        !selectedPolicy.policy_id.startsWith("fallback")
      ) {
        await updatePolicy({
          policy_id: selectedPolicy.policy_id,
          title_en: titleEn,
          title_fr: titleFr,
          title_pt: titlePt,
          title_ss: titleSs,
          content_en: contentEn,
          content_fr: contentFr,
          content_pt: contentPt,
          content_ss: contentSs,
        });
        toast.success(
          `Created new version v${(selectedPolicy.version || 1) + 1} for ${selectedPolicy.title_en}`,
        );
      } else {
        await createPolicy({
          slug: selectedSlug,
          title_en: titleEn || "New Policy",
          title_fr: titleFr || "Nouvelle Politique",
          title_pt: titlePt || "Nova Política",
          title_ss: titleSs || "Inqubomgomo Lemisha",
          content_en: contentEn,
          content_fr: contentFr,
          content_pt: contentPt,
          content_ss: contentSs,
        });
        toast.success(`Created initial version for ${selectedSlug}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save policy version");
    }
  };

  const titleValue = (lang: LegalLang) =>
    lang === "fr" ? titleFr : lang === "pt" ? titlePt : lang === "ss" ? titleSs : titleEn;
  const contentValue = (lang: LegalLang) =>
    lang === "fr" ? contentFr : lang === "pt" ? contentPt : lang === "ss" ? contentSs : contentEn;
  const setTitleValue = (lang: LegalLang, v: string) =>
    lang === "fr"
      ? setTitleFr(v)
      : lang === "pt"
        ? setTitlePt(v)
        : lang === "ss"
          ? setTitleSs(v)
          : setTitleEn(v);
  const setContentValue = (lang: LegalLang, v: string) =>
    lang === "fr"
      ? setContentFr(v)
      : lang === "pt"
        ? setContentPt(v)
        : lang === "ss"
          ? setContentSs(v)
          : setContentEn(v);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/legal"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-slate-100">Admin Policy Editor</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Edit legal policy markdown. Saving creates an immutable new version row in the
              database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg transition-all"
          >
            {isPreviewMode ? (
              <Edit3 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Eye className="w-4 h-4 text-emerald-400" />
            )}
            <span>{isPreviewMode ? "Edit Mode" : "Preview Mode"}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar list */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-3">
            Select Policy
          </h2>
          {policies.map((p) => {
            const isSelected = p.slug === selectedSlug;
            return (
              <button
                key={p.slug}
                onClick={() => setSelectedSlug(p.slug)}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                    : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{p.title_en || p.slug}</span>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                  v{p.version || 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Editor */}
        <div className="lg:col-span-3">
          <form
            onSubmit={handleSave}
            className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl backdrop-blur-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Editing: {selectedSlug}</span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                    Current v{selectedPolicy?.version || 1} → New v
                    {(selectedPolicy?.version || 1) + 1}
                  </span>
                </h3>
              </div>

              {/* Language Tab Switch */}
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setActiveTab(l.code)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md ${
                      activeTab === l.code
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title ({activeTab.toUpperCase()})
                </label>
                <input
                  type="text"
                  value={titleValue(activeTab)}
                  onChange={(e) => setTitleValue(activeTab, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="Policy title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Markdown Content ({activeTab.toUpperCase()})
                </label>
                {isPreviewMode ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg min-h-[300px] prose prose-invert prose-emerald text-xs">
                    {contentValue(activeTab) || "*No content yet*"}
                  </div>
                ) : (
                  <textarea
                    rows={14}
                    value={contentValue(activeTab)}
                    onChange={(e) => setContentValue(activeTab, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="Write policy content in markdown format..."
                  />
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <GitCommit className="w-4 h-4 text-emerald-400" />
                Saving publishes a new database version for all users.
              </span>

              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isUpdating ? "Publishing New Version..." : "Publish New Version"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
