import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, FileText, GitPullRequest } from "lucide-react";

import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";

/**
 * Read-only overview of the published legal policies. The texts are not edited in
 * the app: they live in frontend/public/locales/{lang}/legal/*.md and are published
 * as a new version with scripts/publish-legal.py, so every change is reviewed in a
 * pull request before users are asked to accept it.
 */
export const AdminLegalPolicyEditPage: React.FC = () => {
  const { policies, isLoading } = useLegalDocuments();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <Link
          to="/legal"
          className="rounded-lg border border-border bg-surface p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Back to the legal centre"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Legal policies</h1>
          <p className="text-xs text-muted-foreground">
            The versions users currently see and accept.
          </p>
        </div>
      </div>

      <div className="flex gap-3 rounded-xl border border-accent/25 bg-accent/5 p-4 text-xs leading-relaxed text-foreground">
        <GitPullRequest className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p>
          Policies are changed through the code repository, not here: edit the files in{" "}
          <code className="rounded bg-muted px-1">frontend/public/locales/&lt;lang&gt;/legal/</code>
          , run <code className="rounded bg-muted px-1">python3 scripts/publish-legal.py</code> and
          open a pull request. Once it is deployed, the new version goes live and users are asked to
          accept the updated Terms or Privacy Policy.
        </p>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading && <li className="p-4 text-xs text-muted-foreground">Loading…</li>}
        {policies.map((p) => (
          <li key={p.slug} className="flex items-center gap-3 px-4 py-3">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{p.title_en}</p>
              <p className="text-xs text-muted-foreground">
                Version {p.version}.0 · published{" "}
                {new Date(p.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </p>
            </div>
            <Link
              to="/legal"
              search={{ doc: p.slug }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Eye className="size-3.5" aria-hidden />
              View
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
