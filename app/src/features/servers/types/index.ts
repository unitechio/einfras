export interface Server {
  id: string;
  name: string;
  description?: string;
  ip_address: string;
  hostname?: string;
  os: 'ubuntu' | 'debian' | 'centos' | 'rocky' | 'alma' | 'fedora' | 'rhel' | 'windows-server-2016' | 'windows-server-2019' | 'windows-server-2022' | 'macos' | 'linux' | 'windows';
  os_version?: string;
  cpu_cores: number;
  cpu_model?: string;
  memory_gb: number;
  disk_gb: number;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  tags?: string[];
  location?: string;
  provider?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_key_path?: string;
  tunnel_enabled?: boolean;
  tunnel_host?: string;
  tunnel_port?: number;
  tunnel_user?: string;
  tunnel_key_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServerFilter {
  status?: string;
  os?: string;
  location?: string;
  provider?: string;
  tags?: string[];
  page?: number;
  page_size?: number;
}