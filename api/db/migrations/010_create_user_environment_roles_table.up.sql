-- Create user_environment_roles table
CREATE TABLE IF NOT EXISTS user_environment_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES environments(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for user_environment_roles
CREATE INDEX idx_user_env_roles_user_id ON user_environment_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_env_roles_environment_id ON user_environment_roles(environment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_env_roles_role_id ON user_environment_roles(role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_env_roles_deleted_at ON user_environment_roles(deleted_at);

-- Create unique constraint to prevent duplicate role assignments
CREATE UNIQUE INDEX idx_user_env_roles_unique ON user_environment_roles(user_id, environment_id, role_id) 
    WHERE deleted_at IS NULL;

-- Create unique constraint for global role assignments (environment_id is NULL)
CREATE UNIQUE INDEX idx_user_env_roles_global_unique ON user_environment_roles(user_id, role_id) 
    WHERE environment_id IS NULL AND deleted_at IS NULL;
