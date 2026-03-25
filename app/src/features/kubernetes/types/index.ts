export interface K8sCluster {
  id: string;
  name: string;
  server_id: string;
  status: string;
  version: string;
  node_count: number;
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: string;
  node: string;
  ip: string;
  restarts: number;
  age: string;
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  ready_replicas: number;
  desired_replicas: number;
  status: string;
  age: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  cluster_ip: string;
  external_ip: string;
  ports: string;
  age: string;
}

export interface K8sNode {
  name: string;
  status: 'Ready' | 'NotReady' | 'Unknown';
  role: string;
  version: string;
  internal_ip: string;
  cpu_capacity: string;
  memory_capacity: string;
  schedulable?: boolean;
  labels?: string;
  age: string;
}

export interface K8sNodeCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  last_transition_time?: string;
}

export interface K8sNodeTaint {
  key: string;
  value?: string;
  effect?: string;
}

export interface K8sNodeEvent {
  type: string;
  reason: string;
  message: string;
  namespace?: string;
  age?: string;
}

export interface K8sNodePod {
  name: string;
  namespace: string;
  status: string;
  ip?: string;
  age?: string;
}

export interface K8sNodeDetail {
  name: string;
  status: string;
  role: string;
  version: string;
  internal_ip: string;
  os_image?: string;
  kernel_version?: string;
  container_runtime?: string;
  architecture?: string;
  cpu_capacity?: string;
  memory_capacity?: string;
  pod_cidr?: string;
  schedulable: boolean;
  age: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  taints?: K8sNodeTaint[];
  conditions?: K8sNodeCondition[];
  pods?: K8sNodePod[];
  events?: K8sNodeEvent[];
}

export interface K8sNamespace {
  name: string;
  status: string;
  age: string;
}

export interface K8sIngress {
  name: string;
  namespace: string;
  class_name: string;
  hosts: string;
  address: string;
  ports: string;
  age: string;
}

export interface K8sConfigMap {
  name: string;
  namespace: string;
  data_count: number;
  immutable: boolean;
  age: string;
}

export interface K8sSecret {
  name: string;
  namespace: string;
  type: string;
  data_count: number;
  age: string;
}

export interface K8sPersistentVolume {
  name: string;
  capacity: string;
  access_modes: string;
  reclaim_policy: string;
  status: string;
  claim: string;
  storage_class: string;
  age: string;
}

export interface K8sPersistentVolumeClaim {
  name: string;
  namespace: string;
  status: string;
  volume: string;
  capacity: string;
  access_modes: string;
  storage_class: string;
  age: string;
}

export interface K8sJob {
  name: string;
  namespace: string;
  completions: string;
  duration: string;
  age: string;
}

export interface K8sCronJob {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  last_schedule: string;
  age: string;
}

export interface HelmRelease {
  name: string;
  namespace: string;
  revision: string;
  updated: string;
  status: string;
  chart: string;
  app_version: string;
}

export interface K8sGenericResource {
  name: string;
  namespace?: string;
  kind: string;
  status?: string;
  detail?: string;
  secondary_detail?: string;
  group?: string;
  version?: string;
  plural?: string;
  resource_kind?: string;
  scope?: string;
  age: string;
}

export interface ImportedK8sEnvironment {
  id: string;
  name: string;
  endpoint?: string;
  context: string;
  kubeconfig_path: string;
  imported_at: string;
}

export interface K8sTopologyNode {
  id: string;
  kind: string;
  label: string;
  status?: string;
}

export interface K8sTopologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface K8sTopologyGraph {
  nodes: K8sTopologyNode[];
  edges: K8sTopologyEdge[];
}

export interface K8sManifestHistoryEntry {
  id: string;
  environment_id: string;
  kind: string;
  name: string;
  namespace?: string;
  manifest: string;
  created_at: string;
}

export interface K8sSearchResult {
  kind: string;
  name: string;
  namespace?: string;
  status?: string;
  detail?: string;
  secondary_detail?: string;
  age?: string;
}
