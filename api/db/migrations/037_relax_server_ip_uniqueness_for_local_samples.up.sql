DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'servers_ip_address_key'
    ) THEN
        ALTER TABLE servers DROP CONSTRAINT servers_ip_address_key;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_servers_ip_address;
CREATE INDEX IF NOT EXISTS idx_servers_ip_address ON servers(ip_address);
