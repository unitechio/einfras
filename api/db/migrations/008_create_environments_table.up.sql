-- Create environments table
CREATE TABLE IF NOT EXISTS environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create index for active environments
CREATE INDEX idx_environments_is_active ON environments(is_active) WHERE deleted_at IS NULL;

-- Create index for deleted environments
CREATE INDEX idx_environments_deleted_at ON environments(deleted_at);

-- Insert default environments
INSERT INTO environments (name, display_name, description, color, sort_order, is_active) VALUES
    ('dev', 'Development', 'Development environment for testing and debugging', '#4CAF50', 1, true),
    ('staging', 'Staging', 'Staging environment for pre-production testing', '#FF9800', 2, true),
    ('production', 'Production', 'Production environment for live services', '#F44336', 3, true),
    ('qa', 'QA', 'Quality assurance testing environment', '#2196F3', 4, true),
    ('uat', 'UAT', 'User acceptance testing environment', '#9C27B0', 5, true)
ON CONFLICT (name) DO NOTHING;
