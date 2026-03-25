CREATE TABLE IF NOT EXISTS session_presences (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    session_key TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    ip_address TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_presences_user_id ON session_presences(user_id);
CREATE INDEX IF NOT EXISTS idx_session_presences_organization_id ON session_presences(organization_id);
CREATE INDEX IF NOT EXISTS idx_session_presences_last_seen_at ON session_presences(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_session_presences_expires_at ON session_presences(expires_at);
