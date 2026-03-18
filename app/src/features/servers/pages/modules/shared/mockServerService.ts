
export interface ServiceMetrics {
    cpu: number; // percentage
    memory: number; // MB
    uptime: string;
    pid: number;
    openPorts: number[];
}

export interface ServiceLog {
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
}

export interface Service {
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'failed' | 'reloading';
    bootStatus: 'enabled' | 'disabled';
    unitFile: string;
    execStart: string;
    dependencies: string[];
    metrics?: ServiceMetrics;
}

// --- Installation Types ---

export type InstallMode = 'public' | 'private' | 'relay';

export interface ServiceTemplate {
    id: string;
    name: string;
    description: string;
    category: 'web_server' | 'database' | 'cache' | 'runtime' | 'security';
    defaultPort?: number;
    configFields: {
        key: string;
        label: string;
        type: 'text' | 'number' | 'boolean' | 'password';
        defaultValue?: string | number | boolean;
        required?: boolean;
    }[];
}

export interface ServicePackage {
    name: string;
    version: string;
    description: string;
    repo: string;
    size: string;
}

export interface DryRunResult {
    diskUsage: string;
    newPorts: number[];
    dependencies: string[];
    commands: string[];
}

export interface InstallLog {
    step: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    detail?: string;
}

// --- Mock Data ---

const MOCK_SERVICES: Service[] = [
    {
        name: 'nginx',
        description: 'A high performance web server',
        status: 'active',
        bootStatus: 'enabled',
        unitFile: '/usr/lib/systemd/system/nginx.service',
        execStart: '/usr/sbin/nginx -g daemon on; master_process on;',
        dependencies: [],
        metrics: { cpu: 1.2, memory: 128, uptime: '2d 4h', pid: 1234, openPorts: [80, 443] }
    },
    {
        name: 'mysql',
        description: 'MySQL Community Server',
        status: 'active',
        bootStatus: 'enabled',
        unitFile: '/usr/lib/systemd/system/mysqld.service',
        execStart: '/usr/sbin/mysqld',
        dependencies: [],
        metrics: { cpu: 5.4, memory: 512, uptime: '5d 12h', pid: 1235, openPorts: [3306] }
    },
    {
        name: 'ssh',
        description: 'OpenBSD Secure Shell server',
        status: 'active',
        bootStatus: 'enabled',
        unitFile: '/usr/lib/systemd/system/sshd.service',
        execStart: '/usr/sbin/sshd -D',
        dependencies: [],
        metrics: { cpu: 0.1, memory: 24, uptime: '10d 1h', pid: 888, openPorts: [22] }
    },
    {
        name: 'docker',
        description: 'Docker Application Container Engine',
        status: 'active',
        bootStatus: 'enabled',
        unitFile: '/usr/lib/systemd/system/docker.service',
        execStart: '/usr/bin/dockerd -H fd://',
        dependencies: ['containerd'],
        metrics: { cpu: 8.2, memory: 1024, uptime: '2d 4h', pid: 1100, openPorts: [] }
    },
    {
        name: 'firewalld',
        description: 'firewalld - dynamic firewall daemon',
        status: 'inactive',
        bootStatus: 'disabled',
        unitFile: '/usr/lib/systemd/system/firewalld.service',
        execStart: '/usr/sbin/firewalld --nofork --nopid',
        dependencies: [],
        metrics: { cpu: 0, memory: 0, uptime: '0s', pid: 0, openPorts: [] }
    },
    {
        name: 'redis',
        description: 'Redis persistent key-value database',
        status: 'active',
        bootStatus: 'enabled',
        unitFile: '/usr/lib/systemd/system/redis.service',
        execStart: '/usr/bin/redis-server /etc/redis.conf',
        dependencies: [],
        metrics: { cpu: 0.5, memory: 64, uptime: '2d 4h', pid: 1567, openPorts: [6379] }
    },
    {
        name: 'postgresql',
        description: 'PostgreSQL database server',
        status: 'inactive',
        bootStatus: 'disabled',
        unitFile: '/usr/lib/systemd/system/postgresql.service',
        execStart: '/usr/bin/postmaster -D /var/lib/pgsql/data',
        dependencies: [],
        metrics: { cpu: 0, memory: 0, uptime: '0s', pid: 0, openPorts: [5432] }
    },
    {
        name: 'fail2ban',
        description: 'Fail2Ban Service',
        status: 'active',
        bootStatus: 'enabled',
        unitFile: '/usr/lib/systemd/system/fail2ban.service',
        execStart: '/usr/bin/fail2ban-server -xf start',
        dependencies: [],
        metrics: { cpu: 0.8, memory: 48, uptime: '1d 2h', pid: 2020, openPorts: [] }
    }
];

