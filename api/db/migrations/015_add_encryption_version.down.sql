-- Remove encryption_version column from servers table
DROP INDEX IF EXISTS idx_servers_encryption_version;
ALTER TABLE servers DROP COLUMN IF EXISTS encryption_version;
