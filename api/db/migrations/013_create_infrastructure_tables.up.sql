-- Create servers table
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    hostname VARCHAR(255),
    os VARCHAR(50) NOT NULL CHECK (os IN ('linux', 'windows', 'macos')),
    os_version VARCHAR(100),
    cpu_cores INT NOT NULL CHECK (cpu_cores >= 1),
    cpu_model VARCHAR(255),
    memory_gb DECIMAL(10,2) NOT NULL CHECK (memory_gb >= 0.1),
    disk_gb DECIMAL(10,2) NOT NULL CHECK (disk_gb >= 1),
    status VARCHAR(50) NOT NULL CHECK (status IN ('online', 'offline', 'maintenance', 'error')),
    tags JSONB,
    location VARCHAR(255),
    provider VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for servers table
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_servers_deleted_at ON servers(deleted_at);
CREATE INDEX idx_servers_location ON servers(location);
CREATE INDEX idx_servers_provider ON servers(provider);

-- Create docker_hosts table
CREATE TABLE IF NOT EXISTS docker_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    endpoint VARCHAR(500) NOT NULL,
    tls_enabled BOOLEAN DEFAULT true,
    cert_path VARCHAR(500),
    version VARCHAR(50),
    server_id UUID REFERENCES servers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for docker_hosts table
CREATE INDEX idx_docker_hosts_server_id ON docker_hosts(server_id);
CREATE INDEX idx_docker_hosts_is_active ON docker_hosts(is_active);
CREATE INDEX idx_docker_hosts_deleted_at ON docker_hosts(deleted_at);

-- Create k8s_clusters table
CREATE TABLE IF NOT EXISTS k8s_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    api_server VARCHAR(500) NOT NULL,
    version VARCHAR(50),
    provider VARCHAR(100),
    region VARCHAR(100),
    config_path VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for k8s_clusters table
CREATE INDEX idx_k8s_clusters_provider ON k8s_clusters(provider);
CREATE INDEX idx_k8s_clusters_region ON k8s_clusters(region);
CREATE INDEX idx_k8s_clusters_is_active ON k8s_clusters(is_active);
CREATE INDEX idx_k8s_clusters_deleted_at ON k8s_clusters(deleted_at);

-- Create harbor_registries table
CREATE TABLE IF NOT EXISTS harbor_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    url VARCHAR(500) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(500),  -- Should be encrypted
    version VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for harbor_registries table
CREATE INDEX idx_harbor_registries_is_active ON harbor_registries(is_active);
CREATE INDEX idx_harbor_registries_is_default ON harbor_registries(is_default);
CREATE INDEX idx_harbor_registries_deleted_at ON harbor_registries(deleted_at);

-- Ensure only one default registry
CREATE UNIQUE INDEX idx_harbor_registries_unique_default 
    ON harbor_registries(is_default) 
    WHERE is_default = true AND deleted_at IS NULL;
