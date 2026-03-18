-- Update permissions table to add sub_resource and scope columns
ALTER TABLE permissions 
    ADD COLUMN IF NOT EXISTS sub_resource VARCHAR(100),
    ADD COLUMN IF NOT EXISTS scope VARCHAR(50) DEFAULT 'global';

-- Create index for sub_resource
CREATE INDEX IF NOT EXISTS idx_permissions_sub_resource ON permissions(sub_resource) WHERE sub_resource IS NOT NULL;

-- Create index for scope
CREATE INDEX IF NOT EXISTS idx_permissions_scope ON permissions(scope);

-- Update existing permissions to have 'global' scope
UPDATE permissions SET scope = 'global' WHERE scope IS NULL;
