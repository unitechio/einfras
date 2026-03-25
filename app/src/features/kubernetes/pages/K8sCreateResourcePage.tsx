import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, Copy, Download, Eye, FileCode2, GitCompareArrows, Save, Search, Upload, Wand2 } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { tagsApi } from "@/features/catalog/api";
import { useApplyManifest, useClusters, useNamespaces } from "../api/useKubernetesHooks";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { resolveCreateResourceDefinition } from "../createResourceConfig";
import {
  buildAssistedFormState,
  buildAssistedManifest,
  extractManifestValue,
  hydrateManifest,
  type AssistedFormState,
} from "../manifest-assistant";

type LocationState = {
  title?: string;
  activeResource?: string;
  kind?: string;
  addLabel?: string;
  namespaced?: boolean;
  description?: string;
  starterManifest?: string;
};

type TabKey = "form" | "yaml" | "diff";
type LeaveIntent = null | "back" | "cancel";

const TEMPLATE_MODES = [
  { value: "starter", label: "Starter template" },
  { value: "blank", label: "Blank YAML" },
];

export default function K8sCreateResourcePage() {
  const { resourceType = "service" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedEnvironment } = useEnvironment();
  const { showNotification } = useNotification();
  const state = (location.state ?? {}) as LocationState;
  const fallback = resolveCreateResourceDefinition(resourceType);

  const title = state.title || fallback?.title || "Create Resource";
  const activeResource = state.activeResource || fallback?.activeResource || `${resourceType}s`;
  const description =
    state.description ||
    fallback?.description ||
    "Use the form to fill the high-signal fields, then review the final YAML before applying into the cluster.";
  const addLabel = state.addLabel || fallback?.addLabel || "Apply Resource";
  const namespaced = state.namespaced ?? fallback?.namespaced ?? true;
  const initialNamespace = searchParams.get("namespace") || "default";
  const defaultStarterManifest = useMemo(() => {
    if (typeof state.starterManifest === "string" && state.starterManifest.trim()) {
      return state.starterManifest;
    }
    return fallback?.starterManifest(initialNamespace) || "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: sample\n";
  }, [fallback, initialNamespace, state.starterManifest]);

  const initialName = useMemo(() => extractManifestValue(defaultStarterManifest, /^\s*name:\s*(.+)\s*$/m), [defaultStarterManifest]);
  const initialManifestNamespace = useMemo(
    () => extractManifestValue(defaultStarterManifest, /^\s*namespace:\s*(.+)\s*$/m) || initialNamespace,
    [defaultStarterManifest, initialNamespace],
  );

  const { data: clusterData } = useClusters();
  const clusters = clusterData?.data || [];
  const [selectedClusterId, setSelectedClusterId] = useState(searchParams.get("cluster") || "");
  const [namespace, setNamespace] = useState(initialNamespace);
  const [templateMode, setTemplateMode] = useState<"starter" | "blank">("starter");
  const [manifest, setManifest] = useState(defaultStarterManifest);
  const [resourceName, setResourceName] = useState(initialName);
  const [resourceNamespace, setResourceNamespace] = useState(initialManifestNamespace);
  const [labels, setLabels] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("form");
  const [assistedForm, setAssistedForm] = useState<AssistedFormState>(() => buildAssistedFormState(defaultStarterManifest, initialNamespace));
  const [leaveIntent, setLeaveIntent] = useState<LeaveIntent>(null);
  const appliedRef = useRef(defaultStarterManifest);
  const allowNextLeaveRef = useRef(false);

  useEffect(() => {
    tagsApi
      .list()
      .then((items) => setAvailableTags(items.map((item) => item.name).sort((left, right) => left.localeCompare(right))))
      .catch(() => setAvailableTags([]));
  }, []);

  useEffect(() => {
    if (selectedEnvironment?.type === "kubernetes" && selectedEnvironment.id !== selectedClusterId) {
      setSelectedClusterId(selectedEnvironment.id);
      return;
    }
    if (!selectedClusterId && clusters.length > 0) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId, selectedEnvironment]);

  const { data: namespacesData = [] } = useNamespaces(selectedClusterId, { watch: true });
  const namespaces = namespacesData.map((item) => item.name);

  useEffect(() => {
    if (!namespaced) {
      return;
    }
    if (namespaces.length && !namespaces.includes(namespace)) {
      setNamespace(namespaces[0]);
    }
  }, [namespace, namespaced, namespaces]);

  useEffect(() => {
    if (!namespaced) {
      return;
    }
    if (namespaces.length === 0) {
      return;
    }
    if (!resourceNamespace.trim() || !namespaces.includes(resourceNamespace)) {
      setResourceNamespace(namespace && namespaces.includes(namespace) ? namespace : namespaces[0]);
    }
  }, [namespace, namespaced, namespaces, resourceNamespace]);

  const applyManifest = useApplyManifest(selectedClusterId);
  const assistedManifest = buildAssistedManifest(assistedForm, resourceNamespace || namespace, resourceName);
  const hydratedManifest = hydrateManifest(assistedManifest || manifest, {
    resourceName,
    namespace: namespaced ? resourceNamespace || namespace : "",
    labels,
    tags: selectedTags,
  });
  const diffRows = useMemo(() => buildSplitDiffRows(manifest, hydratedManifest), [hydratedManifest, manifest]);
  const lastSyncedLabel = useMemo(() => (hydratedManifest === appliedRef.current ? "Synced" : "Draft changes"), [hydratedManifest]);
  const filteredTags = useMemo(() => {
    const keyword = tagSearch.trim().toLowerCase();
    if (!keyword) {
      return availableTags;
    }
    return availableTags.filter((tag) => tag.toLowerCase().includes(keyword));
  }, [availableTags, tagSearch]);
  const visibleNamespaces = useMemo(() => (namespaces.length ? namespaces : ["default"]), [namespaces]);
  const applyNamespace = namespaced ? resourceNamespace || namespace : "Cluster-scoped";
  const isDirty = useMemo(
    () =>
      manifest !== defaultStarterManifest ||
      hydratedManifest !== appliedRef.current ||
      resourceName.trim() !== initialName ||
      resourceNamespace.trim() !== initialManifestNamespace ||
      labels.trim() !== "" ||
      selectedTags.length > 0,
    [defaultStarterManifest, hydratedManifest, initialManifestNamespace, initialName, labels, manifest, resourceName, resourceNamespace, selectedTags.length],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || applyManifest.isPending) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [applyManifest.isPending, isDirty]);

  useEffect(() => {
    const handlePopState = () => {
      if (allowNextLeaveRef.current) {
        allowNextLeaveRef.current = false;
        return;
      }
      if (!isDirty || applyManifest.isPending) {
        return;
      }
      setLeaveIntent("back");
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyManifest.isPending, isDirty]);

  const resetEditor = (nextManifest: string, nextNamespace: string) => {
    setManifest(nextManifest);
    setResourceName(extractManifestValue(nextManifest, /^\s*name:\s*(.+)\s*$/m));
    setResourceNamespace(extractManifestValue(nextManifest, /^\s*namespace:\s*(.+)\s*$/m) || nextNamespace);
    setLabels("");
    setSelectedTags([]);
    setAssistedForm(buildAssistedFormState(nextManifest, nextNamespace));
  };

  const applyTemplateMode = (mode: "starter" | "blank") => {
    setTemplateMode(mode);
    resetEditor(mode === "blank" ? "" : defaultStarterManifest, namespace);
  };

  const applyFormToYaml = () => {
    setManifest(hydratedManifest);
    setActiveTab("yaml");
  };

  const handleApply = () => {
    applyManifest.mutate(
      { namespace: namespaced ? resourceNamespace || namespace : "", manifest: hydratedManifest },
      {
        onSuccess: () => {
          appliedRef.current = hydratedManifest;
          showNotification({
            type: "success",
            message: `${title} applied`,
            description: `${resourceName || title} was applied successfully.`,
          });
          navigate(-1);
        },
        onError: (error: any) => {
          showNotification({
            type: "error",
            message: "Apply manifest failed",
            description: error?.message || "kubectl apply failed.",
          });
        },
      },
    );
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(hydratedManifest);
      showNotification({ type: "success", message: "YAML copied", description: "Preview YAML copied to clipboard." });
    } catch {
      showNotification({ type: "error", message: "Copy failed", description: "Clipboard copy is not available in this browser." });
    }
  };

  const handleDownloadPreview = () => {
    const blob = new Blob([hydratedManifest], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${resourceName || normalizeFileName(title)}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetToStarter = () => {
    setTemplateMode("starter");
    resetEditor(defaultStarterManifest, namespace);
    appliedRef.current = defaultStarterManifest;
  };

  const exitPage = () => {
    allowNextLeaveRef.current = true;
    setLeaveIntent(null);
    navigate(-1);
  };

  return (
    <K8sExplorerLayout
      clusters={clusters}
      namespaces={namespaced ? visibleNamespaces : [resourceNamespace || "cluster-scoped"]}
      selectedCluster={selectedClusterId}
      selectedNamespace={namespaced ? namespace : resourceNamespace || "cluster-scoped"}
      onClusterChange={setSelectedClusterId}
      onNamespaceChange={setNamespace}
      activeResource={activeResource}
      onResourceChange={(type) => navigate(`/${type}`)}
      headerMode="hidden"
    >
      <div className="space-y-5 pb-16">
        <div className="rounded-[24px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_560px]">
            <div className="space-y-3">
              <div>
                <h2 className="text-[2rem] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <CompactStatus label="State" value={lastSyncedLabel} tone={hydratedManifest === appliedRef.current ? "success" : "default"} />
                <CompactStatus label="Apply target" value={applyNamespace} />
                {namespaced ? <CompactStatus label="Explorer view" value={namespace} /> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isDirty && !applyManifest.isPending) {
                      setLeaveIntent("cancel");
                      return;
                    }
                    navigate(-1);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="outline" onClick={resetToStarter}>
                  <Save className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button variant="outline" onClick={() => setActiveTab("diff")}>Preview Diff</Button>
                <Button variant="primary" onClick={handleApply} disabled={applyManifest.isPending || !hydratedManifest.trim()}>
                  {applyManifest.isPending ? "Applying..." : addLabel}
                </Button>
              </div>
            </div>
            <div className={cn("grid gap-3", namespaced ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3")}>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  <span>Cluster</span>
                  <InfoTooltip content="Pick the Kubernetes cluster where this resource should be created." />
                </span>
                <select
                  value={selectedClusterId}
                  onChange={(event) => setSelectedClusterId(event.target.value)}
                  className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  <span>Template</span>
                  <InfoTooltip content="Start from a safe sample manifest or switch to blank YAML if you want full control." />
                </span>
                <select
                  value={templateMode}
                  onChange={(event) => applyTemplateMode(event.target.value as "starter" | "blank")}
                  className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {TEMPLATE_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {namespaced ? (
                <label className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    <span>Apply Namespace</span>
                    <InfoTooltip content={`This namespace is written into the manifest and used for apply. Explorer view is currently ${namespace}.`} />
                  </span>
                  <select
                    value={resourceNamespace || namespace}
                    onChange={(event) => setResourceNamespace(event.target.value)}
                    className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {visibleNamespaces.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  <span>Saved Tags</span>
                  <InfoTooltip content="Optional. Tags become Kubernetes-safe metadata labels so audit, filters, and policy routing can recognize this resource later." />
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Find saved tags like prod, payments, public" className="h-10 rounded-2xl pl-9" />
                </div>
              </label>
              <div className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  <span>{namespaced ? "Explorer Namespace" : "Tag Matches"}</span>
                  <InfoTooltip
                    content={
                      namespaced
                        ? "This is only the explorer context you navigated from. It does not override the Apply Namespace you choose above."
                        : "Shows how many saved tags match the current filter. You can still apply without tags."
                    }
                  />
                </span>
                <div className="flex h-10 items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {namespaced ? namespace : filteredTags.length ? `${filteredTags.length} tag${filteredTags.length === 1 ? "" : "s"} found` : "No matching tags"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
          <div className="min-w-0 rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
                <TabsList className="px-1">
                  <TabsTrigger value="form" icon={Wand2}>Form</TabsTrigger>
                  <TabsTrigger value="yaml" icon={FileCode2}>YAML</TabsTrigger>
                  <TabsTrigger value="diff" icon={GitCompareArrows}>Diff</TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="mt-5 space-y-4">
                  <CollapsibleSection title="Manifest setup" subtitle="Choose metadata and basic targeting before pushing anything into YAML.">
                    <div className="grid gap-3 md:grid-cols-2">
                      <FieldHint label="Resource Name" hint="Use a stable Kubernetes name, for example `payments-api` or `config-public`.">
                        <Input value={resourceName} onChange={(event) => setResourceName(event.target.value)} placeholder="sample-resource" />
                      </FieldHint>
                      <FieldHint
                        label={namespaced ? "Target Summary" : "Scope"}
                        hint={
                          namespaced
                            ? "Quick summary of where this resource will be applied. Change the namespace from the top toolbar if needed."
                            : "This resource is cluster-scoped, so it is not applied into a namespace."
                        }
                      >
                        <Input value={namespaced ? `${applyNamespace} (from ${namespace} view)` : "Cluster-scoped"} disabled />
                      </FieldHint>
                      <div className="md:col-span-2">
                        <FieldHint label="Metadata Labels" hint="Optional. Add comma-separated labels like `app=demo,tier=web` to make selectors and filtering easier.">
                          <Input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="app=demo,tier=web" />
                        </FieldHint>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {assistedForm.kind ? (
                    <CollapsibleSection title={`${assistedForm.kind} fields`} subtitle="Use structured inputs for the high-signal fields, then merge them back into YAML.">
                      <div className="grid gap-3 md:grid-cols-2">{renderAssistedFields(assistedForm, setAssistedForm)}</div>
                    </CollapsibleSection>
                  ) : null}

                  <CollapsibleSection title="Tags and labels" subtitle="Selected tags are translated into Kubernetes-safe labels for downstream audit and routing.">
                    <div className="flex flex-wrap gap-2">
                      {filteredTags.map((tag) => {
                        const selected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))
                            }
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                              selected
                                ? "border-blue-500 bg-blue-500 text-white"
                                : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-[#121212] dark:text-zinc-300",
                            )}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                </TabsContent>

                <TabsContent value="yaml" className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
                            setResourceName(extractManifestValue(content, /^\s*name:\s*(.+)\s*$/m));
                            setResourceNamespace(extractManifestValue(content, /^\s*namespace:\s*(.+)\s*$/m) || namespace);
                            setAssistedForm(buildAssistedFormState(content, namespace));
                            showNotification({ type: "success", message: "Manifest loaded", description: `${file.name} is ready to review and apply.` });
                          } catch (error) {
                            showNotification({
                              type: "error",
                              message: "Unable to read manifest file",
                              description: error instanceof Error ? error.message : "File could not be loaded.",
                            });
                          } finally {
                            event.target.value = "";
                          }
                        }}
                      />
                      <span className="inline-flex items-center rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload YAML
                      </span>
                    </label>
                    <Button variant="outline" onClick={() => applyTemplateMode("starter")} disabled={!defaultStarterManifest.trim()}>
                      Reset Template
                    </Button>
                    <Button variant="outline" onClick={applyFormToYaml}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Apply Form To YAML
                    </Button>
                  </div>
                  <YamlEditor
                    value={manifest}
                    onChange={setManifest}
                    minHeight={540}
                    placeholder="apiVersion: apps/v1&#10;kind: Deployment&#10;metadata: ..."
                  />
                </TabsContent>

                <TabsContent value="diff" className="mt-5">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Preview diff</div>
                        <div className="text-xs text-zinc-500">Compare the raw YAML editor against the form-hydrated output you are about to apply.</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={applyFormToYaml}>Apply Diff To YAML</Button>
                    </div>
                    <div className="max-h-[560px] overflow-auto p-4">
                      <div className="grid min-w-[760px] grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#121212]">
                          <div className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800">
                            Current YAML
                          </div>
                          <div className="font-mono text-xs leading-6">
                            {diffRows.map((row, index) => (
                              <div
                                key={`before-${index}-${row.before}`}
                                className={cn(
                                  "min-h-7 border-b border-zinc-100 px-3 py-1 dark:border-zinc-800/70",
                                  row.type === "remove" && "bg-red-500/10 text-red-700 dark:text-red-300",
                                  row.type === "same" && "text-zinc-600 dark:text-zinc-400",
                                )}
                              >
                                <YamlInlineHighlight line={row.before || " "} />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#121212]">
                          <div className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800">
                            Preview YAML
                          </div>
                          <div className="font-mono text-xs leading-6">
                            {diffRows.map((row, index) => (
                              <div
                                key={`after-${index}-${row.after}`}
                                className={cn(
                                  "min-h-7 border-b border-zinc-100 px-3 py-1 dark:border-zinc-800/70",
                                  row.type === "add" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                                  row.type === "same" && "text-zinc-600 dark:text-zinc-400",
                                )}
                              >
                                <YamlInlineHighlight line={row.after || " "} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="min-w-0">
            <div className="xl:sticky xl:top-6">
              <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live YAML Preview</div>
                    <div className="text-xs text-zinc-500">This is the exact manifest payload that will be applied.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyPreview}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadPreview}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Eye className="h-4 w-4 text-zinc-400" />
                  </div>
                </div>
                <div className="max-h-[calc(100vh-260px)] overflow-auto p-4">
                  <YamlPreview value={hydratedManifest || "# YAML preview will appear here"} minHeight={520} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {leaveIntent ? (
          <LeavePageDialog
            resourceTitle={title}
            onStay={() => setLeaveIntent(null)}
            onDiscard={exitPage}
          />
        ) : null}
      </div>
    </K8sExplorerLayout>
  );
}

function CompactStatus({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {tone === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />}
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <span className={cn("text-sm font-medium", tone === "success" ? "text-emerald-600 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-200")}>{value}</span>
    </div>
  );
}

function FieldHint({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        <span>{label}</span>
        <InfoTooltip content={hint} />
      </div>
      {children}
    </label>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="group/tooltip relative inline-flex items-center">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-blue-500">
        <CircleHelp className="h-3.5 w-3.5" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 hidden w-64 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium normal-case leading-5 tracking-normal text-zinc-600 shadow-xl group-hover/tooltip:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {content}
      </span>
    </span>
  );
}

function LeavePageDialog({
  resourceTitle,
  onStay,
  onDiscard,
}: {
  resourceTitle: string;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
        <div className="space-y-4">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Unsaved Changes</div>
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Leave this {resourceTitle.toLowerCase()} page?</h3>
            <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              You still have manifest changes that have not been applied. Stay here to keep editing, or discard the changes and leave the page.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onStay}>Stay</Button>
          <Button variant="primary" onClick={onDiscard}>Discard & Leave</Button>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <details open className="group rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/60">
      <summary className="cursor-pointer list-none px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{subtitle}</div>
          </div>
          <div className="rounded-full border border-zinc-200 p-2 text-zinc-400 transition group-open:border-zinc-300 group-open:text-zinc-600 dark:border-zinc-700 dark:group-open:border-zinc-600 dark:group-open:text-zinc-200">
            <ChevronDown className="h-4 w-4 group-open:hidden" />
            <ChevronUp className="hidden h-4 w-4 group-open:block" />
          </div>
        </div>
      </summary>
      <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">{children}</div>
    </details>
  );
}

function renderAssistedFields(form: AssistedFormState, setForm: Dispatch<SetStateAction<AssistedFormState>>) {
  switch (form.kind) {
    case "Pod":
      return (
        <>
          <FieldHint label="Container Name" hint="Name of the main container inside the pod, for example `app` or `api`.">
            <Input value={form.containerName} onChange={(event) => setForm((current) => ({ ...current, containerName: event.target.value }))} placeholder="app" />
          </FieldHint>
          <FieldHint label="Container Image" hint="Image reference to run, for example `nginx:stable-alpine` or `ghcr.io/org/app:1.0.0`.">
            <Input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} placeholder="nginx:stable-alpine" />
          </FieldHint>
          <FieldHint label="Container Port" hint="Optional container port exposed by this pod, for example `8080`.">
            <Input value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} placeholder="8080" />
          </FieldHint>
          <FieldHint label="Startup Command" hint="Optional shell command used instead of the image default entrypoint.">
            <Input value={form.command} onChange={(event) => setForm((current) => ({ ...current, command: event.target.value }))} placeholder="npm run start" />
          </FieldHint>
        </>
      );
    case "Deployment":
      return (
        <>
          <FieldHint label="Container Name" hint="Name of the deployment container, usually `app` or the service name.">
            <Input value={form.containerName} onChange={(event) => setForm((current) => ({ ...current, containerName: event.target.value }))} placeholder="app" />
          </FieldHint>
          <FieldHint label="Container Image" hint="Image reference used by the deployment pods.">
            <Input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} placeholder="ghcr.io/org/app:1.0.0" />
          </FieldHint>
          <FieldHint label="Replicas" hint="How many pod replicas Kubernetes should keep running.">
            <Input value={form.replicas} onChange={(event) => setForm((current) => ({ ...current, replicas: event.target.value }))} placeholder="2" />
          </FieldHint>
          <FieldHint label="Container Port" hint="Main port exposed by the application container.">
            <Input value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} placeholder="8080" />
          </FieldHint>
        </>
      );
    case "Ingress":
      return (
        <>
          <FieldHint label="Host" hint="Public DNS name for this route, for example `api.example.com`.">
            <Input value={form.host} onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))} placeholder="api.example.com" />
          </FieldHint>
          <FieldHint label="Path" hint="Request path to match, usually `/` or `/api`.">
            <Input value={form.path} onChange={(event) => setForm((current) => ({ ...current, path: event.target.value }))} placeholder="/" />
          </FieldHint>
          <FieldHint label="Backend Service" hint="Existing Kubernetes Service that will receive traffic from this ingress rule.">
            <Input value={form.serviceName} onChange={(event) => setForm((current) => ({ ...current, serviceName: event.target.value }))} placeholder="payments-service" />
          </FieldHint>
          <FieldHint label="Backend Service Port" hint="Service port number exposed by the backend service.">
            <Input value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} placeholder="80" />
          </FieldHint>
          <FieldHint label="Ingress Class" hint="Optional ingress controller class such as `nginx` or `traefik`.">
            <Input value={form.ingressClassName} onChange={(event) => setForm((current) => ({ ...current, ingressClassName: event.target.value }))} placeholder="nginx" />
          </FieldHint>
          <FieldHint label="TLS Secret Name" hint="Optional secret containing the TLS certificate for the host.">
            <Input value={form.tlsSecretName} onChange={(event) => setForm((current) => ({ ...current, tlsSecretName: event.target.value }))} placeholder="api-tls" />
          </FieldHint>
        </>
      );
    case "Service":
      return (
        <>
          <FieldHint label="Selector Labels" hint="Labels used to target pods, for example `app=payments-api`.">
            <Input value={form.selector} onChange={(event) => setForm((current) => ({ ...current, selector: event.target.value }))} placeholder="app=sample-app" />
          </FieldHint>
          <FieldHint label="Service Type" hint="Choose how traffic reaches the service: `ClusterIP`, `NodePort`, or `LoadBalancer`.">
            <Input value={form.serviceType} onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))} placeholder="ClusterIP" />
          </FieldHint>
          <FieldHint label="Service Port" hint="Port exposed by the Kubernetes Service.">
            <Input value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} placeholder="80" />
          </FieldHint>
          <FieldHint label="Target Port" hint="Port exposed by the destination pod container.">
            <Input value={form.targetPort} onChange={(event) => setForm((current) => ({ ...current, targetPort: event.target.value }))} placeholder="8080" />
          </FieldHint>
        </>
      );
    case "ConfigMap":
      return (
        <FieldHint label="Config Entries" hint="Enter one key/value per line in `KEY=VALUE` format. These will become ConfigMap data entries.">
          <textarea
            value={form.configEntries}
            onChange={(event) => setForm((current) => ({ ...current, configEntries: event.target.value }))}
            className="min-h-[180px] w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-sm md:col-span-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder={"APP_ENV=production\nAPP_NAME=einfra"}
          />
        </FieldHint>
      );
    case "Secret":
      return (
        <>
          <FieldHint label="Secret Type" hint="Typical values are `Opaque`, `kubernetes.io/dockerconfigjson`, or `kubernetes.io/tls`.">
            <Input value={form.secretType} onChange={(event) => setForm((current) => ({ ...current, secretType: event.target.value }))} placeholder="Opaque" />
          </FieldHint>
          <FieldHint label="Secret Entries" hint="Enter one key/value per line in `KEY=VALUE` format. Values will be encoded into the Secret manifest.">
            <textarea
              value={form.secretEntries}
              onChange={(event) => setForm((current) => ({ ...current, secretEntries: event.target.value }))}
              className="min-h-[132px] w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-sm md:col-span-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder={"username=admin\npassword=change-me"}
            />
          </FieldHint>
        </>
      );
    default:
      return null;
  }
}

