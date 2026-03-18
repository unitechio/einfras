-- Create resource_permissions table
CREATE TABLE IF NOT EXISTS resource_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    actions JSONB NOT NULL,
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    expires_at TIMESTAMP,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for resource_permissions
CREATE INDEX idx_resource_perms_user_id ON resource_permissions(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_resource_perms_resource_type ON resource_permissions(resource_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_resource_perms_resource_id ON resource_permissions(resource_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_resource_perms_environment_id ON resource_permissions(environment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_resource_perms_expires_at ON resource_permissions(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_resource_perms_deleted_at ON resource_permissions(deleted_at);

-- Create composite index for efficient permission lookups
CREATE INDEX idx_resource_perms_lookup ON resource_permissions(user_id, resource_type, resource_id) 
    WHERE deleted_at IS NULL;

-- Create unique constraint to prevent duplicate permissions
CREATE UNIQUE INDEX idx_resource_perms_unique ON resource_permissions(user_id, resource_type, resource_id, environment_id) 
    WHERE deleted_at IS NULL AND environment_id IS NOT NULL;

-- Create unique constraint for global resource permissions (environment_id is NULL)
CREATE UNIQUE INDEX idx_resource_perms_global_unique ON resource_permissions(user_id, resource_type, resource_id) 
    WHERE environment_id IS NULL AND deleted_at IS NULL;

-- Add check constraint for resource_type
ALTER TABLE resource_permissions 
    ADD CONSTRAINT chk_resource_type CHECK (
        resource_type IN ('server', 'k8s_cluster', 'k8s_namespace', 'docker_container', 'harbor_project')
    );

-- Add comment for actions column
COMMENT ON COLUMN resource_permissions.actions IS 'JSON array of allowed actions, e.g., ["read", "update", "delete"]';
