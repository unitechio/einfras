CREATE TABLE IF NOT EXISTS server_disks (
    id TEXT PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    filesystem TEXT NOT NULL DEFAULT '',
    mount_point TEXT NOT NULL DEFAULT '',
    total_bytes BIGINT NOT NULL DEFAULT 0,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    free_bytes BIGINT NOT NULL DEFAULT 0,
    read_bytes BIGINT NOT NULL DEFAULT 0,
    write_bytes BIGINT NOT NULL DEFAULT 0,
    is_removable BOOLEAN NOT NULL DEFAULT FALSE,
    state TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_disks_server_id ON server_disks(server_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_server_disks_server_device ON server_disks(server_id, device);

CREATE TABLE IF NOT EXISTS server_metric_samples (
    id TEXT PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    cpu_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    memory_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    disk_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    disk_read_bytes BIGINT NOT NULL DEFAULT 0,
    disk_write_bytes BIGINT NOT NULL DEFAULT 0,
    network_rx_bytes BIGINT NOT NULL DEFAULT 0,
    network_tx_bytes BIGINT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_metric_samples_server_id ON server_metric_samples(server_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS server_audit_logs (
    id TEXT PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT '',
    resource_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'accepted',
    details TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_audit_logs_server_id ON server_audit_logs(server_id, created_at DESC);