function buildSplitDiffRows(beforeText: string, afterText: string) {
  const before = beforeText.replace(/\r\n/g, "\n").split("\n");
  const after = afterText.replace(/\r\n/g, "\n").split("\n");
  const total = Math.max(before.length, after.length);
  const rows: Array<{ type: "same" | "add" | "remove"; before: string; after: string }> = [];

  for (let index = 0; index < total; index += 1) {
    const prev = before[index];
    const next = after[index];
    if (prev === next) {
      rows.push({ type: "same", before: prev ?? "", after: next ?? "" });
      continue;
    }
    rows.push({
      type: typeof prev === "undefined" ? "add" : typeof next === "undefined" ? "remove" : "add",
      before: prev ?? "",
      after: next ?? "",
    });
  }

  return rows.length > 0 ? rows : [{ type: "same" as const, before: "", after: "" }];
}

function normalizeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "manifest";
}

function YamlEditor({
  value,
  onChange,
  minHeight = 520,
  placeholder,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  minHeight?: number;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => normalizeYamlLines(value || placeholder || ""), [placeholder, value]);

  const syncScroll = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    if (overlayRef.current) {
      overlayRef.current.scrollTop = textarea.scrollTop;
      overlayRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid grid-cols-[60px_minmax(0,1fr)]">
        <div
          ref={gutterRef}
          className="max-h-[620px] overflow-hidden border-r border-zinc-200 bg-zinc-100/80 px-3 py-4 text-right font-mono text-xs leading-6 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
        >
          {lines.map((_, index) => (
            <div key={`editor-line-${index + 1}`}>{index + 1}</div>
          ))}
        </div>
        <div className="relative" style={{ minHeight }}>
          <div ref={overlayRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-auto px-4 py-4 font-mono text-sm leading-6">
            <YamlCode value={value || placeholder || ""} dimPlaceholder={!value.trim()} />
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onScroll={syncScroll}
            spellCheck={false}
            className="relative z-10 min-h-full w-full resize-none overflow-auto bg-transparent px-4 py-4 font-mono text-sm leading-6 text-transparent caret-zinc-900 outline-none selection:bg-blue-500/25 dark:caret-zinc-100"
            placeholder={placeholder}
          />
        </div>
      </div>
    </div>
  );
}

function YamlPreview({ value, minHeight = 520 }: { value: string; minHeight?: number }) {
  const lines = useMemo(() => normalizeYamlLines(value), [value]);
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950" style={{ minHeight }}>
      <div className="grid grid-cols-[60px_minmax(0,1fr)]">
        <div className="border-r border-zinc-200 bg-zinc-100/80 px-3 py-4 text-right font-mono text-xs leading-6 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
          {lines.map((_, index) => (
            <div key={`preview-line-${index + 1}`}>{index + 1}</div>
          ))}
        </div>
        <div className="overflow-auto px-4 py-4 font-mono text-sm leading-6">
          <YamlCode value={value} />
        </div>
      </div>
    </div>
  );
}

