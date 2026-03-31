export type AssistedFormState = {
  kind: "Pod" | "Deployment" | "Service" | "ConfigMap" | "Ingress" | "Secret" | "";
  containerName: string;
  image: string;
  port: string;
  command: string;
  replicas: string;
  serviceType: string;
  targetPort: string;
  selector: string;
  configEntries: Array<{ id: string; key: string; value: string }>;
  host: string;
  path: string;
  serviceName: string;
  ingressClassName: string;
  tlsSecretName: string;
  secretType: string;
  secretEntries: string;
};

export type ResourceGuide = {
  title: string;
  notes: string[];
  steps: string[];
};

export function extractManifestValue(manifest: string, pattern: RegExp): string {
  const match = manifest.match(pattern);
  return match?.[1]?.trim() || "";
}

export function hydrateManifest(
  manifest: string,
  fields: { resourceName: string; namespace: string; labels: Array<{ id: string; key: string; value: string }>; tags: string[] },
): string {
  let next = manifest;
  if (fields.resourceName.trim()) {
    next = replaceOrInsertMetadataValue(next, "name", fields.resourceName.trim());
  }
  if (fields.namespace.trim()) {
    next = replaceOrInsertMetadataValue(next, "namespace", fields.namespace.trim());
  }
  const mergedLabels = [
    ...fields.labels
      .filter((l) => l.key.trim())
      .map((l) => `${l.key.trim()}=${l.value.trim()}`),
    ...fields.tags.map((tag) => `einfra.io/tag-${slugifyK8sLabel(tag)}=true`),
  ];
  if (mergedLabels.length) {
    const labelLines = mergedLabels
      .map((entry) => {
        const [key, value = ""] = entry.split("=");
        return `    ${key.trim()}: ${value.trim()}`;
      })
      .join("\n");
    if (labelLines) {
      if (/^\s*labels:\s*$/m.test(next)) {
        next = next.replace(/^\s*labels:\s*$/m, `  labels:\n${labelLines}`);
      } else if (/^\s*metadata:\s*$/m.test(next)) {
        next = next.replace(/^\s*metadata:\s*$/m, `metadata:\n  labels:\n${labelLines}`);
      }
    }
  }
  return next;
}

export function slugifyK8sLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function replaceOrInsertMetadataValue(manifest: string, key: string, value: string): string {
  const normalized = manifest.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const metadataIndex = lines.findIndex((line) => /^\s*metadata:\s*$/.test(line));

  if (metadataIndex === -1) {
    return `metadata:\n  ${key}: ${value}\n${normalized}`;
  }

  const metadataIndent = lines[metadataIndex].match(/^\s*/)?.[0].length ?? 0;
  const fieldIndent = metadataIndent + 2;
  let metadataEndIndex = lines.length;

  for (let index = metadataIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= metadataIndent) {
      metadataEndIndex = index;
      break;
    }
  }

  const fieldPattern = new RegExp(`^\\s{${fieldIndent}}${key}:\\s*.*$`);
  for (let index = metadataIndex + 1; index < metadataEndIndex; index += 1) {
    if (fieldPattern.test(lines[index])) {
      lines[index] = `${" ".repeat(fieldIndent)}${key}: ${value}`;
      return lines.join("\n");
    }
  }

  lines.splice(metadataEndIndex, 0, `${" ".repeat(fieldIndent)}${key}: ${value}`);
  return lines.join("\n");
}

