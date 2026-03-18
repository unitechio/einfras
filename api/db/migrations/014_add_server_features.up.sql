-- Add SSH connection fields to servers table
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_port INTEGER DEFAULT 22;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_user VARCHAR(100);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_password VARCHAR(255); -- Should be encrypted
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_key_path VARCHAR(500);

-- Create server_backups table
CREATE TABLE IF NOT EXISTS server_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('full', 'incremental', 'differential')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    backup_path VARCHAR(500),
    size_bytes BIGINT,
    compressed BOOLEAN DEFAULT TRUE,
    encrypted BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_server_backups_server_id ON server_backups(server_id);
CREATE INDEX idx_server_backups_status ON server_backups(status);
CREATE INDEX idx_server_backups_expires_at ON server_backups(expires_at);
CREATE INDEX idx_server_backups_deleted_at ON server_backups(deleted_at);

-- Create server_services table
CREATE TABLE IF NOT EXISTS server_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'stopped', 'failed', 'unknown')),
    enabled BOOLEAN DEFAULT FALSE,
    pid INTEGER,
    port INTEGER,
    config_path VARCHAR(500),
    log_path VARCHAR(500),
    memory_usage_mb INTEGER,
    cpu_usage DECIMAL(5,2),
    uptime BIGINT,
    last_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_server_services_server_id ON server_services(server_id);
CREATE INDEX idx_server_services_name ON server_services(name);
CREATE INDEX idx_server_services_deleted_at ON server_services(deleted_at);
CREATE UNIQUE INDEX idx_server_services_server_name ON server_services(server_id, name) WHERE deleted_at IS NULL;

-- Create server_cronjobs table
CREATE TABLE IF NOT EXISTS server_cronjobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'inactive', 'failed')),
    cron_expression VARCHAR(100) NOT NULL,
    command TEXT NOT NULL,
    working_dir VARCHAR(500),
    user VARCHAR(100),
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    last_exit_code INTEGER,
    last_output TEXT,
    last_error TEXT,
    execution_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    notify_on_failure BOOLEAN DEFAULT TRUE,
    notify_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_server_cronjobs_server_id ON server_cronjobs(server_id);
CREATE INDEX idx_server_cronjobs_status ON server_cronjobs(status);
CREATE INDEX idx_server_cronjobs_deleted_at ON server_cronjobs(deleted_at);

-- Create cronjob_executions table
CREATE TABLE IF NOT EXISTS cronjob_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cronjob_id UUID NOT NULL REFERENCES server_cronjobs(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP,
    exit_code INTEGER,
    output TEXT,
    error TEXT,
    duration INTEGER, -- seconds
    success BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cronjob_executions_cronjob_id ON cronjob_executions(cronjob_id);
CREATE INDEX idx_cronjob_executions_started_at ON cronjob_executions(started_at DESC);

-- Create network_interfaces table
CREATE TABLE IF NOT EXISTS network_interfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    netmask VARCHAR(45),
    gateway VARCHAR(45),
    mtu INTEGER,
    speed INTEGER, -- Mbps
    is_up BOOLEAN,
    bytes_received BIGINT,
    bytes_sent BIGINT,
    packets_received BIGINT,
    packets_sent BIGINT,
    errors_received BIGINT,
    errors_sent BIGINT,
    dropped_received BIGINT,
    dropped_sent BIGINT,
    last_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_network_interfaces_server_id ON network_interfaces(server_id);
CREATE INDEX idx_network_interfaces_deleted_at ON network_interfaces(deleted_at);

-- Create network_connectivity_checks table
CREATE TABLE IF NOT EXISTS network_connectivity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    target_host VARCHAR(255) NOT NULL,
    target_port INTEGER,
    protocol VARCHAR(10),
    success BOOLEAN,
    latency DECIMAL(10,2), -- ms
    error_message TEXT,
    tested_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_network_connectivity_checks_server_id ON network_connectivity_checks(server_id);
CREATE INDEX idx_network_connectivity_checks_tested_at ON network_connectivity_checks(tested_at DESC);

-- Create server_iptables table
CREATE TABLE IF NOT EXISTS server_iptables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    chain VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    protocol VARCHAR(10),
    source_ip VARCHAR(45),
    source_port VARCHAR(20),
    dest_ip VARCHAR(45),
    dest_port VARCHAR(20),
    interface VARCHAR(50),
    state VARCHAR(100),
    position INTEGER,
    raw_rule TEXT,
    comment VARCHAR(255),
    packet_count BIGINT DEFAULT 0,
    byte_count BIGINT DEFAULT 0,
    last_applied TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_server_iptables_server_id ON server_iptables(server_id);
CREATE INDEX idx_server_iptables_chain ON server_iptables(chain);
CREATE INDEX idx_server_iptables_deleted_at ON server_iptables(deleted_at);

-- Create iptable_backups table
CREATE TABLE IF NOT EXISTS iptable_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    rule_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_iptable_backups_server_id ON iptable_backups(server_id);
CREATE INDEX idx_iptable_backups_created_at ON iptable_backups(created_at DESC);
