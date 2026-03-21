ALTER TABLE servers
    ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS environment VARCHAR(32) NOT NULL DEFAULT 'production',
    ADD COLUMN IF NOT EXISTS connection_mode VARCHAR(32) NOT NULL DEFAULT 'agent',
    ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS ssh_port INTEGER NOT NULL DEFAULT 22,
    ADD COLUMN IF NOT EXISTS ssh_user VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS ssh_password TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS ssh_key_path TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_check_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS agent_version TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_servers_onboarding_status ON servers(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_servers_connection_mode ON servers(connection_mode);
CREATE INDEX IF NOT EXISTS idx_servers_environment ON servers(environment);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'agent_commands_server_id_fkey'
          AND table_name = 'agent_commands'
    ) THEN
        ALTER TABLE agent_commands DROP CONSTRAINT agent_commands_server_id_fkey;
    END IF;
END $$;

ALTER TABLE agent_commands
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_infos_server_id ON agent_infos(server_id);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_expires_at ON agent_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_commands_idempotency_key
    ON agent_commands(idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
