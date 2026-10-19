-- Migration 49: status of every generated report PDF, per language.
--
-- Reports are no longer rendered in every language at approval. English is
-- prepared at approval; other languages, and consolidated reports, are prepared
-- when a user asks. This table tells the UI what is ready, being prepared or
-- failed, and doubles as the lock that keeps one job per report and language.
--
-- report_key identifies the report: submission:{id}, apex:{id}:{year}:{variant},
-- federation:{id}:{year}:{variant} or ministry:{year}:{variant}.
-- error holds the internal failure detail for operators; the API never returns it.

CREATE TABLE IF NOT EXISTS report_exports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_key  TEXT NOT NULL,
    lang        TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('preparing', 'ready', 'failed')),
    storage_key TEXT,
    error       TEXT,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT report_exports_report_lang_key UNIQUE (report_key, lang)
);
