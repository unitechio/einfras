ALTER TABLE servers
    ADD COLUMN IF NOT EXISTS tunnel_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tunnel_host VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS tunnel_port INTEGER NOT NULL DEFAULT 22,
    ADD COLUMN IF NOT EXISTS tunnel_user VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS tunnel_key_path VARCHAR(500) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS server_service_install_plans (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    mode VARCHAR(32) NOT NULL,
    package_name TEXT NOT NULL DEFAULT '',
    artifact_name TEXT NOT NULL DEFAULT '',
    relay_host TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'planned',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_service_install_plans_server_id
    ON server_service_install_plans(server_id);

CREATE INDEX IF NOT EXISTS idx_server_service_install_plans_mode
    ON server_service_install_plans(mode);
