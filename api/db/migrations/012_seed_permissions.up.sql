-- Seed infrastructure permissions
-- This migration adds comprehensive permissions for infrastructure management

-- Server permissions
INSERT INTO permissions (name, resource, sub_resource, action, scope, description, is_system) VALUES
    ('server.*', 'server', NULL, '*', 'global', 'All server permissions', true),
    ('server.create', 'server', NULL, 'create', 'global', 'Create new servers', true),
    ('server.read', 'server', NULL, 'read', 'global', 'View server details', true),
    ('server.update', 'server', NULL, 'update', 'global', 'Update server configuration', true),
    ('server.delete', 'server', NULL, 'delete', 'global', 'Delete servers', true),
    ('server.ssh.execute', 'server', 'ssh', 'execute', 'resource', 'Execute SSH commands on servers', true),
    ('server.metrics.read', 'server', 'metrics', 'read', 'global', 'View server metrics', true)
ON CONFLICT (name) DO NOTHING;

-- Kubernetes permissions
INSERT INTO permissions (name, resource, sub_resource, action, scope, description, is_system) VALUES
    ('k8s.*', 'k8s', NULL, '*', 'global', 'All Kubernetes permissions', true),
    ('k8s.cluster.create', 'k8s', 'cluster', 'create', 'global', 'Create Kubernetes clusters', true),
    ('k8s.cluster.read', 'k8s', 'cluster', 'read', 'global', 'View Kubernetes cluster details', true),
    ('k8s.cluster.update', 'k8s', 'cluster', 'update', 'global', 'Update Kubernetes cluster configuration', true),
    ('k8s.cluster.delete', 'k8s', 'cluster', 'delete', 'global', 'Delete Kubernetes clusters', true),
    ('k8s.namespace.create', 'k8s', 'namespace', 'create', 'resource', 'Create namespaces in clusters', true),
    ('k8s.namespace.read', 'k8s', 'namespace', 'read', 'resource', 'View namespace details', true),
    ('k8s.namespace.delete', 'k8s', 'namespace', 'delete', 'resource', 'Delete namespaces', true),
    ('k8s.deployment.create', 'k8s', 'deployment', 'create', 'resource', 'Create deployments', true),
    ('k8s.deployment.read', 'k8s', 'deployment', 'read', 'resource', 'View deployment details', true),
    ('k8s.deployment.update', 'k8s', 'deployment', 'update', 'resource', 'Update deployments', true),
    ('k8s.deployment.delete', 'k8s', 'deployment', 'delete', 'resource', 'Delete deployments', true),
    ('k8s.deployment.scale', 'k8s', 'deployment', 'scale', 'resource', 'Scale deployments', true),
    ('k8s.pod.read', 'k8s', 'pod', 'read', 'resource', 'View pod details', true),
    ('k8s.pod.delete', 'k8s', 'pod', 'delete', 'resource', 'Delete pods', true),
    ('k8s.pod.logs.read', 'k8s', 'pod', 'logs.read', 'resource', 'Read pod logs', true),
    ('k8s.pod.exec', 'k8s', 'pod', 'exec', 'resource', 'Execute commands in pods', true),
    ('k8s.service.create', 'k8s', 'service', 'create', 'resource', 'Create services', true),
    ('k8s.service.read', 'k8s', 'service', 'read', 'resource', 'View service details', true),
    ('k8s.service.update', 'k8s', 'service', 'update', 'resource', 'Update services', true),
    ('k8s.service.delete', 'k8s', 'service', 'delete', 'resource', 'Delete services', true)
ON CONFLICT (name) DO NOTHING;

-- Docker permissions
INSERT INTO permissions (name, resource, sub_resource, action, scope, description, is_system) VALUES
    ('docker.*', 'docker', NULL, '*', 'global', 'All Docker permissions', true),
    ('docker.container.create', 'docker', 'container', 'create', 'global', 'Create Docker containers', true),
    ('docker.container.read', 'docker', 'container', 'read', 'global', 'View container details', true),
    ('docker.container.start', 'docker', 'container', 'start', 'resource', 'Start containers', true),
    ('docker.container.stop', 'docker', 'container', 'stop', 'resource', 'Stop containers', true),
    ('docker.container.restart', 'docker', 'container', 'restart', 'resource', 'Restart containers', true),
    ('docker.container.delete', 'docker', 'container', 'delete', 'resource', 'Delete containers', true),
    ('docker.container.logs.read', 'docker', 'container', 'logs.read', 'resource', 'Read container logs', true),
    ('docker.container.exec', 'docker', 'container', 'exec', 'resource', 'Execute commands in containers', true),
    ('docker.image.pull', 'docker', 'image', 'pull', 'global', 'Pull Docker images', true),
    ('docker.image.push', 'docker', 'image', 'push', 'global', 'Push Docker images', true),
    ('docker.image.delete', 'docker', 'image', 'delete', 'global', 'Delete Docker images', true)
ON CONFLICT (name) DO NOTHING;

-- Harbor permissions
INSERT INTO permissions (name, resource, sub_resource, action, scope, description, is_system) VALUES
    ('harbor.*', 'harbor', NULL, '*', 'global', 'All Harbor permissions', true),
    ('harbor.project.create', 'harbor', 'project', 'create', 'global', 'Create Harbor projects', true),
    ('harbor.project.read', 'harbor', 'project', 'read', 'global', 'View project details', true),
    ('harbor.project.update', 'harbor', 'project', 'update', 'resource', 'Update project configuration', true),
    ('harbor.project.delete', 'harbor', 'project', 'delete', 'resource', 'Delete projects', true),
    ('harbor.repository.read', 'harbor', 'repository', 'read', 'resource', 'View repository details', true),
    ('harbor.artifact.push', 'harbor', 'artifact', 'push', 'resource', 'Push artifacts to registry', true),
    ('harbor.artifact.pull', 'harbor', 'artifact', 'pull', 'resource', 'Pull artifacts from registry', true),
    ('harbor.artifact.delete', 'harbor', 'artifact', 'delete', 'resource', 'Delete artifacts', true),
    ('harbor.artifact.scan', 'harbor', 'artifact', 'scan', 'resource', 'Scan artifacts for vulnerabilities', true)
ON CONFLICT (name) DO NOTHING;

-- Environment and Authorization management permissions
INSERT INTO permissions (name, resource, sub_resource, action, scope, description, is_system) VALUES
    ('environment.create', 'environment', NULL, 'create', 'global', 'Create environments', true),
    ('environment.read', 'environment', NULL, 'read', 'global', 'View environment details', true),
    ('environment.update', 'environment', NULL, 'update', 'global', 'Update environments', true),
    ('environment.delete', 'environment', NULL, 'delete', 'global', 'Delete environments', true),
    ('permission.grant', 'permission', NULL, 'grant', 'global', 'Grant permissions to users', true),
    ('permission.revoke', 'permission', NULL, 'revoke', 'global', 'Revoke permissions from users', true),
    ('permission.read', 'permission', NULL, 'read', 'global', 'View user permissions', true),
    ('role.assign', 'role', NULL, 'assign', 'global', 'Assign roles to users', true),
    ('role.remove', 'role', NULL, 'remove', 'global', 'Remove roles from users', true)
ON CONFLICT (name) DO NOTHING;
