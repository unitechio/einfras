-- Drop resource_permissions table
DROP INDEX IF EXISTS idx_resource_perms_global_unique;
DROP INDEX IF EXISTS idx_resource_perms_unique;
DROP INDEX IF EXISTS idx_resource_perms_lookup;
DROP INDEX IF EXISTS idx_resource_perms_deleted_at;
DROP INDEX IF EXISTS idx_resource_perms_expires_at;
DROP INDEX IF EXISTS idx_resource_perms_environment_id;
DROP INDEX IF EXISTS idx_resource_perms_resource_id;
DROP INDEX IF EXISTS idx_resource_perms_resource_type;
DROP INDEX IF EXISTS idx_resource_perms_user_id;
DROP TABLE IF EXISTS resource_permissions;
