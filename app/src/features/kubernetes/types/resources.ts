import type { K8sPod, K8sDeployment, K8sService } from "./index";

export type K8sResource = K8sPod | K8sDeployment | K8sService;

export interface K8sNode {
  name: string;
  status: "Ready" | "NotReady" | "Unknown";
  role: string;
  version: string;
  internalIP: string;
  cpuCapacity: string;
  memoryCapacity: string;
  age: string;
}

export interface K8sConfigMap {
  name: string;
  namespace: string;
  dataCount: number;
  age: string;
} 

export interface K8sSecret {
  name: string;
  namespace: string;
  type: string;
  dataCount: number;
  age: string;
}

export interface K8sEvent {
  type: "Normal" | "Warning" | "Error";
  reason: string;
  message: string;
  object: string;
  source: string;
  timestamp: string;
}

export interface K8sNamespace {
  name: string;
  status: string;
  age: string;
}

export type ResourceType = "pods" | "deployments" | "services" | "nodes" | "configmaps" | "secrets";