const LOG_MESSAGES = [
    { level: 'info', message: 'Service started successfully' },
    { level: 'info', message: 'Listening on configured ports' },
    { level: 'warn', message: 'High memory usage detected' },
    { level: 'info', message: 'Connection received from 192.168.1.1' },
    { level: 'error', message: 'Connection timeout' },
    { level: 'info', message: 'Configuration reloaded' },
    { level: 'warn', message: 'Disk space warning' },
    { level: 'info', message: 'Health check passed' }
] as const;

export const mockServerService = {
    getServices: async (): Promise<Service[]> => {
        return new Promise((resolve) => {
            setTimeout(() => resolve([...MOCK_SERVICES]), 800);
        });
    },

    startService: async (serviceName: string): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const service = MOCK_SERVICES.find(s => s.name === serviceName);
                if (service) {
                    service.status = 'active';
                    service.metrics = {
                        cpu: Math.random() * 5,
                        memory: Math.random() * 200 + 50,
                        uptime: '1s',
                        pid: Math.floor(Math.random() * 30000) + 1000,
                        openPorts: [] // In real app, we'd know this
                    };
                }
                resolve();
            }, 1000);
        });
    },

    stopService: async (serviceName: string): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const service = MOCK_SERVICES.find(s => s.name === serviceName);
                if (service) {
                    service.status = 'inactive';
                    service.metrics = { cpu: 0, memory: 0, uptime: '0s', pid: 0, openPorts: [] };
                }
                resolve();
            }, 1000);
        });
    },

    restartService: async (_serviceName: string): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), 2000);
        });
    },

    reloadService: async (_serviceName: string): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), 1000);
        });
    },

    enableService: async (serviceName: string): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const service = MOCK_SERVICES.find(s => s.name === serviceName);
                if (service) service.bootStatus = 'enabled';
                resolve();
            }, 500);
        });
    },

    disableService: async (serviceName: string): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const service = MOCK_SERVICES.find(s => s.name === serviceName);
                if (service) service.bootStatus = 'disabled';
                resolve();
            }, 500);
        });
    },

    getLogs: async (serviceName: string, lines: number = 100): Promise<ServiceLog[]> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const logs: ServiceLog[] = [];
                for (let i = 0; i < lines; i++) {
                    const randomMsg = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
                    logs.push({
                        timestamp: new Date(Date.now() - i * 60000).toISOString(),
                        level: randomMsg.level,
                        message: `[${serviceName}] ${randomMsg.message}`
                    });
                }
                resolve(logs.reverse());
            }, 600);
        });
    },

    // --- Installation Methods ---

    searchPackages: async (query: string): Promise<ServicePackage[]> => {
        return new Promise(resolve => {
            setTimeout(() => {
                const packages: ServicePackage[] = [
                    { name: 'nginx', version: '1.24.0', description: 'High Performance, Web Server, Reverse Proxy', repo: 'official/nginx', size: '2.4 MB' },
                    { name: 'redis', version: '7.2.3', description: 'Persistent key-value database', repo: 'official/redis', size: '3.1 MB' },
                    { name: 'postgresql', version: '16.1', description: 'Object-relational database system', repo: 'official/postgres', size: '14.5 MB' },
                    { name: 'nodejs', version: '20.10.0', description: 'JavaScript Runtime', repo: 'official/node', size: '24 MB' },
                    { name: 'docker', version: '24.0.7', description: 'Container Engine', repo: 'official/docker-ce', size: '65 MB' },
                ];
                if (!query) resolve(packages);
                resolve(packages.filter(p => p.name.includes(query.toLowerCase())));
            }, 500);
        });
    },

    getTemplate: async (pkgName: string): Promise<ServiceTemplate> => {
        return new Promise(resolve => {
            setTimeout(() => {
                if (pkgName.includes('nginx')) {
                    resolve({
                        id: 'nginx', name: 'Nginx', description: 'Web Server', category: 'web_server', defaultPort: 80,
                        configFields: [
                            { key: 'port', label: 'Listen Port', type: 'number', defaultValue: 80, required: true },
                            { key: 'worker_processes', label: 'Worker Processes', type: 'number', defaultValue: 'auto' },
                            { key: 'enable_ssl', label: 'Enable SSL (Self-signed)', type: 'boolean', defaultValue: false }
                        ]
                    });
                } else if (pkgName.includes('mysql') || pkgName.includes('postgre')) {
                    resolve({
                        id: 'db', name: 'Database', description: 'SQL Database', category: 'database', defaultPort: 5432,
                        configFields: [
                            { key: 'port', label: 'Port', type: 'number', defaultValue: 5432, required: true },
                            { key: 'data_dir', label: 'Data Directory', type: 'text', defaultValue: '/var/lib/data' },
                            { key: 'superuser_password', label: 'Superuser Password', type: 'password', required: true }
                        ]
                    });
                } else {
                    resolve({
                        id: 'generic', name: 'Generic Service', description: 'System Service', category: 'runtime',
                        configFields: [
                            { key: 'auto_start', label: 'Auto Start', type: 'boolean', defaultValue: true },
                            { key: 'user', label: 'Run as User', type: 'text', defaultValue: 'root' }
                        ]
                    });
                }
            }, 400);
        });
    },

    simulateDryRun: async (pkg: ServicePackage, config: any): Promise<DryRunResult> => {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    diskUsage: pkg.size,
                    newPorts: config.port ? [Number(config.port)] : [],
                    dependencies: ['openssl', 'libc6', 'systemd'],
                    commands: [
                        `apt-get update`,
                        `apt-get install -y ${pkg.name}=${pkg.version}`,
                        `systemctl enable ${pkg.name}`,
                        `# Applying config: ${JSON.stringify(config)}`
                    ]
                });
            }, 1000);
        });
    },

    installService: (pkg: ServicePackage, config: any, onProgress: (log: InstallLog) => void): Promise<void> => {
        return new Promise(resolve => {
            const steps = [
                { step: 'Initializing', status: 'running' as const, detail: 'Checking system compatibility...' },
                { step: 'Downloading', status: 'running' as const, detail: `Pulling ${pkg.name} from ${pkg.repo}...` },
                { step: 'Verifying', status: 'running' as const, detail: 'Verifying package checksum...' },
                { step: 'Installing', status: 'running' as const, detail: 'Unpacking and configuring...' },
                { step: 'Configuring', status: 'running' as const, detail: 'Applying template settings...' },
                { step: 'Starting', status: 'running' as const, detail: 'Starting service...' },
                { step: 'Completed', status: 'completed' as const, detail: 'Service is ready.' }
            ];

            let i = 0;
            const interval = setInterval(() => {
                if (i >= steps.length) {
                    clearInterval(interval);
                    // Add new service to list
                    MOCK_SERVICES.push({
                        name: pkg.name,
                        description: pkg.description,
                        status: 'active',
                        bootStatus: 'enabled',
                        unitFile: `/usr/lib/systemd/system/${pkg.name}.service`,
                        execStart: `/usr/bin/${pkg.name}`,
                        dependencies: [],
                        metrics: { cpu: 1, memory: 100, uptime: '0s', pid: 9999, openPorts: config.port ? [config.port] : [] }
                    });
                    resolve();
                    return;
                }
                onProgress(steps[i]);
                i++;
            }, 1500);
        });
    }
};

