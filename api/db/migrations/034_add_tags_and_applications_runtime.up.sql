CREATE TABLE IF NOT EXISTS tags_runtime (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_runtime_org ON tags_runtime(organization_id);
CREATE INDEX IF NOT EXISTS idx_tags_runtime_name ON tags_runtime(name);
CREATE INDEX IF NOT EXISTS idx_tags_runtime_type ON tags_runtime(type);

CREATE TABLE IF NOT EXISTS applications_runtime (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    environment TEXT NOT NULL,
    status TEXT NOT NULL,
    uptime TEXT,
    services INTEGER NOT NULL DEFAULT 0,
    instances INTEGER NOT NULL DEFAULT 0,
    cpu TEXT,
    ram TEXT,
    last_deploy_at TIMESTAMPTZ,
    public_url TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    cpu_pct INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_runtime_org ON applications_runtime(organization_id);
CREATE INDEX IF NOT EXISTS idx_applications_runtime_name ON applications_runtime(name);
CREATE INDEX IF NOT EXISTS idx_applications_runtime_status ON applications_runtime(status);
