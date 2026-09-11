// frontend/src/pages/admin/AdminLegalPolicyEditPage.tsx
import React, { useState, useEffect } from "react";
import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";
import { Shield, ArrowLeft, Save, GitCommit, CheckCircle2, AlertCircle, Eye, Edit3 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const AdminLegalPolicyEditPage: React.FC = () => {
  const { policies, isLoading, createPolicy, updatePolicy, isUpdating } = useLegalDocuments();
  const [selectedSlug, setSelectedSlug] = useState<string>("privacy");
  const [activeTab, setActiveTab] = useState<"en" | "fr">("en");
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [contentFr, setContentFr] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const selectedPolicy = policies.find((p) => p.slug === selectedSlug);

  useEffect(() => {
    if (selectedPolicy) {
      setTitleEn(selectedPolicy.title_en || "");
      setTitleFr(selectedPolicy.title_fr || "");
      setContentEn(selectedPolicy.content_en || "");
      setContentFr(selectedPolicy.content_fr || "");
    }
  }, [selectedPolicy]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedPolicy && selectedPolicy.policy_id && !selectedPolicy.policy_id.startsWith("fallback")) {
        await updatePolicy({
          policy_id: selectedPolicy.policy_id,
          title_en: titleEn,
          title_fr: titleFr,
          content_en: contentEn,
          content_fr: contentFr,
        });
        toast.success(`Created new version v${(selectedPolicy.version || 1) + 1} for ${selectedPolicy.title_en}`);
      } else {
        await createPolicy({
          slug: selectedSlug,
          title_en: titleEn || "New Policy",
          title_fr: titleFr || "Nouvelle Politique",
          content_en: contentEn,
          content_fr: contentFr,
        });
        toast.success(`Created initial version for ${selectedSlug}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save policy version");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/app/legal"
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
              Edit legal policy markdown. Saving creates an immutable new version row in the database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg transition-all"
          >
            {isPreviewMode ? <Edit3 className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
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
          <form onSubmit={handleSave} className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Editing: {selectedSlug}</span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                    Current v{selectedPolicy?.version || 1} → New v{(selectedPolicy?.version || 1) + 1}
                  </span>
                </h3>
              </div>

              {/* Language Tab Switch */}
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab("en")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${
                    activeTab === "en" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  English Content
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("fr")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md ${
                    activeTab === "fr" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  French Content
                </button>
              </div>
            </div>

            {activeTab === "en" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Title (English)</label>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Terms of Service"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Markdown Content (English)</label>
                  {isPreviewMode ? (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg min-h-[300px] prose prose-invert prose-emerald text-xs">
                      {contentEn || "*No English content yet*"}
                    </div>
                  ) : (
                    <textarea
                      rows={14}
                      value={contentEn}
                      onChange={(e) => setContentEn(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                      placeholder="Write policy content in markdown format..."
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Title (French)</label>
                  <input
                    type="text"
                    value={titleFr}
                    onChange={(e) => setTitleFr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Conditions d'utilisation"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Markdown Content (French)</label>
                  {isPreviewMode ? (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg min-h-[300px] prose prose-invert prose-emerald text-xs">
                      {contentFr || "*Pas de contenu en français*"}
                    </div>
                  ) : (
                    <textarea
                      rows={14}
                      value={contentFr}
                      onChange={(e) => setContentFr(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                      placeholder="Rédigez le contenu en format markdown..."
                    />
                  )}
                </div>
              </div>
            )}

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
