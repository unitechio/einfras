-- Migration 023: Create agent infrastructure tables
-- Supports the Control Plane + Agent architecture
-- Agent commands, streaming logs, and agent status tracking

-- ── agent_infos ─────────────────────────────────────────────────────────────
-- Tracks the last known state of each agent (one row per server).
CREATE TABLE IF NOT EXISTS agent_infos (
    server_id    TEXT        NOT NULL PRIMARY KEY,
    version      TEXT        NOT NULL DEFAULT '',
    online       BOOLEAN     NOT NULL DEFAULT FALSE,
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cpu_percent  DOUBLE PRECISION NOT NULL DEFAULT 0,
    mem_percent  DOUBLE PRECISION NOT NULL DEFAULT 0,
    disk_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    has_docker   BOOLEAN     NOT NULL DEFAULT FALSE,
    has_k8s      BOOLEAN     NOT NULL DEFAULT FALSE,
    os           TEXT        NOT NULL DEFAULT '',
    arch         TEXT        NOT NULL DEFAULT '',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── agent_commands ───────────────────────────────────────────────────────────
-- Stores every command dispatched to an agent.
CREATE TABLE IF NOT EXISTS agent_commands (
    id           TEXT        NOT NULL PRIMARY KEY,
    server_id    TEXT        NOT NULL REFERENCES agent_infos(server_id) ON DELETE CASCADE,
    user_id      TEXT        NOT NULL DEFAULT '',
    cmd          TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELLED','TIMEOUT')),
    exit_code    INTEGER,
    output       TEXT        NOT NULL DEFAULT '', -- accumulated (truncated above 512 KB)
    timeout_sec  INTEGER     NOT NULL DEFAULT 120,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at   TIMESTAMPTZ,
    done_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_commands_server_id ON agent_commands(server_id);
CREATE INDEX IF NOT EXISTS idx_agent_commands_status    ON agent_commands(status);
CREATE INDEX IF NOT EXISTS idx_agent_commands_created   ON agent_commands(created_at DESC);

-- ── agent_command_logs ───────────────────────────────────────────────────────
-- Stores streamed output chunks from running commands.
-- Kept separate from agent_commands for performance (high write rate).
CREATE TABLE IF NOT EXISTS agent_command_logs (
    id         BIGSERIAL   NOT NULL PRIMARY KEY,
    command_id TEXT        NOT NULL REFERENCES agent_commands(id) ON DELETE CASCADE,
    seq        INTEGER     NOT NULL DEFAULT 0,   -- chunk sequence number
    chunk      TEXT        NOT NULL,
    ts         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_cmd_logs_command_id ON agent_command_logs(command_id, seq);

-- ── agent_tokens ─────────────────────────────────────────────────────────────
-- Stores the issued agent tokens (hashed). One active token per server.
CREATE TABLE IF NOT EXISTS agent_tokens (
    id          TEXT        NOT NULL PRIMARY KEY,
    server_id   TEXT        NOT NULL UNIQUE,
    token_hash  TEXT        NOT NULL,  -- bcrypt hash of the raw JWT/token
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '365 days')
);

CREATE INDEX IF NOT EXISTS idx_agent_tokens_server_id ON agent_tokens(server_id);
