CREATE UNIQUE INDEX IF NOT EXISTS idx_server_backups_server_name_created
    ON server_backups(server_id, name, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_server_iptables_server_name_position
    ON server_iptables(server_id, name, position);

CREATE INDEX IF NOT EXISTS idx_network_connectivity_checks_server_target_port
    ON network_connectivity_checks(server_id, target_host, target_port, tested_at DESC);
