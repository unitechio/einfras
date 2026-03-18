CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(512) UNIQUE NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    
    -- Organization Info
    organization_id UUID,
    organization_name VARCHAR(255),
    contact_email VARCHAR(255),
    
    -- License Limits
    max_users INTEGER DEFAULT 0,
    max_api_calls INTEGER DEFAULT 0,
    max_storage INTEGER DEFAULT 0,
    
    -- Usage Tracking
    current_users INTEGER DEFAULT 0,
    current_api_calls INTEGER DEFAULT 0,
    current_storage INTEGER DEFAULT 0,
    
    -- Time Management
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    activated_at TIMESTAMP,
    suspended_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB,
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- Indexes
    CONSTRAINT chk_tier CHECK (tier IN ('free', 'professional', 'enterprise', 'custom')),
    CONSTRAINT chk_status CHECK (status IN ('active', 'expired', 'suspended', 'revoked'))
);

-- Create indexes for better query performance
CREATE INDEX idx_licenses_tier ON licenses(tier);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_organization ON licenses(organization_id);
CREATE INDEX idx_licenses_deleted ON licenses(deleted_at);

-- Create license usage tracking table
CREATE TABLE IF NOT EXISTS license_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    usage_type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 1,
    metadata JSONB,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_license_usage_license ON license_usage_logs(license_id);
CREATE INDEX idx_license_usage_type ON license_usage_logs(usage_type);
CREATE INDEX idx_license_usage_recorded ON license_usage_logs(recorded_at);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_licenses_updated_at();
