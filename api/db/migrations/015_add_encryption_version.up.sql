-- Add encryption_version column to servers table
ALTER TABLE servers ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- Add index for encryption version
CREATE INDEX IF NOT EXISTS idx_servers_encryption_version ON servers(encryption_version);

-- Add comment to SSH password column
COMMENT ON COLUMN servers.ssh_password IS 'Encrypted SSH password using AES-256-GCM';
COMMENT ON COLUMN servers.ssh_key_path IS 'Path to encrypted SSH private key file';
COMMENT ON COLUMN servers.encryption_version IS 'Version of encryption key used';
