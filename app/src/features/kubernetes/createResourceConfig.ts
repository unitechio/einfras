import type { NavigateFunction } from "react-router-dom";

export type K8sCreateResourceDefinition = {
  resourceType: string;
  title: string;
  activeResource: string;
  kind: string;
  addLabel: string;
  namespaced: boolean;
  description?: string;
  starterManifest: (namespace: string) => string;
};

const DEFINITIONS: Record<string, K8sCreateResourceDefinition> = {
  pod: {
    resourceType: "pod",
    title: "Add Pod",
    activeResource: "pods",
    kind: "Pod",
    addLabel: "Create Pod",
    namespaced: true,
    description: "Shape pod metadata and container settings, then apply a clean manifest into the selected namespace.",
    starterManifest: (namespace) => `apiVersion: v1
kind: Pod
metadata:
  name: sample-pod
  namespace: ${namespace}
  labels:
    app: sample-pod
spec:
  containers:
  - name: app
    image: nginx:stable
    ports:
    - containerPort: 80
`,
  },
  service: {
    resourceType: "service",
    title: "Add Service",
    activeResource: "services",
    kind: "Service",
    addLabel: "Add Service",
    namespaced: true,
    description: "Create a Kubernetes Service with selector, ports, and type while keeping the YAML fully editable.",
    starterManifest: (namespace) => `apiVersion: v1
kind: Service
metadata:
  name: sample-service
  namespace: ${namespace}
spec:
  selector:
    app: sample-deployment
  ports:
  - name: http
    port: 80
    targetPort: 80
  type: ClusterIP
`,
  },
  deployment: {
    resourceType: "deployment",
    title: "Add Deployment",
    activeResource: "deployments",
    kind: "Deployment",
    addLabel: "Add Deployment",
    namespaced: true,
    description: "Use the form to scaffold replicas, image, ports, and labels, then review the final rollout YAML before apply.",
    starterManifest: (namespace) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-deployment
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-deployment
  template:
    metadata:
      labels:
        app: sample-deployment
    spec:
      containers:
      - name: app
        image: nginx:stable
        ports:
        - containerPort: 80
`,
  },
  configmap: {
    resourceType: "configmap",
    title: "Add ConfigMap",
    activeResource: "configmaps",
    kind: "ConfigMap",
    addLabel: "Add ConfigMap",
    namespaced: true,
    description: "Draft config data with helper inputs, then validate the final YAML before applying it to the cluster.",
    starterManifest: (namespace) => `apiVersion: v1
kind: ConfigMap
metadata:
  name: sample-config
  namespace: ${namespace}
data:
  APP_ENV: production
  APP_NAME: einfra
`,
  },
  secret: {
    resourceType: "secret",
    title: "Add Secret",
    activeResource: "secrets",
    kind: "Secret",
    addLabel: "Add Secret",
    namespaced: true,
    description: "Use readable stringData inputs where possible, then confirm the generated Secret YAML before apply.",
    starterManifest: (namespace) => `apiVersion: v1
kind: Secret
metadata:
  name: sample-secret
  namespace: ${namespace}
type: Opaque
stringData:
  username: admin
  password: change-me
`,
  },
  ingress: {
    resourceType: "ingress",
    title: "Add Ingress",
    activeResource: "ingresses",
    kind: "Ingress",
    addLabel: "Add Ingress",
    namespaced: true,
    description: "Define routing, backend service, ingress class, and TLS in a focused layout with a live manifest preview.",
    starterManifest: (namespace) => `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sample-ingress
  namespace: ${namespace}
spec:
  ingressClassName: nginx
  rules:
  - host: sample.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: sample-service
            port:
              number: 80
`,
  },
  job: {
    resourceType: "job",
    title: "Add Job",
    activeResource: "jobs",
    kind: "Job",
    addLabel: "Add Job",
    namespaced: true,
    starterManifest: (namespace) => `apiVersion: batch/v1
kind: Job
metadata:
  name: sample-job
  namespace: ${namespace}
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: job
        image: busybox
        command: ["sh", "-c", "echo hello"]
`,
  },
  namespace: {
    resourceType: "namespace",
    title: "Add Namespace",
    activeResource: "namespaces",
    kind: "Namespace",
    addLabel: "Add Namespace",
    namespaced: false,
    starterManifest: () => `apiVersion: v1
kind: Namespace
metadata:
  name: sample-namespace
`,
  },
  persistentvolume: {
    resourceType: "persistentvolume",
    title: "Add Persistent Volume",
    activeResource: "persistent-volumes",
    kind: "PersistentVolume",
    addLabel: "Add Persistent Volume",
    namespaced: false,
    starterManifest: () => `apiVersion: v1
kind: PersistentVolume
metadata:
  name: sample-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /data/sample-pv
`,
  },
};

export function resolveCreateResourceDefinition(resourceType: string) {
  return DEFINITIONS[normalizeResourceType(resourceType)] || null;
}

export function normalizeResourceType(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildCreateResourcePath(
  resourceType: string,
  params?: { clusterId?: string; namespace?: string },
) {
  const search = new URLSearchParams();
  if (params?.clusterId) {
    search.set("cluster", params.clusterId);
  }
  if (params?.namespace) {
    search.set("namespace", params.namespace);
  }
  const query = search.toString();
  return `/resources/${normalizeResourceType(resourceType)}/create${query ? `?${query}` : ""}`;
}

export function openCreateResourcePage(
  navigate: NavigateFunction,
  definition: {
    resourceType: string;
    clusterId?: string;
    namespace?: string;
    title?: string;
    activeResource?: string;
    kind?: string;
    addLabel?: string;
    namespaced?: boolean;
    description?: string;
    starterManifest?: string;
  },
) {
  navigate(buildCreateResourcePath(definition.resourceType, { clusterId: definition.clusterId, namespace: definition.namespace }), {
    state: {
      title: definition.title,
      activeResource: definition.activeResource,
      kind: definition.kind,
      addLabel: definition.addLabel,
      namespaced: definition.namespaced,
      description: definition.description,
      starterManifest: definition.starterManifest,
    },
  });
}
