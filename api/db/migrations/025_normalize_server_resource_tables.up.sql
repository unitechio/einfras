ALTER TABLE server_backups
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_server_backups_created_at ON server_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_backups_server_status ON server_backups(server_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_server_services_server_name_unique
    ON server_services(server_id, name);

ALTER TABLE network_interfaces
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_network_interfaces_server_name_unique
    ON network_interfaces(server_id, name);

ALTER TABLE network_connectivity_checks
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_network_connectivity_checks_server_target
    ON network_connectivity_checks(server_id, target_host, tested_at DESC);

ALTER TABLE server_iptables
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_server_iptables_server_enabled
    ON server_iptables(server_id, enabled, position);

CREATE INDEX IF NOT EXISTS idx_iptable_backups_server_name
    ON iptable_backups(server_id, name, created_at DESC);
