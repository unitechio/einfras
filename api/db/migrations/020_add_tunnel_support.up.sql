-- Add tunnel configuration fields to servers table
ALTER TABLE servers ADD COLUMN IF NOT EXISTS tunnel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS tunnel_host VARCHAR(255);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS tunnel_port INT DEFAULT 22;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS tunnel_user VARCHAR(100);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS tunnel_key_path VARCHAR(500);

-- Create kube_configs table for storing Kubernetes configuration files
CREATE TABLE IF NOT EXISTS kube_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cluster_id UUID,
    config_type VARCHAR(50) NOT NULL CHECK (config_type IN ('file', 'inline', 'credentials')),
    config_data TEXT,
    context_name VARCHAR(255),
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cluster FOREIGN KEY (cluster_id) REFERENCES k8s_clusters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kube_configs_cluster_id ON kube_configs(cluster_id);
CREATE INDEX IF NOT EXISTS idx_kube_configs_is_default ON kube_configs(is_default);

-- Add tunnel configuration to k8s_clusters table
ALTER TABLE k8s_clusters ADD COLUMN IF NOT EXISTS tunnel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE k8s_clusters ADD COLUMN IF NOT EXISTS tunnel_host VARCHAR(255);
ALTER TABLE k8s_clusters ADD COLUMN IF NOT EXISTS tunnel_port INT DEFAULT 22;
ALTER TABLE k8s_clusters ADD COLUMN IF NOT EXISTS tunnel_user VARCHAR(100);
ALTER TABLE k8s_clusters ADD COLUMN IF NOT EXISTS tunnel_key_path VARCHAR(500);
ALTER TABLE k8s_clusters ADD COLUMN IF NOT EXISTS use_kubeconfig BOOLEAN DEFAULT FALSE;
ALTER TABLE k8s_clusters ADD COLUMN IF NOT EXISTS kubeconfig_id UUID;

-- Add foreign key for kubeconfig
ALTER TABLE k8s_clusters ADD CONSTRAINT fk_kubeconfig 
    FOREIGN KEY (kubeconfig_id) REFERENCES kube_configs(id) ON DELETE SET NULL;

-- Add tunnel configuration to docker_hosts table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'docker_hosts') THEN
        ALTER TABLE docker_hosts ADD COLUMN IF NOT EXISTS tunnel_enabled BOOLEAN DEFAULT FALSE;
        ALTER TABLE docker_hosts ADD COLUMN IF NOT EXISTS tunnel_host VARCHAR(255);
        ALTER TABLE docker_hosts ADD COLUMN IF NOT EXISTS tunnel_port INT DEFAULT 22;
        ALTER TABLE docker_hosts ADD COLUMN IF NOT EXISTS tunnel_user VARCHAR(100);
        ALTER TABLE docker_hosts ADD COLUMN IF NOT EXISTS tunnel_key_path VARCHAR(500);
    END IF;
END $$;

-- Create comments for documentation
COMMENT ON COLUMN servers.tunnel_enabled IS 'Enable SSH tunnel for private server access';
COMMENT ON COLUMN servers.tunnel_host IS 'SSH bastion/jump host for tunnel';
COMMENT ON COLUMN servers.tunnel_port IS 'SSH port for tunnel connection';
COMMENT ON COLUMN servers.tunnel_user IS 'SSH user for tunnel authentication';
COMMENT ON COLUMN servers.tunnel_key_path IS 'Path to SSH private key for tunnel';

COMMENT ON TABLE kube_configs IS 'Kubernetes configuration files for cluster access';
COMMENT ON COLUMN kube_configs.config_type IS 'Type of configuration: file (uploaded), inline (pasted), credentials (manual)';
COMMENT ON COLUMN kube_configs.config_data IS 'Base64 encoded kubeconfig file content or inline YAML';
COMMENT ON COLUMN kube_configs.context_name IS 'Default Kubernetes context to use';
COMMENT ON COLUMN kube_configs.is_default IS 'Whether this is the default config for the cluster';
