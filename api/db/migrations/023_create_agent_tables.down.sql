-- Migration 023 DOWN: Drop agent infrastructure tables
DROP TABLE IF EXISTS agent_command_logs;
DROP TABLE IF EXISTS agent_commands;
DROP TABLE IF EXISTS agent_tokens;
DROP TABLE IF EXISTS agent_infos;
