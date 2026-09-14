// frontend/src/components/shared/LegalDocumentViewer.tsx
import React, { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LegalPolicy, LegalLang } from "@/types/legalPolicy";
import {
  FileText,
  Calendar,
  GitCommit,
  ShieldCheck,
  Loader2,
  BookOpen,
} from "lucide-react";

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
    // Normalization helper for raw markdown strings
    const processMarkdown = (raw: string) => {
      let text = raw.replace(/\\n/g, "\n");
      // Remove leading # Title line to avoid repeating the header title from top banner card
      text = text.replace(/^#\s+.+(\r?\n)+/, "");
      // Fix inline bullets that were joined without newlines
      text = text.replace(/([^\n])\s*-\s+([A-Z0-9])/g, "$1\n- $2");
      // Fix headings that lack preceding newlines
      text = text.replace(/([^\n])\s*(#{1,4}\s+[A-Z0-9])/gi, "$1\n\n$2");
      return text;
    };

    if (dbContent && dbContent.trim().length > 10) {
      setContent(processMarkdown(dbContent));
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
        setContent(processMarkdown(text));
      })
      .catch(() => {
        setContent(`*Document content for **${title}** is currently unavailable.*`);
      })
      .finally(() => {
        setIsLoadingContent(false);
      });
  }, [policy, lang, dbContent, title]);

  // Build TOC from headings (## level)
  const tocItems = useMemo(() => {
    const items: { id: string; text: string; level: number }[] = [];
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "-");
        items.push({ id, text, level });
      }
    }
    return items;
  }, [content]);

  const nodeToString = (node: React.ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(nodeToString).join("");
    if (React.isValidElement(node) && node.props && node.props.children) {
      return nodeToString((node.props as { children?: React.ReactNode }).children);
    }
    return "";
  };

  // Heading ID generator for anchors
  const headingId = (children: React.ReactNode) => {
    const str = nodeToString(children);
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-");
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-2)] ${className}`}
    >
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-muted/40 via-muted/20 to-transparent px-6 py-6 md:px-8">
        {/* Decorative accent line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-accent/70 to-transparent" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              <ShieldCheck className="size-4" />
              <span>CoopData Official Policy</span>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-elev-1)]">
              <GitCommit className="size-3.5 text-accent" />
              <span>Version {policy.version || 1}.0</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-elev-1)]">
              <Calendar className="size-3.5" />
              <span>
                Updated:{" "}
                {new Date(policy.updated_at).toLocaleDateString(LOCALE[lang], {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex">
        {/* Optional TOC sidebar (desktop only, if enough headings) */}
        {tocItems.length > 3 && (
          <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/20 px-4 py-6 xl:block">
            <div className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <BookOpen className="size-3" />
              <span>Contents</span>
            </div>
            <nav className="space-y-0.5">
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`block rounded-md px-2.5 py-1.5 text-[11px] leading-snug transition-colors hover:bg-muted hover:text-foreground ${
                    item.level === 3
                      ? "pl-5 text-muted-foreground/70"
                      : "font-medium text-muted-foreground"
                  }`}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <div className="min-h-[400px] flex-1 px-6 py-8 md:px-10 md:py-10">
          {isLoadingContent ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-accent" />
              <p className="text-sm">Loading legal document...</p>
            </div>
          ) : (
            <article className="legal-prose max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h2
                      id={headingId(children)}
                      className="mb-4 mt-8 flex items-center gap-2.5 font-heading text-xl font-bold tracking-tight text-foreground first:mt-0"
                    >
                      <FileText className="inline size-5 shrink-0 text-accent" />
                      <span>{children}</span>
                    </h2>
                  ),
                  h2: ({ children }) => (
                    <h3
                      id={headingId(children)}
                      className="mb-3 mt-8 border-b border-border pb-2 font-heading text-lg font-semibold text-foreground"
                    >
                      {children}
                    </h3>
                  ),
                  h3: ({ children }) => (
                    <h4
                      id={headingId(children)}
                      className="mb-2 mt-6 font-heading text-base font-semibold text-foreground"
                    >
                      {children}
                    </h4>
                  ),
                  h4: ({ children }) => (
                    <h5 className="mb-2 mt-4 text-sm font-semibold text-foreground">
                      {children}
                    </h5>
                  ),
                  p: ({ children }) => (
                    <p className="my-3 text-sm leading-7 text-muted-foreground">
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-muted-foreground">{children}</em>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-3 ml-1 space-y-1.5 text-sm text-muted-foreground">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-3 ml-1 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2 leading-7">
                      <span className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-accent/50" />
                      <span className="flex-1">{children}</span>
                    </li>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="font-medium text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:text-accent/80 hover:decoration-accent/60"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="my-4 rounded-r-lg border-l-4 border-accent/40 bg-accent/5 py-3 pl-4 pr-4 text-sm italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className: codeClassName }) => {
                    const isBlock = codeClassName?.includes("language-");
                    if (isBlock) {
                      return (
                        <code className="block overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-accent">
                        {children}
                      </code>
                    );
                  },
                  table: ({ children }) => (
                    <div className="my-6 overflow-x-auto rounded-xl border border-border shadow-[var(--shadow-elev-1)]">
                      <table className="w-full border-collapse text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/60">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-border px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-foreground">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-border/50 px-4 py-3 text-sm text-muted-foreground">
                      {children}
                    </td>
                  ),
                  tr: ({ children }) => (
                    <tr className="transition-colors hover:bg-muted/30">{children}</tr>
                  ),
                  hr: () => (
                    <hr className="my-8 border-0 border-t border-border" />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
};
