-- Remove tunnel configuration from docker_hosts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'docker_hosts') THEN
        ALTER TABLE docker_hosts DROP COLUMN IF EXISTS tunnel_key_path;
        ALTER TABLE docker_hosts DROP COLUMN IF EXISTS tunnel_user;
        ALTER TABLE docker_hosts DROP COLUMN IF EXISTS tunnel_port;
        ALTER TABLE docker_hosts DROP COLUMN IF EXISTS tunnel_host;
        ALTER TABLE docker_hosts DROP COLUMN IF EXISTS tunnel_enabled;
    END IF;
END $$;

-- Remove kubeconfig reference from k8s_clusters
ALTER TABLE k8s_clusters DROP CONSTRAINT IF EXISTS fk_kubeconfig;
ALTER TABLE k8s_clusters DROP COLUMN IF EXISTS kubeconfig_id;
ALTER TABLE k8s_clusters DROP COLUMN IF EXISTS use_kubeconfig;
ALTER TABLE k8s_clusters DROP COLUMN IF EXISTS tunnel_key_path;
ALTER TABLE k8s_clusters DROP COLUMN IF EXISTS tunnel_user;
ALTER TABLE k8s_clusters DROP COLUMN IF EXISTS tunnel_port;
ALTER TABLE k8s_clusters DROP COLUMN IF EXISTS tunnel_host;
ALTER TABLE k8s_clusters DROP COLUMN IF EXISTS tunnel_enabled;

-- Drop kube_configs table
DROP TABLE IF EXISTS kube_configs;

-- Remove tunnel configuration from servers
ALTER TABLE servers DROP COLUMN IF EXISTS tunnel_key_path;
ALTER TABLE servers DROP COLUMN IF EXISTS tunnel_user;
ALTER TABLE servers DROP COLUMN IF EXISTS tunnel_port;
ALTER TABLE servers DROP COLUMN IF EXISTS tunnel_host;
ALTER TABLE servers DROP COLUMN IF EXISTS tunnel_enabled;
