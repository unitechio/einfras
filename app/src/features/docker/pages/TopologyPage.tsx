import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Container,
  FolderTree,
  HardDrive,
  Network,
  Server,
} from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Position,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { useDockerTopology } from "../api/useDockerHooks";
import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useRuntimeFeatureFlags } from "@/features/settings/useRuntimeFeatureFlags";

const laneOrder = ["network", "container", "volume", "bind"] as const;

const kindColor: Record<string, string> = {
  container: "#2563eb",
  network: "#0891b2",
  volume: "#7c3aed",
  bind: "#f59e0b",
};

const laneMeta: Record<
  string,
  {
    title: string;
    short: string;
    x: number;
    background: string;
    border: string;
    icon: typeof Container;
  }
> = {
  network: {
    title: "Networks",
    short: "Edge and service paths",
    x: 110,
    background: "rgba(8, 145, 178, 0.05)",
    border: "rgba(8, 145, 178, 0.2)",
    icon: Network,
  },
  container: {
    title: "Containers",
    short: "Runtime workloads",
    x: 500,
    background: "rgba(37, 99, 235, 0.05)",
    border: "rgba(37, 99, 235, 0.2)",
    icon: Container,
  },
  volume: {
    title: "Volumes",
    short: "Persistent storage",
    x: 920,
    background: "rgba(124, 58, 237, 0.05)",
    border: "rgba(124, 58, 237, 0.2)",
    icon: HardDrive,
  },
  bind: {
    title: "Bind Mounts",
    short: "Host paths",
    x: 1280,
    background: "rgba(245, 158, 11, 0.06)",
    border: "rgba(245, 158, 11, 0.22)",
    icon: FolderTree,
  },
};

const kindIcon: Record<string, typeof Container> = {
  container: Container,
  network: Network,
  volume: HardDrive,
  bind: FolderTree,
};

function formatNodeText(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => formatNodeText(item)).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 3)
      .map(([key, nestedValue]) => `${key}: ${formatNodeText(nestedValue)}`)
      .join(" • ");
  }
  return String(value);
}

function metricCard(label: string, value: number, accent: string) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {value}
        </span>
        <span
          className="mb-1 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

