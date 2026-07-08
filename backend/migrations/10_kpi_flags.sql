-- Migration 10: KPIs, Benchmark Data & Abnormality Flags
-- Source: docs/architecture.md §6.9, docs/databse-shema.md §8.8

CREATE TABLE IF NOT EXISTS computed_kpis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES cooperatives(id),
  submission_id   UUID REFERENCES submissions(id) ON DELETE CASCADE,
  reporting_period VARCHAR(7) NOT NULL,
  kpi_category    VARCHAR(50) NOT NULL,
  kpi_name        VARCHAR(100) NOT NULL,
  value           NUMERIC(15,4) NOT NULL,
  formatted       VARCHAR(50) NOT NULL,
  unit            VARCHAR(20) NOT NULL,
  status          VARCHAR(10),
  benchmark       NUMERIC(15,4),
  description     TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cooperative_id, kpi_name, reporting_period)
);

CREATE TABLE IF NOT EXISTS benchmark_data (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region           VARCHAR(50),
  sector           VARCHAR(50),
  kpi_name         VARCHAR(100) NOT NULL,
  reporting_period VARCHAR(7) NOT NULL,
  regional_average  NUMERIC(15,4),
  sector_average    NUMERIC(15,4),
  national_average  NUMERIC(15,4),
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abnormality_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  cooperative_id  UUID NOT NULL REFERENCES cooperatives(id),
  rule_id         VARCHAR(50) NOT NULL,
  severity        VARCHAR(10) NOT NULL,
  message         TEXT NOT NULL,
  field_ref       VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);