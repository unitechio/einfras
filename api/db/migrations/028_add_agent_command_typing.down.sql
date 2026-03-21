DROP INDEX IF EXISTS idx_agent_commands_command_type;

ALTER TABLE agent_commands
    DROP COLUMN IF EXISTS payload_json,
    DROP COLUMN IF EXISTS command_type;
