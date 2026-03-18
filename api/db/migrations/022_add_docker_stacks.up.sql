-- Create docker_stacks table
CREATE TABLE IF NOT EXISTS docker_stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    compose_file TEXT NOT NULL,
    env_vars JSONB,
    status VARCHAR(50) NOT NULL,
    docker_host VARCHAR(255),
    project_name VARCHAR(255),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create stack_services table
CREATE TABLE IF NOT EXISTS stack_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stack_id UUID NOT NULL REFERENCES docker_stacks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    image VARCHAR(500),
    replicas INT DEFAULT 1,
    status VARCHAR(50),
    ports JSONB,
    environment JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_docker_stacks_name ON docker_stacks(name);
CREATE INDEX IF NOT EXISTS idx_docker_stacks_status ON docker_stacks(status);
CREATE INDEX IF NOT EXISTS idx_docker_stacks_deleted_at ON docker_stacks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_stack_services_stack_id ON stack_services(stack_id);
CREATE INDEX IF NOT EXISTS idx_stack_services_deleted_at ON stack_services(deleted_at);

-- Add comments
COMMENT ON TABLE docker_stacks IS 'Docker Compose stacks for multi-container applications';
COMMENT ON COLUMN docker_stacks.compose_file IS 'Docker Compose YAML file content';
COMMENT ON COLUMN docker_stacks.env_vars IS 'Environment variables for the stack';
COMMENT ON COLUMN docker_stacks.project_name IS 'Docker Compose project name';

COMMENT ON TABLE stack_services IS 'Services within a Docker Compose stack';
COMMENT ON COLUMN stack_services.stack_id IS 'Reference to parent stack';
