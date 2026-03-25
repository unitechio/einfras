import { useEffect, useMemo, useState } from "react";
import { Boxes, Database, Globe, HardDrive, Layers, Network, Server } from "lucide-react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

import { useClusters, useKubernetesTopology, useNamespaces } from "../api/useKubernetesHooks";
import { useEnvironment } from "@/core/EnvironmentContext";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { useNavigate } from "react-router-dom";

const kindColor: Record<string, string> = {
  node: "#2563eb",
  pod: "#0891b2",
  deployment: "#7c3aed",
  statefulset: "#9333ea",
  daemonset: "#a855f7",
  service: "#0f766e",
  ingress: "#f59e0b",
  pvc: "#ea580c",
  configmap: "#64748b",
  secret: "#dc2626",
};

const kindIcon: Record<string, typeof Server> = {
  node: Server,
  pod: Boxes,
  deployment: Layers,
  statefulset: Layers,
  daemonset: Layers,
  service: Network,
  ingress: Globe,
  pvc: HardDrive,
  configmap: Database,
  secret: Database,
};

export default function TopologyPage() {
  const { data: clusterData } = useClusters();
  const { selectedEnvironment } = useEnvironment();
  const navigate = useNavigate();
  const clusters = clusterData?.data || [];
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [namespace, setNamespace] = useState("default");

  useEffect(() => {
    if (selectedEnvironment?.type === "kubernetes" && selectedEnvironment.id !== selectedClusterId) {
      setSelectedClusterId(selectedEnvironment.id);
      return;
    }
    if (!selectedClusterId && clusters.length > 0) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId, selectedEnvironment]);

  const { data: namespacesData = [] } = useNamespaces(selectedClusterId);
  const namespaces = namespacesData.map((item) => item.name);
  const topologyQuery = useKubernetesTopology(selectedClusterId);

  useEffect(() => {
    if (namespaces.length && !namespaces.includes(namespace)) {
      setNamespace(namespaces[0]);
    }
  }, [namespace, namespaces]);

  const graph = useMemo(() => {
    const rows: Record<string, number> = {};
    const xByKind: Record<string, number> = {
      node: 60,
      deployment: 340,
      statefulset: 340,
      daemonset: 340,
      service: 620,
      ingress: 900,
      pod: 620,
      pvc: 900,
      configmap: 900,
      secret: 900,
    };
    const visibleNodes = (topologyQuery.data?.nodes ?? []).filter((node) => {
      if (namespace === "all") {
        return true;
      }
      return node.id.includes(`:${namespace}/`) || !node.id.includes(":");
    });
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = (topologyQuery.data?.edges ?? []).filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

    const nodes: Node[] = visibleNodes.map((node) => {
      const rowIndex = rows[node.kind] ?? 0;
      rows[node.kind] = rowIndex + 1;
      const y = 80 + rowIndex * 110;
      const Icon = kindIcon[node.kind] ?? Boxes;
      const color = kindColor[node.kind] ?? "#64748b";
      return {
        id: node.id,
        position: { x: xByKind[node.kind] ?? 620, y },
        data: {
          label: (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="font-semibold">{node.label}</div>
              </div>
              <div className="text-[11px] uppercase tracking-wide opacity-70">{node.kind}</div>
              {node.status ? <div className="text-[11px] opacity-70">{node.status}</div> : null}
            </div>
          ),
        },
        style: {
          background: "#fff",
          color: "#111827",
          border: `1px solid ${color}`,
          borderRadius: 16,
          minWidth: 220,
          padding: 12,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        },
      };
    });

    const edges: Edge[] = visibleEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: edge.label === "routes" || edge.label === "targets",
      style: { stroke: "#94a3b8" },
      labelStyle: { fill: "#475569", fontSize: 12 },
    }));
    return { nodes, edges };
  }, [namespace, topologyQuery.data]);

  return (
    <K8sExplorerLayout
      clusters={clusters}
      namespaces={["all", ...(namespaces.length ? namespaces : ["default"])]}
      selectedCluster={selectedClusterId}
      selectedNamespace={namespace}
      onClusterChange={setSelectedClusterId}
      onNamespaceChange={setNamespace}
      activeResource="topology"
      onResourceChange={(type) => navigate(`/${type}`)}
    >
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <div className="border-b border-zinc-100 px-5 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Topology maps ownership, service targeting, ingress routing, node scheduling, and storage/config dependencies in the selected Kubernetes environment.
        </div>
        <div className="h-[720px]">
          <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView>
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => kindColor[String((topologyQuery.data?.nodes ?? []).find((item) => item.id === node.id)?.kind ?? "pod")] ?? "#64748b"}
            />
            <Controls />
            <Background gap={18} color="#e4e4e7" />
          </ReactFlow>
        </div>
        {!topologyQuery.isLoading && (topologyQuery.data?.nodes?.length ?? 0) === 0 ? (
          <div className="border-t border-zinc-100 px-5 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            No Kubernetes topology data was returned for this environment.
          </div>
        ) : null}
      </div>
    </K8sExplorerLayout>
  );
}
