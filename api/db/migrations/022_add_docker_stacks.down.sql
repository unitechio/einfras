-- Drop indexes
DROP INDEX IF EXISTS idx_stack_services_deleted_at;
DROP INDEX IF EXISTS idx_stack_services_stack_id;
DROP INDEX IF EXISTS idx_docker_stacks_deleted_at;
DROP INDEX IF EXISTS idx_docker_stacks_status;
DROP INDEX IF EXISTS idx_docker_stacks_name;

-- Drop tables
DROP TABLE IF EXISTS stack_services;
DROP TABLE IF EXISTS docker_stacks;
