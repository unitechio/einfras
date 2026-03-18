CREATE TABLE k8s_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES k8s_clusters(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    namespace VARCHAR(255),
    resource_count INTEGER,
    size_bytes BIGINT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE k8s_backup_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID NOT NULL REFERENCES k8s_backups(id) ON DELETE CASCADE,
    kind VARCHAR(100) NOT NULL,
    namespace VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    manifest TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_k8s_backups_cluster_id ON k8s_backups(cluster_id);
CREATE INDEX idx_k8s_backup_resources_backup_id ON k8s_backup_resources(backup_id);
