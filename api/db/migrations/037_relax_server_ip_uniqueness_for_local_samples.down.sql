DROP INDEX IF EXISTS idx_servers_ip_address;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'servers_ip_address_key'
    ) THEN
        ALTER TABLE servers ADD CONSTRAINT servers_ip_address_key UNIQUE (ip_address);
    END IF;
END $$;