// --- New Features Interfaces ---

export interface ServerUser {
    username: string;
    role: 'admin' | 'operator' | 'read-only';
    permissions: string[];
    groups: string[]; // Added groups
    lastLogin: string;
}

export interface ServerGroup {
    name: string;
    id: number;
    members: string[]; // usernames
    permissions: string[]; // app-level permissions
}

export interface ServerSSHKey {
    id: string;
    name: string;
    fingerprint: string;
    addedBy: string;
    createdAt: string;
}

export interface ServerAuditLog {
    id: string;
    action: string;
    user: string;
    timestamp: string;
    details: string;
    status: 'success' | 'failed';
}

export interface ServerAlert {
    id: string;
    type: 'cpu' | 'disk' | 'memory' | 'service';
    threshold: string;
    status: 'active' | 'resolved';
    lastTriggered?: string;
}

// --- New Mock Data & Methods ---

const MOCK_GROUPS: ServerGroup[] = [
    { name: 'root', id: 0, members: ['root'], permissions: ['all'] },
    { name: 'wheel', id: 10, members: ['root', 'deploy'], permissions: ['sudo'] },
    { name: 'docker', id: 999, members: ['deploy'], permissions: ['docker_socket'] },
    { name: 'developers', id: 1001, members: ['monitor'], permissions: [] },
];