export default function TopologyPage() {
  const featureFlags = useRuntimeFeatureFlags();
  const { data: inventory = [], isLoading: isLoadingServers } =
    useEnvironmentInventory();
  const { selectedEnvironment } = useEnvironment();
  const servers = inventory.filter((env) => env.type === "docker");
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");

  useEffect(() => {
    if (
      selectedEnvironment?.type === "docker" &&
      selectedEnvironment.id !== selectedServerId
    ) {
      setSelectedServerId(selectedEnvironment.id);
      return;
    }
    if (!selectedServerId && servers.length > 0) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId, selectedEnvironment]);

  const topologyQuery = useDockerTopology(selectedServerId);
  const topologyNodes = topologyQuery.data?.nodes ?? [];
  const topologyEdges = topologyQuery.data?.edges ?? [];
  const selectedNode =
    topologyNodes.find((node) => node.id === selectedNodeId) ?? null;

  const laneCounts = useMemo(() => {
    return laneOrder.reduce<Record<string, number>>((accumulator, kind) => {
      accumulator[kind] = topologyNodes.filter(
        (node) => node.kind === kind,
      ).length;
      return accumulator;
    }, {});
  }, [topologyNodes]);

  const graph = useMemo(() => {
    // 1. Group nodes by lane
    const nodesByLane: Record<string, typeof topologyNodes> = {
      network: [],
      container: [],
      volume: [],
      bind: [],
    };
    topologyNodes.forEach((node) => {
      const kind = node.kind in nodesByLane ? node.kind : "container";
      nodesByLane[kind].push(node);
    });

    // 2. Map connections
    const links = new Map<string, string[]>();
    topologyEdges.forEach((edge) => {
      if (!links.has(edge.source)) links.set(edge.source, []);
      if (!links.has(edge.target)) links.set(edge.target, []);
      links.get(edge.source)!.push(edge.target);
      links.get(edge.target)!.push(edge.source);
    });

    // 3. Sort containers alphabetically first (as central anchor)
    nodesByLane.container.sort((a, b) =>
      String(a.label ?? "").localeCompare(String(b.label ?? ""))
    );

    const containerIndexMap = new Map<string, number>();
    nodesByLane.container.forEach((node, idx) => {
      containerIndexMap.set(node.id, idx);
    });

    // 4. Helper to find average Y-index of connected containers
    const getAvgContainerIndex = (nodeId: string) => {
      const connected = links.get(nodeId) || [];
      const indices = connected
        .map((id) => containerIndexMap.get(id))
        .filter((idx): idx is number => idx !== undefined);

      if (indices.length === 0) return 0;
      return indices.reduce((a, b) => a + b, 0) / indices.length;
    };

    // 5. Sort other lanes based on their connection to containers
    ["network", "volume", "bind"].forEach((kind) => {
      nodesByLane[kind].sort((a, b) => {
        const avgA = getAvgContainerIndex(a.id);
        const avgB = getAvgContainerIndex(b.id);
        if (avgA !== avgB) return avgA - avgB;
        return String(a.label ?? "").localeCompare(String(b.label ?? ""));
      });
    });

    const rows: Record<string, number> = {
      network: 0,
      container: 0,
      volume: 0,
      bind: 0,
    };

    const sortedTopologyNodes = [
      ...nodesByLane.network,
      ...nodesByLane.container,
      ...nodesByLane.volume,
      ...nodesByLane.bind,
    ];

    const nodes: Node[] = sortedTopologyNodes.map((node) => {
      const kind = node.kind in rows ? node.kind : "container";
      const rowIndex = rows[kind] ?? 0;
      rows[kind] = rowIndex + 1;
      const lane = laneMeta[kind] ?? laneMeta.container;
      const y = 96 + rowIndex * 152;
      const isSelected = selectedNodeId === node.id;
      const Icon = kindIcon[kind] ?? Boxes;

      return {
        id: node.id,
        position: { x: lane.x, y },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${kindColor[kind] ?? "#71717a"}18`,
                  }}
                >
                  <Icon
                    className="h-4.5 w-4.5"
                    style={{ color: kindColor[kind] ?? "#71717a" }}
                  />
                </div>
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-semibold text-zinc-900"
                    title={formatNodeText(node.label)}
                  >
                    {formatNodeText(node.label)}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {node.kind}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-zinc-500">
                {node.status ? (
                  <div className="truncate">{node.status}</div>
                ) : null}
                {node.metadata
                  ? Object.entries(node.metadata)
                      .slice(0, 2)
                      .map(([key, value]) => (
                        <div key={key} className="truncate">
                          <span className="font-medium text-zinc-700">
                            {key}
                          </span>
                          : {formatNodeText(value)}
                        </div>
                      ))
                  : null}
              </div>
            </div>
          ),
        },
        style: {
          background: "#ffffff",
          color: "#111827",
          border: isSelected
            ? `2px solid ${kindColor[kind] ?? "#71717a"}`
            : `1px solid ${kindColor[kind] ?? "#71717a"}35`,
          borderRadius: 20,
          minWidth: 250,
          maxWidth: 250,
          padding: 14,
          boxShadow: isSelected
            ? "0 18px 40px rgba(15, 23, 42, 0.14)"
            : "0 10px 30px rgba(15, 23, 42, 0.08)",
          cursor: "pointer",
        },
      };
    });

    const edges: Edge[] = topologyEdges.map((edge) => {
      const sourceNode = topologyNodes.find((n) => n.id === edge.source);
      const targetNode = topologyNodes.find((n) => n.id === edge.target);

      const sourceLane = sourceNode ? laneMeta[sourceNode.kind] ?? laneMeta.container : laneMeta.container;
      const targetLane = targetNode ? laneMeta[targetNode.kind] ?? laneMeta.container : laneMeta.container;

      // Swap direction if the edge wants to jump backwards (right-to-left physically)
      const shouldReverse = sourceLane.x > targetLane.x;

      return {
        id: edge.id,
        source: shouldReverse ? edge.target : edge.source,
        target: shouldReverse ? edge.source : edge.target,
        label: formatNodeText(edge.label),
        animated: edge.label === "attached" || edge.label === "uses",
        style: {
          stroke:
            edge.label === "mounted"
              ? "#a855f7"
              : edge.label === "connected"
                ? "#0891b2"
                : "#94a3b8",
          strokeWidth: 1.6,
        },
        labelStyle: {
          fill: "#64748b",
          fontSize: 11,
          fontWeight: 600,
        },
        type: "smoothstep",
      };
    });

    return { nodes, edges };
  }, [selectedNodeId, topologyEdges, topologyNodes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {!featureFlags.isLoading &&
      !featureFlags.isEnabled("runtime_topology", true) ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500">
          Runtime Topology is disabled by feature flag. Turn on
          `runtime_topology` from Settings to inspect container, network, and
          volume relationships here.
        </div>
      ) : null}

      {!featureFlags.isLoading &&
      !featureFlags.isEnabled("runtime_topology", true) ? null : (
        <>
          <div className="rounded-md border border-zinc-200 bg-white/95 p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  <Boxes className="h-6 w-6 text-cyan-500" />
                  Runtime Topology
                </h1>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  A cleaner runtime map for Docker environments, with each
                  resource family separated into its own lane so dependencies
                  are easier to read.
                </p>
              </div>

              <div className="relative xl:min-w-70">
                <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <select
                  value={selectedServerId}
                  onChange={(event) => setSelectedServerId(event.target.value)}
                  disabled={isLoadingServers}
                  className="h-11 w-full cursor-pointer appearance-none rounded-md border border-zinc-200 bg-white pl-9 pr-8 text-[13px] font-medium text-zinc-900 shadow-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
                >
                  <option value="" disabled>
                    Select Docker environment...
                  </option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.url})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {metricCard(
                "Networks",
                laneCounts.network ?? 0,
                kindColor.network,
              )}
              {metricCard(
                "Containers",
                laneCounts.container ?? 0,
                kindColor.container,
              )}
              {metricCard("Volumes", laneCounts.volume ?? 0, kindColor.volume)}
              {metricCard("Bind mounts", laneCounts.bind ?? 0, kindColor.bind)}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-md border border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
              <div className="grid gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 md:grid-cols-2 xl:grid-cols-4">
                {laneOrder.map((kind) => {
                  const lane = laneMeta[kind];
                  const Icon = lane.icon;
                  return (
                    <div
                      key={kind}
                      className="rounded-2xl border px-4 py-3"
                      style={{
                        background: lane.background,
                        borderColor: lane.border,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: `${kindColor[kind]}18`,
                          }}
                        >
                          <Icon
                            className="h-4 w-4"
                            style={{ color: kindColor[kind] }}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {lane.title}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {lane.short}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="h-[780px]">
                <ReactFlow
                  nodes={graph.nodes}
                  edges={graph.edges}
                  fitView
                  fitViewOptions={{ padding: 0.12 }}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.82 }}
                >
                  <MiniMap
                    pannable
                    zoomable
                    nodeColor={(node) =>
                      kindColor[
                        String(
                          topologyNodes.find((item) => item.id === node.id)
                            ?.kind ?? "container",
                        )
                      ] ?? "#64748b"
                    }
                  />
                  <Controls />
                  <Background gap={18} color="#e4e4e7" />
                </ReactFlow>
              </div>

              {!topologyQuery.isLoading && topologyNodes.length === 0 ? (
                <div className="border-t border-zinc-100 px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  No Docker topology data was returned for this environment.
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-zinc-200 bg-white/95 p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Selected resource
                </div>
                {selectedNode ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        <span className="block break-words">
                          {formatNodeText(selectedNode.label)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {selectedNode.kind}
                        {selectedNode.status ? ` • ${selectedNode.status}` : ""}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                      <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                        {selectedNode.metadata &&
                        Object.keys(selectedNode.metadata).length > 0 ? (
                          Object.entries(selectedNode.metadata).map(
                            ([key, value]) => (
                              <div
                                key={key}
                                className="flex items-start justify-between gap-3"
                              >
                                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                                  {key}
                                </span>
                                <span className="max-w-[180px] break-words text-right font-mono text-xs">
                                  {formatNodeText(value)}
                                </span>
                              </div>
                            ),
                          )
                        ) : (
                          <div className="text-zinc-500 dark:text-zinc-400">
                            No extra metadata available.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    Pick any node in the topology to pin its runtime details
                    here.
                  </div>
                )}
              </div>

              <div className="rounded-md border border-zinc-200 bg-white/95 p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Relation count
                </div>
                <div className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {topologyEdges.length}
                </div>
                <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Total connections across runtime, network, and storage paths.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
