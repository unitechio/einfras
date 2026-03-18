-- Remove seeded permissions
DELETE FROM permissions WHERE is_system = true AND name IN (
    -- Server permissions
    'server.*', 'server.create', 'server.read', 'server.update', 'server.delete',
    'server.ssh.execute', 'server.metrics.read',
    
    -- K8s permissions
    'k8s.*', 'k8s.cluster.create', 'k8s.cluster.read', 'k8s.cluster.update', 'k8s.cluster.delete',
    'k8s.namespace.create', 'k8s.namespace.read', 'k8s.namespace.delete',
    'k8s.deployment.create', 'k8s.deployment.read', 'k8s.deployment.update', 'k8s.deployment.delete', 'k8s.deployment.scale',
    'k8s.pod.read', 'k8s.pod.delete', 'k8s.pod.logs.read', 'k8s.pod.exec',
    'k8s.service.create', 'k8s.service.read', 'k8s.service.update', 'k8s.service.delete',
    
    -- Docker permissions
    'docker.*', 'docker.container.create', 'docker.container.read', 'docker.container.start', 'docker.container.stop',
    'docker.container.restart', 'docker.container.delete', 'docker.container.logs.read', 'docker.container.exec',
    'docker.image.pull', 'docker.image.push', 'docker.image.delete',
    
    -- Harbor permissions
    'harbor.*', 'harbor.project.create', 'harbor.project.read', 'harbor.project.update', 'harbor.project.delete',
    'harbor.repository.read', 'harbor.artifact.push', 'harbor.artifact.pull', 'harbor.artifact.delete', 'harbor.artifact.scan',
    
    -- Environment and Authorization permissions
    'environment.create', 'environment.read', 'environment.update', 'environment.delete',
    'permission.grant', 'permission.revoke', 'permission.read',
    'role.assign', 'role.remove'
);
