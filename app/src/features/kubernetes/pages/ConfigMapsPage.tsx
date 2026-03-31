import { useMemo, useState } from "react";
import { Database, Eye, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/Table";
import {
  useClusters,
  useConfigMaps,
  useNamespaces,
} from "../api/useKubernetesHooks";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { openCreateResourcePage } from "../createResourceConfig";
import type { K8sConfigMap } from "../types";

export default function ConfigMapsPage() {
  const { data: clusterData } = useClusters();
  const { selectedEnvironment } = useEnvironment();
  const navigate = useNavigate();
  const clusters = useMemo(() => clusterData?.data || [], [clusterData?.data]);
  const [selectedClusterIdOverride, setSelectedClusterIdOverride] = useState("");
  const [namespaceOverride, setNamespaceOverride] = useState("default");
  const [searchQuery, setSearchQuery] = useState("");
  const selectedClusterId =
    selectedClusterIdOverride ||
    (selectedEnvironment?.type === "kubernetes" ? selectedEnvironment.id : "") ||
    clusters[0]?.id ||
    "";

  const { data: namespacesData = [] } = useNamespaces(selectedClusterId);
  const namespaces = namespacesData.map((item) => item.name);
  const namespace =
    namespaces.length === 0 || namespaces.includes(namespaceOverride)
      ? namespaceOverride
      : namespaces[0];

  const {
    data: configMaps = [],
    isLoading,
    refetch,
  } = useConfigMaps(selectedClusterId, namespace);

  const filteredConfigMaps = configMaps.filter((item) =>
    [item.name, item.namespace]
      .filter(Boolean)
      .some((value) =>
        value.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
  );

  const openDetail = (item: K8sConfigMap) => {
    const search = new URLSearchParams();
    if (selectedClusterId) {
      search.set("cluster", selectedClusterId);
    }
    navigate(
      `/configmaps/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.name)}${
        search.toString() ? `?${search.toString()}` : ""
      }`,
    );
  };

  return (
    <K8sExplorerLayout
      clusters={clusters}
      namespaces={namespaces.length ? namespaces : ["default"]}
      selectedCluster={selectedClusterId}
      selectedNamespace={namespace}
      onClusterChange={setSelectedClusterIdOverride}
      onNamespaceChange={setNamespaceOverride}
      activeResource="configmaps"
      onResourceChange={(type) => navigate(`/${type}`)}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <Input
              type="text"
              placeholder="Search configmaps..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw
                className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                openCreateResourcePage(navigate, {
                  resourceType: "configmap",
                  clusterId: selectedClusterId,
                  namespace,
                })
              }
            >
              <Database className="mr-2 h-4 w-4" />
              Add ConfigMap
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                <Database className="h-5 w-5 text-amber-500" />
                ConfigMaps
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Explore configuration objects and open a focused detail page for
                each manifest.
              </p>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Click a row to inspect keys, values, and formatted YAML.
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Immutable</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-[120px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfigMaps.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-40 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No configmaps found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConfigMaps.map((item) => (
                    <TableRow
                      key={`${item.namespace}/${item.name}`}
                      className="cursor-pointer"
                      onClick={() => openDetail(item)}
                    >
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.namespace}</TableCell>
                      <TableCell>{item.data_count}</TableCell>
                      <TableCell>{item.immutable ? "Yes" : "No"}</TableCell>
                      <TableCell>{item.age}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetail(item);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </K8sExplorerLayout>
  );
}
