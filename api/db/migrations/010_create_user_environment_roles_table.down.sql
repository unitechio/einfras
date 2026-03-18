-- Drop user_environment_roles table
DROP INDEX IF EXISTS idx_user_env_roles_global_unique;
DROP INDEX IF EXISTS idx_user_env_roles_unique;
DROP INDEX IF EXISTS idx_user_env_roles_deleted_at;
DROP INDEX IF EXISTS idx_user_env_roles_role_id;
DROP INDEX IF EXISTS idx_user_env_roles_environment_id;
DROP INDEX IF EXISTS idx_user_env_roles_user_id;
DROP TABLE IF EXISTS user_environment_roles;
