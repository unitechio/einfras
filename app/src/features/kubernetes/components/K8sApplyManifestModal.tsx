"use client";

import { useEffect, useState } from "react";
import { BookOpenText, FileCode2, Upload, Wand2, X } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { useApplyManifest } from "../api/useKubernetesHooks";
import { useNotification } from "@/core/NotificationContext";
import { tagsApi } from "@/features/catalog/api";

interface K8sApplyManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  namespace: string;
  title?: string;
  starterManifest?: string;
  description?: string;
}

export function K8sApplyManifestModal({
  isOpen,
  onClose,
  clusterId,
  namespace,
  title = "Apply Manifest",
  starterManifest = "",
  description,
}: K8sApplyManifestModalProps) {
  const [manifest, setManifest] = useState(starterManifest);
  const [resourceName, setResourceName] = useState("");
  const [resourceNamespace, setResourceNamespace] = useState(namespace);
  const [labels, setLabels] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [assistedForm, setAssistedForm] = useState(() =>
    buildAssistedFormState(starterManifest, namespace),
  );
  const applyManifest = useApplyManifest(clusterId);
  const { showNotification } = useNotification();

  useEffect(() => {
    tagsApi
      .list()
      .then((items) =>
        setAvailableTags(
          items
            .map((item) => item.name)
            .sort((left, right) => left.localeCompare(right)),
        ),
      )
      .catch(() => setAvailableTags([]));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setManifest(starterManifest);
    setResourceName(
      extractManifestValue(starterManifest, /^\s*name:\s*(.+)\s*$/m),
    );
    setResourceNamespace(
      extractManifestValue(starterManifest, /^\s*namespace:\s*(.+)\s*$/m) ||
        namespace,
    );
    setLabels("");
    setSelectedTags([]);
    setAssistedForm(buildAssistedFormState(starterManifest, namespace));
  }, [isOpen, namespace, starterManifest]);

  if (!isOpen) return null;

  const resourceGuide = getResourceGuide(title, starterManifest);
  const assistedManifest = buildAssistedManifest(
    assistedForm,
    resourceNamespace || namespace,
    resourceName,
  );
  const hydratedManifest = hydrateManifest(assistedManifest || manifest, {
    resourceName,
    namespace: resourceNamespace || namespace,
    labels,
    tags: selectedTags,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
              <p className="text-sm text-zinc-500">
                {description ||
                  `Paste, upload, or shape YAML with form inputs before applying into ${namespace}.`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 gap-5 overflow-hidden px-5 py-4 dark:border-zinc-800 lg:grid-cols-[320px,minmax(0,1fr)]">
          <div className="flex max-h-full flex-col overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <Tabs defaultValue="assistant">
              <TabsList className="px-1">
                <TabsTrigger value="assistant" icon={Wand2}>
                  Assistant
                </TabsTrigger>
                <TabsTrigger value="docs" icon={BookOpenText}>
                  Docs
                </TabsTrigger>
              </TabsList>
              <TabsContent value="assistant" className="space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                    Manifest Assistant
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    Fill only the fields you want to normalize. YAML stays
                    editable, but these inputs help avoid metadata mistakes.
                  </p>
                </div>
                <div className="grid gap-3">
                  <Input
                    value={resourceName}
                    onChange={(event) => setResourceName(event.target.value)}
                    placeholder="Resource name"
                  />
                  <Input
                    value={resourceNamespace}
                    onChange={(event) =>
                      setResourceNamespace(event.target.value)
                    }
                    placeholder="Namespace"
                  />
                  <Input
                    value={labels}
                    onChange={(event) => setLabels(event.target.value)}
                    placeholder="app=demo,tier=web"
                  />
                </div>
                {assistedForm.kind ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {assistedForm.kind} Form
                    </div>
                    <div className="grid gap-3">
                      {renderAssistedFields(assistedForm, setAssistedForm)}
                    </div>
                  </div>
                ) : null}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Suggested tags
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const selected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setSelectedTags((current) =>
                              current.includes(tag)
                                ? current.filter((item) => item !== tag)
                                : [...current, tag],
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${selected ? "border-blue-500 bg-blue-500 text-white" : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-[#121212] dark:text-zinc-300"}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="docs" className="space-y-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-50">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">
                    <BookOpenText className="h-4 w-4" />
                    {resourceGuide.title}
                  </div>
                  <div className="mt-3 space-y-2">
                    {resourceGuide.notes.map((note, index) => (
                      <p key={`${resourceGuide.title}-note-${index}`}>{note}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Recommended flow
                  </div>
                  <div className="mt-3 space-y-2">
                    {resourceGuide.steps.map((step) => (
                      <p key={step}>{step}</p>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex min-h-0 flex-col rounded-[24px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#121212]">
            <div className="space-y-3 border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="file"
                    accept=".yaml,.yml,.json"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      try {
                        const content = await file.text();
                        setManifest(content);
                        setResourceName(
                          extractManifestValue(
                            content,
                            /^\s*name:\s*(.+)\s*$/m,
                          ),
                        );
                        setResourceNamespace(
                          extractManifestValue(
                            content,
                            /^\s*namespace:\s*(.+)\s*$/m,
                          ) || namespace,
                        );
                        showNotification({
                          type: "success",
                          message: "Manifest loaded",
                          description: `${file.name} is ready to review and apply.`,
                        });
                      } catch (error) {
                        showNotification({
                          type: "error",
                          message: "Unable to read manifest file",
                          description:
                            error instanceof Error
                              ? error.message
                              : "File could not be loaded.",
                        });
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />
                  <span className="inline-flex items-center rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload YAML
                  </span>
                </label>
                <Button
                  variant="outline"
                  onClick={() => {
                    setManifest(starterManifest);
                    setResourceName(
                      extractManifestValue(
                        starterManifest,
                        /^\s*name:\s*(.+)\s*$/m,
                      ),
                    );
                    setResourceNamespace(
                      extractManifestValue(
                        starterManifest,
                        /^\s*namespace:\s*(.+)\s*$/m,
                      ) || namespace,
                    );
                    setLabels("");
                  }}
                  disabled={!starterManifest.trim()}
                >
                  Reset Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setManifest(hydratedManifest)}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Apply Form To YAML
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                Keep the YAML as the source of truth, then use the helper only
                when you want names, namespace, labels, or tags refilled
                consistently.
              </p>
            </div>

            <div className="flex-1 min-h-0 p-4">
              <textarea
                value={manifest}
                onChange={(event) => setManifest(event.target.value)}
                spellCheck={false}
                className="h-full min-h-[320px] w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="apiVersion: apps/v1&#10;kind: Deployment&#10;metadata: ..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              applyManifest.mutate(
                {
                  namespace: resourceNamespace || namespace,
                  manifest: hydratedManifest,
                },
                {
                  onSuccess: () => {
                    showNotification({
                      type: "success",
                      message: "Manifest applied",
                      description: `${resourceNamespace || namespace} updated successfully.`,
                    });
                    onClose();
                  },
                  onError: (error: any) => {
                    showNotification({
                      type: "error",
                      message: "Apply manifest failed",
                      description: error?.message || "kubectl apply failed.",
                    });
                  },
                },
              )
            }
            disabled={applyManifest.isPending || !hydratedManifest.trim()}
          >
            {applyManifest.isPending ? "Applying..." : "Apply Manifest"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function extractManifestValue(manifest: string, pattern: RegExp): string {
  const match = manifest.match(pattern);
  return match?.[1]?.trim() || "";
}

function hydrateManifest(
  manifest: string,
  fields: {
    resourceName: string;
    namespace: string;
    labels: string;
    tags: string[];
  },
): string {
  let next = manifest;
  if (fields.resourceName.trim()) {
    next = replaceOrInsertMetadataValue(
      next,
      "name",
      fields.resourceName.trim(),
    );
  }
  if (fields.namespace.trim()) {
    next = replaceOrInsertMetadataValue(
      next,
      "namespace",
      fields.namespace.trim(),
    );
  }
  const mergedLabels = [
    ...fields.labels
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
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
        next = next.replace(
          /^\s*metadata:\s*$/m,
          `metadata:\n  labels:\n${labelLines}`,
        );
      }
    }
  }
  return next;
}

function slugifyK8sLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function replaceOrInsertMetadataValue(
  manifest: string,
  key: string,
  value: string,
): string {
  const pattern = new RegExp(`^(\\s*${key}:\\s*).+$`, "m");
  if (pattern.test(manifest)) {
    return manifest.replace(pattern, `$1${value}`);
  }
  if (/^\s*metadata:\s*$/m.test(manifest)) {
    return manifest.replace(
      /^\s*metadata:\s*$/m,
      `metadata:\n  ${key}: ${value}`,
    );
  }
  return `metadata:\n  ${key}: ${value}\n${manifest}`;
}

function getResourceGuide(title: string, manifest: string) {
  const fingerprint = `${title}\n${manifest}`.toLowerCase();
  if (
    fingerprint.includes("kind: pod") ||
    fingerprint.includes("add pod") ||
    fingerprint.includes("create pod")
  ) {
    return {
      title: "Pod Guide",
      notes: [
        <>
          Set a stable <span className="font-mono">metadata.name</span> and
          verify the namespace before apply.
        </>,
        <>
          At least one container needs both{" "}
          <span className="font-mono">name</span> and{" "}
          <span className="font-mono">image</span>.
        </>,
        <>
          Use labels like <span className="font-mono">app=demo</span> so
          Services and selectors can target the Pod later.
        </>,
      ],
      steps: [
        "Start with metadata and image, then add ports, env, and probes only if needed.",
        "Use Apply Form To YAML when you want helper values merged without hand-editing metadata.",
        "Review the final YAML one last time, then apply into the selected namespace.",
      ],
    };
  }
  if (
    fingerprint.includes("kind: deployment") ||
    fingerprint.includes("deployment")
  ) {
    return {
      title: "Deployment Guide",
      notes: [
        <>
          Keep <span className="font-mono">spec.selector.matchLabels</span>{" "}
          aligned with{" "}
          <span className="font-mono">template.metadata.labels</span>.
        </>,
        <>
          Check desired replicas, container image, and rollout-safe labels
          before applying.
        </>,
        <>
          Use tags and labels to make audit, topology, and alert routing easier
          later.
        </>,
      ],
      steps: [
        "Set replica count and labels first.",
        "Confirm the pod template image, ports, and env values.",
        "Apply once selectors and template labels match exactly.",
      ],
    };
  }
  if (
    fingerprint.includes("kind: ingress") ||
    fingerprint.includes("ingress")
  ) {
    return {
      title: "Ingress Guide",
      notes: [
        <>
          Define host, path, and backend service together so traffic routing is
          obvious.
        </>,
        <>
          If your cluster uses an ingress class, set{" "}
          <span className="font-mono">ingressClassName</span> explicitly.
        </>,
        <>
          TLS sections should reference an existing secret in the same
          namespace.
        </>,
      ],
      steps: [
        "Start with host and path rules.",
        "Point each rule to the correct Service name and port.",
        "Add TLS only after the secret name is ready.",
      ],
    };
  }
  if (fingerprint.includes("kind: secret") || fingerprint.includes("secret")) {
    return {
      title: "Secret Guide",
      notes: [
        <>
          Use <span className="font-mono">stringData</span> for readable
          authoring; Kubernetes will convert it to{" "}
          <span className="font-mono">data</span>.
        </>,
        <>
          Avoid pasting already base64-encoded values unless the manifest
          explicitly expects <span className="font-mono">data</span>.
        </>,
        <>
          Add labels carefully because Secret metadata may show up in audits
          even if values stay hidden.
        </>,
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
      <>
        Labels use comma-separated <span className="font-mono">key=value</span>{" "}
        pairs.
      </>,
      <>Selected tags are converted to Kubernetes-safe labels automatically.</>,
      <>
        Use <span className="font-mono">Apply Form To YAML</span> when you want
        the helper values merged into the editor.
      </>,
    ],
    steps: [
      "Choose namespace and helper values.",
      "Merge helper values into YAML if useful.",
      "Review the final manifest, then apply.",
    ],
  };
}

type AssistedFormState = {
  kind: "Pod" | "Deployment" | "Ingress" | "Secret" | "";
  containerName: string;
  image: string;
  port: string;
  command: string;
  replicas: string;
  host: string;
  path: string;
  serviceName: string;
  ingressClassName: string;
  tlsSecretName: string;
  secretType: string;
  secretEntries: string;
};

function buildAssistedFormState(
  manifest: string,
  namespace: string,
): AssistedFormState {
  const fingerprint = manifest.toLowerCase();
  const kind = fingerprint.includes("kind: pod")
    ? "Pod"
    : fingerprint.includes("kind: deployment")
      ? "Deployment"
      : fingerprint.includes("kind: ingress")
        ? "Ingress"
        : fingerprint.includes("kind: secret")
          ? "Secret"
          : "";
  return {
    kind,
    containerName:
      extractManifestValue(manifest, /^\s*-\s*name:\s*(.+)\s*$/m) || "app",
    image:
      extractManifestValue(manifest, /^\s*image:\s*(.+)\s*$/m) ||
      "nginx:stable",
    port:
      extractManifestValue(manifest, /^\s*containerPort:\s*(.+)\s*$/m) ||
      extractManifestValue(manifest, /^\s*number:\s*(.+)\s*$/m) ||
      "80",
    command: "",
    replicas:
      extractManifestValue(manifest, /^\s*replicas:\s*(.+)\s*$/m) || "1",
    host:
      extractManifestValue(manifest, /^\s*host:\s*(.+)\s*$/m) || "sample.local",
    path: extractManifestValue(manifest, /^\s*path:\s*(.+)\s*$/m) || "/",
    serviceName:
      extractManifestValue(manifest, /^\s*name:\s*sample-service\s*$/m) ||
      "sample-service",
    ingressClassName:
      extractManifestValue(manifest, /^\s*ingressClassName:\s*(.+)\s*$/m) ||
      "nginx",
    tlsSecretName:
      extractManifestValue(manifest, /^\s*secretName:\s*(.+)\s*$/m) ||
      `${namespace}-tls`,
    secretType:
      extractManifestValue(manifest, /^\s*type:\s*(.+)\s*$/m) || "Opaque",
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

function buildAssistedManifest(
  form: AssistedFormState,
  namespace: string,
  resourceName: string,
) {
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
    image: ${form.image || "nginx:stable"}${
      form.port.trim()
        ? `
    ports:
    - containerPort: ${form.port.trim()}`
        : ""
    }${
      form.command.trim()
        ? `
    command: ["sh", "-c", "${form.command.trim().replace(/"/g, '\\"')}"]`
        : ""
    }
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
        image: ${form.image || "nginx:stable"}${
          form.port.trim()
            ? `
        ports:
        - containerPort: ${form.port.trim()}`
            : ""
        }${
          form.command.trim()
            ? `
        command: ["sh", "-c", "${form.command.trim().replace(/"/g, '\\"')}"]`
            : ""
        }
`;
    case "Ingress":
      return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  ingressClassName: ${form.ingressClassName || "nginx"}${
    form.tlsSecretName.trim()
      ? `
  tls:
  - hosts:
    - ${form.host || "sample.local"}
    secretName: ${form.tlsSecretName.trim()}`
      : ""
  }
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

function renderAssistedFields(
  form: AssistedFormState,
  setForm: (updater: (current: AssistedFormState) => AssistedFormState) => void,
) {
  switch (form.kind) {
    case "Pod":
      return (
        <>
          <Input
            value={form.containerName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                containerName: event.target.value,
              }))
            }
            placeholder="Container name"
          />
          <Input
            value={form.image}
            onChange={(event) =>
              setForm((current) => ({ ...current, image: event.target.value }))
            }
            placeholder="Container image"
          />
          <Input
            value={form.port}
            onChange={(event) =>
              setForm((current) => ({ ...current, port: event.target.value }))
            }
            placeholder="Container port"
          />
          <Input
            value={form.command}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                command: event.target.value,
              }))
            }
            placeholder="Optional shell command"
          />
        </>
      );
    case "Deployment":
      return (
        <>
          <Input
            value={form.containerName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                containerName: event.target.value,
              }))
            }
            placeholder="Container name"
          />
          <Input
            value={form.image}
            onChange={(event) =>
              setForm((current) => ({ ...current, image: event.target.value }))
            }
            placeholder="Container image"
          />
          <Input
            value={form.replicas}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                replicas: event.target.value,
              }))
            }
            placeholder="Replicas"
          />
          <Input
            value={form.port}
            onChange={(event) =>
              setForm((current) => ({ ...current, port: event.target.value }))
            }
            placeholder="Container port"
          />
        </>
      );
    case "Ingress":
      return (
        <>
          <Input
            value={form.host}
            onChange={(event) =>
              setForm((current) => ({ ...current, host: event.target.value }))
            }
            placeholder="Host"
          />
          <Input
            value={form.path}
            onChange={(event) =>
              setForm((current) => ({ ...current, path: event.target.value }))
            }
            placeholder="Path"
          />
          <Input
            value={form.serviceName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                serviceName: event.target.value,
              }))
            }
            placeholder="Backend service name"
          />
          <Input
            value={form.port}
            onChange={(event) =>
              setForm((current) => ({ ...current, port: event.target.value }))
            }
            placeholder="Backend service port"
          />
          <Input
            value={form.ingressClassName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                ingressClassName: event.target.value,
              }))
            }
            placeholder="Ingress class"
          />
          <Input
            value={form.tlsSecretName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                tlsSecretName: event.target.value,
              }))
            }
            placeholder="TLS secret name"
          />
        </>
      );
    case "Secret":
      return (
        <>
          <Input
            value={form.secretType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                secretType: event.target.value,
              }))
            }
            placeholder="Secret type"
          />
          <textarea
            value={form.secretEntries}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                secretEntries: event.target.value,
              }))
            }
            className="min-h-[132px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder={"username=admin\npassword=change-me"}
          />
        </>
      );
    default:
      return null;
  }
}