export function getResourceGuide(title: string, manifest: string): ResourceGuide {
  const fingerprint = `${title}\n${manifest}`.toLowerCase();
  if (fingerprint.includes("kind: pod") || fingerprint.includes("add pod") || fingerprint.includes("create pod")) {
    return {
      title: "Pod Guide",
      notes: [
        "Set a stable metadata.name and verify the namespace before apply.",
        "At least one container needs both name and image.",
        "Use labels like app=demo so Services and selectors can target the Pod later.",
      ],
      steps: [
        "Start with metadata and image, then add ports, env, and probes only if needed.",
        "Use Apply Form To YAML when you want helper values merged without hand-editing metadata.",
        "Review the final YAML one last time, then apply into the selected namespace.",
      ],
    };
  }
  if (fingerprint.includes("kind: deployment") || fingerprint.includes("deployment")) {
    return {
      title: "Deployment Guide",
      notes: [
        "Keep spec.selector.matchLabels aligned with template.metadata.labels.",
        "Check desired replicas, container image, and rollout-safe labels before applying.",
        "Use tags and labels to make audit, topology, and alert routing easier later.",
      ],
      steps: [
        "Set replica count and labels first.",
        "Confirm the pod template image, ports, and env values.",
        "Apply once selectors and template labels match exactly.",
      ],
    };
  }
  if (fingerprint.includes("kind: ingress") || fingerprint.includes("ingress")) {
    return {
      title: "Ingress Guide",
      notes: [
        "Define host, path, and backend service together so traffic routing is obvious.",
        "If your cluster uses an ingress class, set ingressClassName explicitly.",
        "TLS sections should reference an existing secret in the same namespace.",
      ],
      steps: [
        "Start with host and path rules.",
        "Point each rule to the correct Service name and port.",
        "Add TLS only after the secret name is ready.",
      ],
    };
  }
  if (fingerprint.includes("kind: service") || fingerprint.includes("add service") || fingerprint.includes("create service")) {
    return {
      title: "Service Guide",
      notes: [
        "Keep selector labels aligned with the workload labels you want this Service to target.",
        "Port is the Service-facing port, targetPort is the container-facing port.",
        "Switch the type carefully because NodePort or LoadBalancer changes exposure immediately.",
      ],
      steps: [
        "Name the service and confirm namespace first.",
        "Set selector, port mapping, and service type.",
        "Review the final YAML preview before applying network exposure changes.",
      ],
    };
  }
  if (fingerprint.includes("kind: configmap") || fingerprint.includes("configmap")) {
    return {
      title: "ConfigMap Guide",
      notes: [
        "Use clear key names because workload mounts and env references depend on exact keys.",
        "Prefer a few high-signal entries instead of very large blobs when editing inline.",
        "If the ConfigMap is shared, keep labels consistent so consumers are easier to trace later.",
      ],
      steps: [
        "Define name and namespace first.",
        "Add key-value entries in the helper, then merge them into YAML.",
        "Review final YAML to avoid accidental formatting changes in multi-line config.",
      ],
    };
  }
  if (fingerprint.includes("kind: secret") || fingerprint.includes("secret")) {
    return {
      title: "Secret Guide",
      notes: [
        "Use stringData for readable authoring; Kubernetes will convert it to data.",
        "Avoid pasting already base64-encoded values unless the manifest explicitly expects data.",
        "Add labels carefully because Secret metadata may show up in audits even if values stay hidden.",
      ],
      steps: [
        "Choose the secret type and metadata first.",
        "Fill stringData keys with plain values.",
        "Review namespace and key names before apply.",
      ],
    };
  }
  return {
    title: "Quick Notes",
    notes: [
      "Labels use comma-separated key=value pairs.",
      "Selected tags are converted to Kubernetes-safe labels automatically.",
      "Use Apply Form To YAML when you want the helper values merged into the editor.",
    ],
    steps: [
      "Choose namespace and helper values.",
      "Merge helper values into YAML if useful.",
      "Review the final manifest, then apply.",
    ],
  };
}

export function buildAssistedFormState(manifest: string, namespace: string): AssistedFormState {
  const fingerprint = manifest.toLowerCase();
  const kind = fingerprint.includes("kind: pod")
    ? "Pod"
    : fingerprint.includes("kind: deployment")
      ? "Deployment"
      : fingerprint.includes("kind: service")
        ? "Service"
        : fingerprint.includes("kind: configmap")
          ? "ConfigMap"
      : fingerprint.includes("kind: ingress")
        ? "Ingress"
        : fingerprint.includes("kind: secret")
          ? "Secret"
          : "";
  return {
    kind,
    containerName: extractManifestValue(manifest, /^\s*-\s*name:\s*(.+)\s*$/m) || "app",
    image: extractManifestValue(manifest, /^\s*image:\s*(.+)\s*$/m) || "nginx:stable",
    port:
      extractManifestValue(manifest, /^\s*containerPort:\s*(.+)\s*$/m) ||
      extractManifestValue(manifest, /^\s*number:\s*(.+)\s*$/m) ||
      "80",
    command: "",
    replicas: extractManifestValue(manifest, /^\s*replicas:\s*(.+)\s*$/m) || "1",
    serviceType: extractManifestValue(manifest, /^\s*type:\s*(.+)\s*$/m) || "ClusterIP",
    targetPort: extractManifestValue(manifest, /^\s*targetPort:\s*(.+)\s*$/m) || "80",
    selector: extractSelectorEntries(manifest) || "app=sample-app",
    configEntries: extractConfigEntries(manifest),
    host: extractManifestValue(manifest, /^\s*host:\s*(.+)\s*$/m) || "sample.local",
    path: extractManifestValue(manifest, /^\s*path:\s*(.+)\s*$/m) || "/",
    serviceName: extractManifestValue(manifest, /^\s*name:\s*sample-service\s*$/m) || "sample-service",
    ingressClassName: extractManifestValue(manifest, /^\s*ingressClassName:\s*(.+)\s*$/m) || "nginx",
    tlsSecretName: extractManifestValue(manifest, /^\s*secretName:\s*(.+)\s*$/m) || `${namespace}-tls`,
    secretType: extractManifestValue(manifest, /^\s*type:\s*(.+)\s*$/m) || "Opaque",
    secretEntries: extractSecretEntries(manifest),
  };
}

