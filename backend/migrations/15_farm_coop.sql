-- Migration 15: Farm Cooperative Profile (NF FARM sheet)
-- Cooperative-level agricultural and production data

CREATE TABLE IF NOT EXISTS farm_coop (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id                  UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
  submission_id                   UUID REFERENCES submissions(id) ON DELETE CASCADE,
  cooperative_type                VARCHAR(100) NOT NULL DEFAULT '',
  primary_activities              TEXT NOT NULL DEFAULT '',
  year_of_establishment           INTEGER,
  operational_status              VARCHAR(50) NOT NULL DEFAULT '',
  active_producer_flag            BOOLEAN NOT NULL DEFAULT false,
  production_type                 VARCHAR(100) NOT NULL DEFAULT '',
  participation_frequency         VARCHAR(50) NOT NULL DEFAULT '',
  delivery_compliance             VARCHAR(50) NOT NULL DEFAULT '',
  production_cycle_type           VARCHAR(50) NOT NULL DEFAULT '',
  use_of_production_planning      BOOLEAN NOT NULL DEFAULT false,
  use_of_shared_inputs            BOOLEAN NOT NULL DEFAULT false,
  quality_compliance_flag         BOOLEAN NOT NULL DEFAULT false,
  market_channel_type             VARCHAR(100) NOT NULL DEFAULT '',
  formal_offtake_agreement        BOOLEAN NOT NULL DEFAULT false,
  buyer_concentration_flag        BOOLEAN NOT NULL DEFAULT false,
  price_predictability_category   VARCHAR(50) NOT NULL DEFAULT '',
  access_to_storage               BOOLEAN NOT NULL DEFAULT false,
  access_to_processing_facilities BOOLEAN NOT NULL DEFAULT false,
  transport_coordination          VARCHAR(50) NOT NULL DEFAULT '',
  climate_exposure_type           VARCHAR(100) NOT NULL DEFAULT '',
  irrigation_access               BOOLEAN NOT NULL DEFAULT false,
  climate_mitigation_practices    TEXT NOT NULL DEFAULT '',
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farm_coop_cooperative_id ON farm_coop(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_farm_coop_submission_id  ON farm_coop(submission_id);
