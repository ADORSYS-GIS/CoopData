-- Migration 31: Dynamic Label Customization for Organization Hierarchy Levels

CREATE TABLE IF NOT EXISTS organization_labels (
    key VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    short_label VARCHAR(50) NOT NULL,
    plural_label VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100) NOT NULL,
    translations JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default labels matching roles.ts
INSERT INTO organization_labels (key, label, short_label, plural_label, description, icon) VALUES
('ministry', 'Ministry Official', 'Ministry', 'Ministries', 'National oversight — view all cooperatives, generate national reports, monitor compliance, manage users', 'Landmark'),
('federation', 'Federation Officer', 'Federation', 'Federations', 'Regional management — validate submissions, generate federation reports, monitor regional performance', 'UserCog'),
('apex', 'Apex Officer', 'Apex', 'Apexes', 'Cooperative oversight — review submissions, manage cooperatives, validate data, approve or request changes', 'ClipboardList'),
('cooperative', 'Cooperative Manager', 'Cooperative', 'Cooperatives', 'Data submission — submit financial statements, update records, view own reports and analytics', 'Users')
ON CONFLICT (key) DO NOTHING;