function extractSecretEntries(manifest: string) {
  const match = manifest.match(/stringData:\n([\s\S]+)$/m);
  if (!match?.[1]) {
    return "username=admin\npassword=change-me";
  }
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(":"))
    .map((line) => line.replace(":", "="))
    .join("\n");
}

export function buildAssistedManifest(form: AssistedFormState, namespace: string, resourceName: string) {
  const name = resourceName.trim() || "sample-resource";
  switch (form.kind) {
    case "Pod":
      return `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: ${name}
spec:
  containers:
  - name: ${form.containerName || "app"}
    image: ${form.image || "nginx:stable"}${form.port.trim() ? `
    ports:
    - containerPort: ${form.port.trim()}` : ""}${form.command.trim() ? `
    command: ["sh", "-c", "${form.command.trim().replace(/"/g, '\\"')}"]` : ""}
`;
    case "Deployment":
      return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: ${form.replicas || "1"}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: ${form.containerName || "app"}
        image: ${form.image || "nginx:stable"}${form.port.trim() ? `
        ports:
        - containerPort: ${form.port.trim()}` : ""}${form.command.trim() ? `
        command: ["sh", "-c", "${form.command.trim().replace(/"/g, '\\"')}"]` : ""}
`;
    case "Ingress":
      return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  ingressClassName: ${form.ingressClassName || "nginx"}${form.tlsSecretName.trim() ? `
  tls:
  - hosts:
    - ${form.host || "sample.local"}
    secretName: ${form.tlsSecretName.trim()}` : ""}
  rules:
  - host: ${form.host || "sample.local"}
    http:
      paths:
      - path: ${form.path || "/"}
        pathType: Prefix
        backend:
          service:
            name: ${form.serviceName || "sample-service"}
            port:
              number: ${form.port || "80"}
`;
    case "Service":
      return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  selector:
${toKeyValueYaml(form.selector, 4)}
  ports:
  - name: http
    port: ${form.port || "80"}
    targetPort: ${form.targetPort || form.port || "80"}
  type: ${form.serviceType || "ClusterIP"}
`;
    case "ConfigMap":
      return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
  namespace: ${namespace}
data:
${generateConfigMapDataYaml(form.configEntries)}
`;
    case "Secret":
      return `apiVersion: v1
kind: Secret
metadata:
  name: ${name}
  namespace: ${namespace}
type: ${form.secretType || "Opaque"}
stringData:
${toSecretYaml(form.secretEntries)}
`;
    default:
      return "";
  }
}

function toSecretYaml(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return `  ${key.trim()}: ${(rest.join("=") || "").trim()}`;
    })
    .join("\n");
}

function extractConfigEntries(manifest: string): Array<{ id: string; key: string; value: string }> {
  const match = manifest.match(/^data:\n([\s\S]+?)(?:^\w|$)/m) || manifest.match(/data:\n([\s\S]+)$/m);
  if (!match?.[1]) {
    return [
      { id: crypto.randomUUID?.() || Math.random().toString(), key: "APP_ENV", value: "production" },
      { id: crypto.randomUUID?.() || Math.random().toString(), key: "APP_NAME", value: "einfra" },
    ];
  }
  const lines = match[1].split("\n");
  const entries: Array<{ id: string; key: string; value: string }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex !== -1) {
      let key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();
      
      // Remove surrounding quotes if any
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
      }
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      entries.push({
        id: crypto.randomUUID?.() || Math.random().toString(),
        key,
        value,
      });
    }
  }
  return entries.length ? entries : [{ id: crypto.randomUUID?.() || Math.random().toString(), key: "", value: "" }];
}

function generateConfigMapDataYaml(entries: Array<{ id: string; key: string; value: string }>) {
  const validEntries = entries.filter((e) => e.key.trim());
  if (validEntries.length === 0) {
    return '  APP_ENV: "production"';
  }
  return validEntries
    .map((e) => {
      const k = e.key.trim();
      // Ensure values are strings without trailing colons and wrapped in double quotes
      let v = e.value.trim();
      if (v.endsWith(":")) {
        v = v.slice(0, -1);
      }
      // Re-escape internal double quotes if necessary and wrap
      const jsonValue = JSON.stringify(v);
      return `  ${k}: ${jsonValue}`;
    })
    .join("\n");
}

function extractSelectorEntries(manifest: string) {
  const match = manifest.match(/selector:\n([\s\S]+?)(\n\s*[A-Za-z]+:|\n\s*ports:|\n\s*type:|$)/m);
  if (!match?.[1]) {
    return "";
  }
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(":"))
    .map((line) => line.replace(":", "="))
    .join("\n");
}

function toKeyValueYaml(value: string, indent: number) {
  const prefix = " ".repeat(indent);
  const fallback = indent === 4 ? `${prefix}app: sample-app` : `${prefix}APP_ENV: production`;
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return `${prefix}${key.trim()}: ${(rest.join("=") || "").trim()}`;
    });
  return lines.length > 0 ? lines.join("\n") : fallback;
}