const MOCK_USERS: ServerUser[] = [
    { username: 'root', role: 'admin', permissions: ['all'], groups: ['root', 'wheel'], lastLogin: '2024-05-10T08:00:00Z' },
    { username: 'deploy', role: 'operator', permissions: ['restart_service', 'view_logs'], groups: ['wheel', 'docker'], lastLogin: '2024-05-11T14:30:00Z' },
    { username: 'monitor', role: 'read-only', permissions: ['view_metrics'], groups: ['developers'], lastLogin: '2024-05-12T09:15:00Z' },
];

const MOCK_SSH_KEYS: ServerSSHKey[] = [
    { id: '1', name: 'MacBook Pro', fingerprint: 'SHA256:Attributes...', addedBy: 'root', createdAt: '2024-01-01T10:00:00Z' },
    { id: '2', name: 'CI/CD Runner', fingerprint: 'SHA256:DeployKey...', addedBy: 'deploy', createdAt: '2024-02-15T16:20:00Z' },
];

const MOCK_AUDIT_LOGS: ServerAuditLog[] = [
    { id: '1', action: 'Restart Service', user: 'deploy', timestamp: '2024-05-12T10:00:00Z', details: 'Restarted nginx service', status: 'success' },
    { id: '2', action: 'Update Firewall', user: 'root', timestamp: '2024-05-11T18:45:00Z', details: 'Added rule allowing port 8080', status: 'success' },
    { id: '3', action: 'Failed Login', user: 'unknown', timestamp: '2024-05-10T03:12:00Z', details: 'SSH login failed from 192.168.1.5', status: 'failed' },
];

const MOCK_ALERTS: ServerAlert[] = [
    { id: '1', type: 'cpu', threshold: '> 90%', status: 'resolved', lastTriggered: '2024-05-09T14:00:00Z' },
    { id: '2', type: 'disk', threshold: '> 95%', status: 'active', lastTriggered: '2024-05-12T11:00:00Z' },
];

