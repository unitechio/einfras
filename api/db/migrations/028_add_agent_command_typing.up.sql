ALTER TABLE agent_commands
    ADD COLUMN IF NOT EXISTS command_type TEXT NOT NULL DEFAULT 'shell',
    ADD COLUMN IF NOT EXISTS payload_json TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_agent_commands_command_type
    ON agent_commands(command_type, created_at DESC);
