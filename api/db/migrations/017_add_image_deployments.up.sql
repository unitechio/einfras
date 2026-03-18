CREATE TABLE image_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES k8s_clusters(id),
    namespace VARCHAR(255) NOT NULL,
    deployment_name VARCHAR(255) NOT NULL,
    container_name VARCHAR(255) NOT NULL,
    image_repository VARCHAR(500) NOT NULL,
    image_tag VARCHAR(255) NOT NULL,
    deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deployed_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE image_deployment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES image_deployments(id) ON DELETE CASCADE,
    previous_tag VARCHAR(255),
    new_tag VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255),
    reason TEXT
);

CREATE INDEX idx_image_deployments_cluster_ns ON image_deployments(cluster_id, namespace);
CREATE INDEX idx_image_deployments_repo_tag ON image_deployments(image_repository, image_tag);
CREATE INDEX idx_image_deployment_history_deployment_id ON image_deployment_history(deployment_id);
