ALTER TABLE server_audit_logs
    ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS server_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS actor_role TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS policy_decision TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS policy_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS required_capability TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS operation_params_json TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_server_audit_logs_tenant_id
    ON server_audit_logs(tenant_id, created_at DESC);
