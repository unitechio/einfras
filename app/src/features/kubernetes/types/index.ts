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