-- Drop environments table
DROP INDEX IF EXISTS idx_environments_deleted_at;
DROP INDEX IF EXISTS idx_environments_is_active;
DROP TABLE IF EXISTS environments;
