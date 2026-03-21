DROP INDEX IF EXISTS idx_agent_commands_idempotency_key;
DROP INDEX IF EXISTS idx_agent_tokens_expires_at;
DROP INDEX IF EXISTS idx_agent_infos_server_id;
DROP INDEX IF EXISTS idx_servers_environment;
DROP INDEX IF EXISTS idx_servers_connection_mode;
DROP INDEX IF EXISTS idx_servers_onboarding_status;

ALTER TABLE servers
    DROP COLUMN IF EXISTS agent_version,
    DROP COLUMN IF EXISTS last_check_at,
    DROP COLUMN IF EXISTS ssh_key_path,
    DROP COLUMN IF EXISTS ssh_password,
    DROP COLUMN IF EXISTS ssh_user,
    DROP COLUMN IF EXISTS ssh_port,
    DROP COLUMN IF EXISTS onboarding_status,
    DROP COLUMN IF EXISTS connection_mode,
    DROP COLUMN IF EXISTS environment,
    DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE agent_commands
    DROP COLUMN IF EXISTS idempotency_key;
