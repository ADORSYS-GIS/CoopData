CREATE TABLE kpi_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    reporting_year INT NOT NULL,
    kpi_name VARCHAR(100) NOT NULL,
    kpi_type VARCHAR(50) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    formatted VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    status VARCHAR(20),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_submission_kpi UNIQUE (submission_id, kpi_name)
);
