export interface Server {
  id: string;
  name: string;
  description: string;
  hostname?: string;
  status: "online" | "offline" | "maintenance" | "error";
  ip_address: string;
  os: "linux" | "windows" | "darwin";
  os_version: string;
  environment?: string;
  connection_mode?: "agent" | "ssh" | "bastion";
  onboarding_status?: string;
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
  location?: string;
  provider?: string;
  ssh_port: number;
  ssh_user: string;
  ssh_password?: string;
  ssh_key_path?: string;
  tunnel_enabled: boolean;
  tunnel_host?: string;
  tunnel_port?: number;
  tags?: string[];
  agent_version?: string;
  metrics?: {
    cpu_usage?: number;
    memory_usage?: number;
    container_count?: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface ServerFilter {
  page?: number;
  page_size?: number;
  status?: string;
  os?: string;
  location?: string;
  provider?: string;
  search?: string;
}
