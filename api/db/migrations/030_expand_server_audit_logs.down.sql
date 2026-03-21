DROP INDEX IF EXISTS idx_server_audit_logs_tenant_id;

ALTER TABLE server_audit_logs
    DROP COLUMN IF EXISTS operation_params_json,
    DROP COLUMN IF EXISTS required_capability,
    DROP COLUMN IF EXISTS policy_reason,
    DROP COLUMN IF EXISTS policy_decision,
    DROP COLUMN IF EXISTS actor_role,
    DROP COLUMN IF EXISTS server_groups,
    DROP COLUMN IF EXISTS tenant_id;
