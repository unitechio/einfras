export interface Server {
  id: string;
  name: string;
  description: string;
  status: "online" | "offline" | "maintenance" | "error";
  ip_address: string;
  os: "linux" | "windows" | "darwin";
  os_version: string;
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
  location?: string;
  provider?: string;
  ssh_port: number;
  ssh_user: string;
  tunnel_enabled: boolean;
  tunnel_host?: string;
  tunnel_port?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServerFilter {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}
