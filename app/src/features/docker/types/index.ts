export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: { IP: string; PrivatePort: number; PublicPort?: number; Type: string }[];
  Labels: Record<string, string>;
}

export interface DockerImage {
  Id: string;
  ParentId: string;
  RepoTags: string[];
  RepoDigests: string[];
  Created: number;
  Size: number;
  VirtualSize: number;
  SharedSize: number;
  Labels: Record<string, string>;
  Containers: number;
}

export interface DockerNetwork {
  Id: string;
  Name: string;
  Scope: string;
  Driver: string;
  EnableIPv6: boolean;
  Internal: boolean;
  Created: string;
}

export interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  CreatedAt: string;
  Labels: Record<string, string>;
}

export interface DockerStack {
  Name: string;
  Services: number;
  Status: string;
  CreatedAt: string;
}

export interface DockerTopologyNode {
  id: string;
  label: string;
  kind: "container" | "network" | "volume" | "bind" | string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface DockerTopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DockerTopology {
  nodes: DockerTopologyNode[];
  edges: DockerTopologyEdge[];
}

export interface RuntimeAuditRecord {
  id: string;
  environment_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  status: string;
  details?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RuntimeAuditFilters {
  search?: string;
  status?: string;
  action?: string;
  actor?: string;
  resource_type?: string;
  tag?: string;
  from?: string;
  to?: string;
}

export interface DockerAutoHealPolicy {
  id: string;
  environment_id: string;
  name: string;
  target_mode: "all" | "name" | "label" | string;
  match_value?: string;
  trigger: "unhealthy" | "exited" | "stopped" | string;
  action: "restart" | string;
  interval_minutes: number;
  enabled: boolean;
  last_run_at?: string;
  last_outcome?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DockerContainerCreateRequest {
  name?: string;
  image: string;
  command?: string[];
  environment?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
  labels?: Record<string, string>;
  restart_policy?: "no" | "always" | "unless-stopped" | "on-failure" | string;
  registry_id?: string;
  auto_start?: boolean;
  healthcheck_command?: string;
  healthcheck_interval?: string;
  healthcheck_timeout?: string;
  healthcheck_start_period?: string;
  healthcheck_retries?: number;
  healthcheck_disabled?: boolean;
}

export interface DockerContainerConfig extends DockerContainerCreateRequest {
  id: string;
  name: string;
  image: string;
  command: string[];
  environment: Record<string, string>;
  ports: string[];
  volumes: string[];
  labels: Record<string, string>;
  restart_policy: string;
  state: string;
  health_status?: string;
  alerts?: string[];
  healthcheck_command?: string;
  healthcheck_interval?: string;
  healthcheck_timeout?: string;
  healthcheck_start_period?: string;
  healthcheck_retries?: number;
  healthcheck_disabled?: boolean;
  inspect?: Record<string, unknown>;
}

export interface DockerStackService {
  id: string;
  name: string;
  image: string;
  replicas: string;
  ports?: string;
}

export interface DockerSecretAsset {
  name: string;
  value: string;
  updated_at?: string;
}

export interface DockerFileEntry {
  name: string;
  path: string;
  size: number;
  mode: string;
  is_dir: boolean;
  modified: string;
}

export interface DockerContainerStats {
  cpu_perc: string;
  mem_usage: string;
  mem_perc: string;
  net_io: string;
  block_io: string;
  pids: string;
  read_at: string;
  raw_payload?: string;
}

export interface DockerServiceDetail {
  id: string;
  name: string;
  image: string;
  mode: string;
  replicas: string;
  ports: string;
  labels: Record<string, string>;
  command: string[];
  arguments: string[];
  env: string[];
  networks: string[];
  created_at: string;
  updated_at: string;
  stack: string;
  endpoint_mode: string;
}

export interface DockerRegistryCatalog {
  registry_id: string;
  registry_name: string;
  repositories: string[];
  tags?: Record<string, string[]>;
}

export interface DockerImageExportResult {
  message: string;
  path: string;
}

export interface DockerImageImportResult {
  loaded_images: string[];
  output: string;
}

export interface DockerBuildHistoryRecord {
  id: string;
  environment_id: string;
  created_at: string;
  target: string;
  dockerfile: string;
  status: "success" | "failed" | string;
  output: string;
  context_name?: string;
  context_id?: string;
  context_path?: string;
  context_size?: number;
  archive_name?: string;
  tags?: string[];
}

export interface DockerSwarmStatus {
  local_node_state: string;
  control_available: boolean;
  node_id?: string;
  error?: string;
  is_manager: boolean;
  is_active: boolean;
}

export interface DockerRuntimeOperation {
  id: string;
  environment_id: string;
  kind: string;
  status: string;
  started_at: string;
  completed_at?: string;
  log_size: number;
  result?: Record<string, unknown>;
}