function YamlCode({ value, dimPlaceholder = false }: { value: string; dimPlaceholder?: boolean }) {
  const lines = useMemo(() => normalizeYamlLines(value), [value]);
  return (
    <div className={cn("min-h-full whitespace-pre", dimPlaceholder && "opacity-60")}>
      {lines.map((line, index) => (
        <div key={`yaml-code-${index + 1}`} className="min-h-6">
          <YamlInlineHighlight line={line} />
        </div>
      ))}
    </div>
  );
}

function YamlInlineHighlight({ line }: { line: string }) {
  if (!line) {
    return <span>&nbsp;</span>;
  }
  const commentIndex = line.indexOf("#");
  const source = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
  const keyMatch = source.match(/^(\s*-\s+|\s*)([^:#\n][^:]*?)(\s*:\s*)(.*)$/);

  if (keyMatch) {
    const [, prefix, key, colon, rest] = keyMatch;
    const normalizedKey = key.trim();
    return (
      <>
        <span className="text-zinc-400 dark:text-zinc-600">{prefix}</span>
        <span className={getYamlKeyClass(normalizedKey)}>{key}</span>
        <span className="text-zinc-500 dark:text-zinc-400">{colon}</span>
        {renderYamlValue(rest, normalizedKey)}
        {comment ? <span className="text-emerald-700/90 dark:text-emerald-400">{comment}</span> : null}
      </>
    );
  }

  if (comment) {
    return (
      <>
        {renderYamlValue(source)}
        <span className="text-emerald-700/90 dark:text-emerald-400">{comment}</span>
      </>
    );
  }

  return <>{renderYamlValue(line)}</>;
}

function renderYamlValue(rawValue: string, parentKey?: string) {
  const value = rawValue ?? "";
  const trimmed = value.trim();
  if (!trimmed) {
    return <span>{value}</span>;
  }
  if (parentKey === "kind") {
    return <span className={getYamlKindClass(trimmed)}>{value}</span>;
  }
  if (parentKey === "apiVersion") {
    return <span className="text-cyan-700 dark:text-cyan-300">{value}</span>;
  }
  if (parentKey === "image") {
    return <span className="text-orange-700 dark:text-orange-300">{value}</span>;
  }
  if (parentKey === "namespace" || parentKey === "name") {
    return <span className="text-blue-700 dark:text-blue-300">{value}</span>;
  }
  if (/^["'].+["']$/.test(trimmed)) {
    return <span className="text-amber-700 dark:text-amber-300">{value}</span>;
  }
  if (/^(true|false|null|yes|no|on|off)$/i.test(trimmed)) {
    return <span className="text-fuchsia-700 dark:text-fuchsia-300">{value}</span>;
  }
  if (/^\d+(m|Mi|Gi|Ti|Ki|n)?$/i.test(trimmed)) {
    return <span className="text-violet-700 dark:text-violet-300">{value}</span>;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return <span className="text-violet-700 dark:text-violet-300">{value}</span>;
  }
  if (/^[\[\{].*[\]\}]$/.test(trimmed)) {
    return <span className="text-cyan-700 dark:text-cyan-300">{value}</span>;
  }
  if (/^[a-z0-9-]+\.[a-z0-9.-]+(?::[\w.-]+)?$/i.test(trimmed)) {
    return <span className="text-orange-700 dark:text-orange-300">{value}</span>;
  }
  return <span className="text-zinc-800 dark:text-zinc-100">{value}</span>;
}

function getYamlKeyClass(key: string) {
  const normalized = key.trim();
  if (["apiVersion", "kind"].includes(normalized)) {
    return "text-fuchsia-700 dark:text-fuchsia-300";
  }
  if (["metadata", "spec", "status", "template", "selector", "matchLabels"].includes(normalized)) {
    return "text-sky-700 dark:text-sky-300";
  }
  if (["name", "namespace", "labels", "annotations"].includes(normalized)) {
    return "text-blue-700 dark:text-blue-300";
  }
  if (["data", "stringData", "env", "ports", "containers", "volumes"].includes(normalized)) {
    return "text-emerald-700 dark:text-emerald-300";
  }
  if (["image", "imagePullPolicy", "resources", "requests", "limits"].includes(normalized)) {
    return "text-orange-700 dark:text-orange-300";
  }
  if (["type", "protocol", "serviceAccountName", "restartPolicy"].includes(normalized)) {
    return "text-violet-700 dark:text-violet-300";
  }
  return "text-sky-700 dark:text-sky-300";
}

function getYamlKindClass(kind: string) {
  const normalized = kind.trim().toLowerCase();
  if (["deployment", "statefulset", "daemonset", "replicaset"].includes(normalized)) {
    return "text-indigo-700 dark:text-indigo-300";
  }
  if (["service", "ingress", "gateway", "httproute"].includes(normalized)) {
    return "text-cyan-700 dark:text-cyan-300";
  }
  if (["configmap", "secret"].includes(normalized)) {
    return "text-emerald-700 dark:text-emerald-300";
  }
  if (["pod", "job", "cronjob"].includes(normalized)) {
    return "text-amber-700 dark:text-amber-300";
  }
  return "text-fuchsia-700 dark:text-fuchsia-300";
}

function normalizeYamlLines(value: string) {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  return lines.length > 0 ? lines : [""];
}
