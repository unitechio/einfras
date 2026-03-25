CREATE TABLE IF NOT EXISTS notification_routing_rules (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    integration_kind TEXT NOT NULL,
    event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
    channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    statuses JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    tag_prefixes JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_routing_rules_org ON notification_routing_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_routing_rules_kind ON notification_routing_rules(integration_kind);

CREATE TABLE IF NOT EXISTS license_keys_runtime (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    license_key TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'draft',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    issued_to TEXT,
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_keys_runtime_org ON license_keys_runtime(organization_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_runtime_primary ON license_keys_runtime(organization_id, is_primary);
