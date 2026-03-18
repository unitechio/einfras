-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS iptable_backups;
DROP TABLE IF EXISTS server_iptables;
DROP TABLE IF EXISTS network_connectivity_checks;
DROP TABLE IF EXISTS network_interfaces;
DROP TABLE IF EXISTS cronjob_executions;
DROP TABLE IF EXISTS server_cronjobs;
DROP TABLE IF EXISTS server_services;
DROP TABLE IF EXISTS server_backups;

-- Remove SSH fields from servers table
ALTER TABLE servers DROP COLUMN IF EXISTS ssh_key_path;
ALTER TABLE servers DROP COLUMN IF EXISTS ssh_password;
ALTER TABLE servers DROP COLUMN IF EXISTS ssh_user;
ALTER TABLE servers DROP COLUMN IF EXISTS ssh_port;
