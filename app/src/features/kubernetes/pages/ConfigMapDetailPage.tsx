import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Binary,
  Database,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { apiFetch } from "@/core/api-client";
import { useEnvironment } from "@/core/EnvironmentContext";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import {
  useClusters,
  useConfigMaps,
  useNamespaces,
} from "../api/useKubernetesHooks";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";

type ConfigMapYamlEntry = {
  key: string;
  value: string;
};

type YamlViewMode = "normalized" | "live";

export default function ConfigMapDetailPage() {
  const navigate = useNavigate();
  const { selectedEnvironment } = useEnvironment();
  const { namespace: rawNamespace = "default", name: rawName = "" } = useParams();
  const [searchParams] = useSearchParams();
  const targetNamespace = decodeURIComponent(rawNamespace);
  const targetName = decodeURIComponent(rawName);

  const { data: clusterData } = useClusters();
  const clusters = useMemo(() => clusterData?.data || [], [clusterData?.data]);
  const [selectedClusterIdOverride, setSelectedClusterIdOverride] = useState(
    searchParams.get("cluster") || "",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [yamlText, setYamlText] = useState("");
  const [yamlViewMode, setYamlViewMode] = useState<YamlViewMode>("normalized");
  const [isYamlLoading, setIsYamlLoading] = useState(false);
  const selectedClusterId =
    selectedClusterIdOverride ||
    (selectedEnvironment?.type === "kubernetes" ? selectedEnvironment.id : "") ||
    clusters[0]?.id ||
    "";

  const { data: namespacesData = [] } = useNamespaces(selectedClusterId);
  const namespaces = namespacesData.map((item) => item.name);
  const { data: configMaps = [], refetch } = useConfigMaps(
    selectedClusterId,
    targetNamespace,
  );

  const selectedConfigMap = useMemo(
    () =>
      configMaps.find(
        (item) => item.name === targetName && item.namespace === targetNamespace,
      ) || null,
    [configMaps, targetName, targetNamespace],
  );

  const loadYaml = useCallback(
    async (clusterId: string) => {
      if (!clusterId || !targetName) {
        return;
      }
      setIsYamlLoading(true);
      try {
        const payload = await apiFetch<{ yaml: string }>(
          `/v1/environments/${clusterId}/kubernetes/resources/configmaps/${encodeURIComponent(targetName)}/yaml?namespace=${encodeURIComponent(targetNamespace)}`,
        );
        setYamlText(payload.yaml || "");
      } catch (error) {
        setYamlText(
          `# Unable to load YAML\n# ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsYamlLoading(false);
      }
    },
    [targetName, targetNamespace],
  );

  useEffect(() => {
    void loadYaml(selectedClusterId);
  }, [loadYaml, selectedClusterId]);

  const sections = useMemo(() => extractConfigMapYamlSections(yamlText), [yamlText]);
  const normalizedYaml = useMemo(
    () =>
      buildNormalizedConfigMapYaml({
        name: selectedConfigMap?.name || targetName,
        namespace: selectedConfigMap?.namespace || targetNamespace,
        immutable: selectedConfigMap?.immutable,
        data: sections.data,
        binaryData: sections.binaryData,
      }),
    [
      sections.binaryData,
      sections.data,
      selectedConfigMap?.immutable,
      selectedConfigMap?.name,
      selectedConfigMap?.namespace,
      targetName,
      targetNamespace,
    ],
  );
  const displayedYaml =
    yamlViewMode === "live"
      ? yamlText || "# YAML preview will appear here"
      : normalizedYaml;
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredData = useMemo(
    () =>
      sections.data.filter(
        (entry) =>
          !normalizedSearch ||
          entry.key.toLowerCase().includes(normalizedSearch) ||
          entry.value.toLowerCase().includes(normalizedSearch),
      ),
    [normalizedSearch, sections.data],
  );

  const filteredBinaryData = useMemo(
    () =>
      sections.binaryData.filter(
        (entry) =>
          !normalizedSearch ||
          entry.key.toLowerCase().includes(normalizedSearch) ||
          entry.value.toLowerCase().includes(normalizedSearch),
      ),
    [normalizedSearch, sections.binaryData],
  );

  return (
    <K8sExplorerLayout
      clusters={clusters}
      namespaces={namespaces.length ? namespaces : ["default"]}
      selectedCluster={selectedClusterId}
      selectedNamespace={targetNamespace}
      onClusterChange={setSelectedClusterIdOverride}
      onNamespaceChange={(nextNamespace) => navigate(`/configmaps?cluster=${encodeURIComponent(selectedClusterId)}&namespace=${encodeURIComponent(nextNamespace)}`)}
      activeResource="configmaps"
      onResourceChange={(type) => navigate(`/${type}`)}
    >
      <div className="space-y-5 pb-10">
        <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="grid gap-6 bg-gradient-to-br from-amber-50 via-white to-zinc-50 px-6 py-6 dark:from-amber-500/10 dark:via-[#121212] dark:to-zinc-950 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/configmaps${selectedClusterId ? `?cluster=${encodeURIComponent(selectedClusterId)}` : ""}`,
                    )
                  }
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back To ConfigMaps
                </Button>
                <Badge variant="outline">ConfigMap Detail</Badge>
                {selectedConfigMap?.immutable ? (
                  <Badge variant="outline">Immutable</Badge>
                ) : (
                  <Badge variant="outline">Mutable</Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <Database className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {targetName}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Inspect config values, search inside entries, and review the
                      manifest with formatted YAML.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Namespace" value={targetNamespace} />
                  <StatCard
                    label="String Entries"
                    value={String(sections.data.length)}
                  />
                  <StatCard
                    label="Binary Entries"
                    value={String(sections.binaryData.length)}
                  />
                  <StatCard
                    label="Age"
                    value={selectedConfigMap?.age || "Unknown"}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-200 bg-white/80 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Search Config Data
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Filter by key name or value content across both `data` and
                    `binaryData`.
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  void refetch();
                  void loadYaml(selectedClusterId);
                }}>
                  <RefreshCw
                    className={cn("mr-2 h-4 w-4", isYamlLoading && "animate-spin")}
                  />
                  Refresh
                </Button>
              </div>

              <div className="mt-4">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search key or value..."
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat
                  icon={Search}
                  label="Matches"
                  value={String(filteredData.length + filteredBinaryData.length)}
                />
                <MiniStat
                  icon={Database}
                  label="Data"
                  value={String(filteredData.length)}
                />
                <MiniStat
                  icon={Binary}
                  label="Binary"
                  value={String(filteredBinaryData.length)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]">
          <div className="space-y-5">
            <ConfigEntrySection
              title="Config Data"
              subtitle="Readable key-value entries from the ConfigMap data block."
              entries={filteredData}
              icon={Database}
              emptyLabel="No matching entries found in data."
            />
            <ConfigEntrySection
              title="Binary Data"
              subtitle="Binary payloads preserved from the binaryData block."
              entries={filteredBinaryData}
              icon={Binary}
              emptyLabel="No matching entries found in binaryData."
            />
          </div>

          <div className="min-w-0">
            <div className="sticky top-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    YAML Preview
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {yamlViewMode === "normalized"
                      ? "Normalized ConfigMap manifest focused on clean structure and readable data."
                      : "Raw live snapshot returned by the cluster for exact runtime inspection."}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={yamlViewMode === "normalized" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setYamlViewMode("normalized")}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Normalized
                  </Button>
                  <Button
                    variant={yamlViewMode === "live" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setYamlViewMode("live")}
                  >
                    Live Snapshot
                  </Button>
                  {isYamlLoading ? (
                    <div className="text-xs text-zinc-500">Loading YAML...</div>
                  ) : null}
                </div>
              </div>
              <div className="max-h-[calc(100vh-160px)] overflow-auto p-4">
                <YamlPreview
                  value={displayedYaml}
                  minHeight={640}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </K8sExplorerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Search;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function ConfigEntrySection({
  title,
  subtitle,
  entries,
  icon: Icon,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  entries: ConfigMapYamlEntry[];
  icon: typeof Database;
  emptyLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Icon className="h-4 w-4 text-amber-500" />
            {title}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </div>
        </div>
        <Badge variant="outline">{entries.length} items</Badge>
      </div>

      <div className="space-y-3 p-5">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {emptyLabel}
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={`${title}-${entry.key}`}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {entry.key}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {entry.value.length} chars
                  </div>
                </div>
                <Badge variant="outline">Value</Badge>
              </div>
              <div className="px-4 py-4">
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-white p-4 font-mono text-xs leading-6 text-zinc-800 dark:bg-[#121212] dark:text-zinc-100">
                  {entry.value || "(empty)"}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function extractConfigMapYamlSections(yamlText: string): {
  data: ConfigMapYamlEntry[];
  binaryData: ConfigMapYamlEntry[];
} {
  return {
    data: extractYamlMapSection(yamlText, "data"),
    binaryData: extractYamlMapSection(yamlText, "binaryData"),
  };
}

function extractYamlMapSection(
  yamlText: string,
  sectionName: string,
): ConfigMapYamlEntry[] {
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  const sectionPattern = new RegExp(`^(\\s*)${sectionName}:\\s*$`);
  let sectionIndex = -1;
  let sectionIndent = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(sectionPattern);
    if (match) {
      sectionIndex = index;
      sectionIndent = match[1].length;
      break;
    }
  }

  if (sectionIndex === -1) {
    return [];
  }

  const entries: ConfigMapYamlEntry[] = [];
  let current: { key: string; lines: string[] } | null = null;
  let entryIndent = -1;

  const flush = () => {
    if (!current) {
      return;
    }
    const [firstLine = "", ...rest] = current.lines;
    const trimmedFirstLine = firstLine.trim();
    const value =
      trimmedFirstLine === "|" ||
      trimmedFirstLine === "|-" ||
      trimmedFirstLine === ">" ||
      trimmedFirstLine === ">-"
        ? rest.join("\n")
        : [firstLine, ...rest].join("\n").trim();
    entries.push({ key: current.key, value: stripWrappedQuotes(value) });
    current = null;
  };

  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      if (current) {
        current.lines.push("");
      }
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= sectionIndent) {
      break;
    }

    if (entryIndent === -1) {
      entryIndent = indent;
    }

    if (indent === entryIndent) {
      const content = line.slice(entryIndent);
      const separator = content.indexOf(":");
      if (separator !== -1) {
        flush();
        current = {
          key: content.slice(0, separator).trim(),
          lines: [content.slice(separator + 1).trimStart()],
        };
        continue;
      }
    }

    if (current) {
      current.lines.push(line.slice(Math.min(indent, entryIndent + 2)));
    }
  }

  flush();
  return entries;
}

function stripWrappedQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function buildNormalizedConfigMapYaml({
  name,
  namespace,
  immutable,
  data,
  binaryData,
}: {
  name: string;
  namespace: string;
  immutable?: boolean;
  data: ConfigMapYamlEntry[];
  binaryData: ConfigMapYamlEntry[];
}) {
  const lines = ["apiVersion: v1", "kind: ConfigMap", "metadata:"];

  if (name.trim()) {
    lines.push(`  name: ${toYamlScalar(name)}`);
  }
  if (namespace.trim()) {
    lines.push(`  namespace: ${toYamlScalar(namespace)}`);
  }
  if (typeof immutable === "boolean") {
    lines.push(`immutable: ${immutable ? "true" : "false"}`);
  }

  if (data.length > 0) {
    lines.push("data:");
    for (const entry of data) {
      lines.push(...toYamlEntryLines(entry.key, entry.value, 2));
    }
  }

  if (binaryData.length > 0) {
    lines.push("binaryData:");
    for (const entry of binaryData) {
      lines.push(...toYamlEntryLines(entry.key, entry.value, 2));
    }
  }

  return lines.join("\n");
}

function toYamlEntryLines(key: string, value: string, indent: number) {
  const padding = " ".repeat(indent);
  if (value.includes("\n")) {
    const valueLines = value.split("\n");
    return [
      `${padding}${key}: |-`,
      ...valueLines.map((line) => `${padding}  ${line}`),
    ];
  }
  return [`${padding}${key}: ${toYamlScalar(value)}`];
}

function toYamlScalar(value: string) {
  if (value === "") {
    return '""';
  }
  if (/^[A-Za-z0-9._/-]+$/.test(value) && !/^(true|false|null|yes|no|on|off)$/i.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function YamlPreview({
  value,
  minHeight = 520,
}: {
  value: string;
  minHeight?: number;
}) {
  const lines = useMemo(() => normalizeYamlLines(value), [value]);
  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ minHeight }}
    >
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

function YamlCode({
  value,
  dimPlaceholder = false,
}: {
  value: string;
  dimPlaceholder?: boolean;
}) {
  const lines = useMemo(() => normalizeYamlLines(value), [value]);
  return (
    <div
      className={cn(
        "min-h-full whitespace-pre",
        dimPlaceholder && "opacity-60",
      )}
    >
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
        {comment ? (
          <span className="text-emerald-700/90 dark:text-emerald-400">
            {comment}
          </span>
        ) : null}
      </>
    );
  }

  if (comment) {
    return (
      <>
        {renderYamlValue(source)}
        <span className="text-emerald-700/90 dark:text-emerald-400">
          {comment}
        </span>
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
  if (parentKey === "namespace" || parentKey === "name") {
    return <span className="text-blue-700 dark:text-blue-300">{value}</span>;
  }
  if (/^["'].+["']$/.test(trimmed)) {
    return <span className="text-amber-700 dark:text-amber-300">{value}</span>;
  }
  if (/^(true|false|null|yes|no|on|off)$/i.test(trimmed)) {
    return (
      <span className="text-fuchsia-700 dark:text-fuchsia-300">{value}</span>
    );
  }
  if (/^\d+(m|Mi|Gi|Ti|Ki|n)?$/i.test(trimmed) || /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return (
      <span className="text-violet-700 dark:text-violet-300">{value}</span>
    );
  }
  if (/^[[{].*[\]}]$/.test(trimmed)) {
    return <span className="text-cyan-700 dark:text-cyan-300">{value}</span>;
  }
  return <span className="text-zinc-800 dark:text-zinc-100">{value}</span>;
}

function getYamlKeyClass(key: string) {
  const normalized = key.trim();
  if (["apiVersion", "kind"].includes(normalized)) {
    return "text-fuchsia-700 dark:text-fuchsia-300";
  }
  if (
    ["metadata", "spec", "status", "template", "selector", "matchLabels"].includes(
      normalized,
    )
  ) {
    return "text-sky-700 dark:text-sky-300";
  }
  if (["name", "namespace", "labels", "annotations"].includes(normalized)) {
    return "text-blue-700 dark:text-blue-300";
  }
  if (["data", "binaryData", "stringData", "env", "ports"].includes(normalized)) {
    return "text-emerald-700 dark:text-emerald-300";
  }
  return "text-sky-700 dark:text-sky-300";
}

function getYamlKindClass(kind: string) {
  const normalized = kind.trim().toLowerCase();
  if (["configmap", "secret"].includes(normalized)) {
    return "text-emerald-700 dark:text-emerald-300";
  }
  return "text-fuchsia-700 dark:text-fuchsia-300";
}

function normalizeYamlLines(value: string) {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  return lines.length > 0 ? lines : [""];
}