export const mockSecurityService = {
    getUsers: async (): Promise<ServerUser[]> => {
        return new Promise(resolve => setTimeout(() => resolve([...MOCK_USERS]), 600));
    },

    getGroups: async (): Promise<ServerGroup[]> => {
        return new Promise(resolve => setTimeout(() => resolve([...MOCK_GROUPS]), 500));
    },

    getSSHKeys: async (): Promise<ServerSSHKey[]> => {
        return new Promise(resolve => setTimeout(() => resolve([...MOCK_SSH_KEYS]), 500));
    },

    addSSHKey: async (key: Omit<ServerSSHKey, 'id' | 'createdAt'>): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            MOCK_SSH_KEYS.push({ ...key, id: Math.random().toString(), createdAt: new Date().toISOString() });
            resolve();
        }, 800));
    },

    deleteSSHKey: async (id: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            const index = MOCK_SSH_KEYS.findIndex(k => k.id === id);
            if (index !== -1) MOCK_SSH_KEYS.splice(index, 1);
            resolve();
        }, 500));
    },

    getAuditLogs: async (): Promise<ServerAuditLog[]> => {
        return new Promise(resolve => setTimeout(() => resolve([...MOCK_AUDIT_LOGS]), 700));
    },

    getAlerts: async (): Promise<ServerAlert[]> => {
        return new Promise(resolve => setTimeout(() => resolve([...MOCK_ALERTS]), 400));
    },

    addUser: async (user: Omit<ServerUser, 'lastLogin'>): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            MOCK_USERS.push({ ...user, lastLogin: new Date().toISOString() });
            resolve();
        }, 800));
    },

    addGroup: async (groupName: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            console.log("Mock: Added group", groupName);
            MOCK_GROUPS.push({ name: groupName, id: Math.floor(Math.random() * 9000) + 1000, members: [], permissions: [] });
            resolve();
        }, 800));
    },

    deleteGroup: async (id: number): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            const index = MOCK_GROUPS.findIndex(g => g.id === id);
            if (index !== -1) MOCK_GROUPS.splice(index, 1);
            resolve();
        }, 500));
    },

    updateGroup: async (id: number, name: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            const group = MOCK_GROUPS.find(g => g.id === id);
            if (group) group.name = name;
            resolve();
        }, 500));
    },

    addGroupMember: async (groupId: number, username: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            const group = MOCK_GROUPS.find(g => g.id === groupId);
            if (group && !group.members.includes(username)) {
                group.members.push(username);
                // Update user-side list for consistency
                const user = MOCK_USERS.find(u => u.username === username);
                if (user && !user.groups.includes(group.name)) user.groups.push(group.name);
            }
            resolve();
        }, 400));
    },

    removeGroupMember: async (groupId: number, username: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            const group = MOCK_GROUPS.find(g => g.id === groupId);
            if (group) {
                group.members = group.members.filter(m => m !== username);
                // Update user-side list for consistency
                const user = MOCK_USERS.find(u => u.username === username);
                if (user) user.groups = user.groups.filter(g => g !== group.name);
            }
            resolve();
        }, 400));
    },

    updateUserGroups: async (username: string, groups: string[]): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            const user = MOCK_USERS.find(u => u.username === username);
            if (user) user.groups = groups;
            resolve();
        }, 600));
    },

    generateSSHKey: async (name: string): Promise<{ privateKey: string, publicKey: string }> => {
        return new Promise(resolve => setTimeout(() => {
            resolve({
                privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nMgcmFuZ... (mock key for ${name}) ...\n-----END OPENSSH PRIVATE KEY-----`,
                publicKey: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... mock-key-${name}`
            });
        }, 1500));
    },

    // --- New Feature Methods ---

    getServerInfo: async (): Promise<any> => {
        return new Promise(resolve => setTimeout(() => resolve({
            hostname: 'production-db',
            os: 'Ubuntu 22.04 LTS (Jammy Jellyfish)',
            kernel: '5.15.0-91-generic',
            arch: 'x86_64',
            uptime: '15 days, 4 hours',
            ip: '192.168.1.10',
            description: 'Main production database server running MySQL and Redis.',
            tags: 'production, db, high-availability'
        }), 400));
    },

    getProcesses: async (): Promise<any[]> => {
        return new Promise(resolve => setTimeout(() => resolve([
            { pid: 1, user: 'root', cpu: 0.1, mem: 0.5, command: '/usr/lib/systemd/systemd', ports: [] },
            { pid: 885, user: 'root', cpu: 0.0, mem: 1.2, command: '/usr/bin/containerd', ports: [] },
            { pid: 1024, user: 'mysql', cpu: 2.4, mem: 15.2, command: '/usr/sbin/mysqld', ports: [3306] },
            { pid: 2048, user: 'www-data', cpu: 1.1, mem: 8.5, command: 'nginx: worker process', ports: [80, 443] },
            { pid: 3001, user: 'root', cpu: 5.5, mem: 4.2, command: 'python3 ./ml_job.py', ports: [8080] },
        ]), 600));
    },

    getNetworkInterfaces: async (): Promise<any[]> => {
        return new Promise(resolve => setTimeout(() => resolve([
            { name: 'eth0', ip: '192.168.1.10', mask: '255.255.255.0', mac: 'AA:BB:CC:DD:EE:FF', rx: '1.2 GB', tx: '500 MB', status: 'up' },
            { name: 'lo', ip: '127.0.0.1', mask: '255.0.0.0', mac: '00:00:00:00:00:00', rx: '40 MB', tx: '40 MB', status: 'up' },
            { name: 'docker0', ip: '172.17.0.1', mask: '255.255.0.0', mac: '02:42:AC:11:00:02', rx: '120 MB', tx: '2.1 GB', status: 'up' },
        ]), 500));
    },

    getStorage: async (): Promise<any> => {
        return new Promise(resolve => setTimeout(() => resolve({
            disks: [
                { mount: '/', device: '/dev/sda1', type: 'ext4', total: '100 GB', used: '45 GB', available: '55 GB', percent: 45 },
                { mount: '/var', device: '/dev/sdb1', type: 'xfs', total: '50 GB', used: '28 GB', available: '22 GB', percent: 56 },
            ],
            files: [
                { name: 'nginx.conf', size: '2 KB', type: 'file', modified: '2024-05-15 10:00' },
                { name: 'www', size: '-', type: 'dir', modified: '2024-05-10 09:30' },
                { name: 'backup.tar.gz', size: '1.2 GB', type: 'file', modified: '2024-05-01 02:00' },
                { name: 'error.log', size: '45 MB', type: 'file', modified: '2024-05-12 11:20' },
            ]
        }), 700));
    },

    getInstalledPackages: async (): Promise<any[]> => {
        return new Promise(resolve => setTimeout(() => resolve([
            { name: 'curl', version: '7.81.0', arch: 'amd64' },
            { name: 'git', version: '2.34.1', arch: 'amd64' },
            { name: 'vim', version: '8.2', arch: 'amd64' },
            { name: 'docker-ce', version: '24.0.0', arch: 'amd64' },
            { name: 'nginx', version: '1.18.0', arch: 'amd64' },
        ]), 800));
    },

    // --- Access & File Management ---

    updateUserPermissions: async (username: string, permissions: string[]): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            const user = MOCK_USERS.find(u => u.username === username);
            if (user) {
                user.permissions = permissions;
            }
            resolve();
        }, 600));
    },

    createFolder: async (path: string, name: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            console.log(`Mock: Created folder ${name} in ${path}`);
            resolve();
        }, 500));
    },

    deleteFile: async (path: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            console.log(`Mock: Deleted ${path}`);
            resolve();
        }, 500));
    },

    moveFile: async (source: string, destination: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            console.log(`Mock: Moved ${source} to ${destination}`);
            resolve();
        }, 700));
    },

    copyFile: async (source: string, destination: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            console.log(`Mock: Copied ${source} to ${destination}`);
            resolve();
        }, 800));
    },

    chmod: async (path: string, mode: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            console.log(`Mock: Chmod ${mode} on ${path}`);
            resolve();
        }, 400));
    },

    chown: async (path: string, owner: string, group: string): Promise<void> => {
        return new Promise(resolve => setTimeout(() => {
            console.log(`Mock: Chown ${owner}:${group} on ${path}`);
            resolve();
        }, 400));
    }
};
