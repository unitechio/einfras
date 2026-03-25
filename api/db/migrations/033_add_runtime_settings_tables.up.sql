CREATE TABLE IF NOT EXISTS system_settings_runtime (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    key TEXT NOT NULL,
    category TEXT NOT NULL,
    value TEXT,
    description TEXT,
    sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_system_settings_runtime_org_key UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_system_settings_runtime_category ON system_settings_runtime(category);

CREATE TABLE IF NOT EXISTS feature_flags_runtime (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_feature_flags_runtime_org_key UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_runtime_category ON feature_flags_runtime(category);

CREATE TABLE IF NOT EXISTS licenses_runtime (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL UNIQUE,
    license_key TEXT,
    tier TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    contact_email TEXT,
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings_runtime (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_settings_runtime_user_org UNIQUE (user_id, organization_id)
);
