-- Rollback permissions table changes
DROP INDEX IF EXISTS idx_permissions_scope;
DROP INDEX IF EXISTS idx_permissions_sub_resource;

ALTER TABLE permissions 
    DROP COLUMN IF EXISTS scope,
    DROP COLUMN IF EXISTS sub_resource;
