import { useEffect, useMemo, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { useClusters, useCronJobs, useJobs, useNamespaces } from "../api/useKubernetesHooks";
import { cn } from "@/lib/utils";
import { openCreateResourcePage } from "../createResourceConfig";

export default function JobsPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");

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
    useEffect(() => {
        if (namespaces.length && !namespaces.includes(namespace)) {
            setNamespace(namespaces[0]);
        }
    }, [namespace, namespaces]);

    const { data: jobs = [], isLoading: isLoadingJobs, refetch: refetchJobs } = useJobs(selectedClusterId, namespace);
    const { data: cronJobs = [], isLoading: isLoadingCron, refetch: refetchCron } = useCronJobs(selectedClusterId, namespace);
    const filteredJobs = useMemo(() => jobs.filter((item) => [item.name, item.completions, item.duration].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase()))), [jobs, searchQuery]);
    const filteredCronJobs = useMemo(() => cronJobs.filter((item) => [item.name, item.schedule, item.last_schedule].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase()))), [cronJobs, searchQuery]);

    return (
        <K8sExplorerLayout clusters={clusters} namespaces={namespaces.length ? namespaces : ["default"]} selectedCluster={selectedClusterId} selectedNamespace={namespace} onClusterChange={setSelectedClusterId} onNamespaceChange={setNamespace} activeResource="jobs" onResourceChange={(type) => navigate(`/${type}`)}>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex w-full max-w-xs">
                        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search jobs and cronjobs..." />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { refetchJobs(); refetchCron(); }}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", (isLoadingJobs || isLoadingCron) && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() =>
                                openCreateResourcePage(navigate, {
                                    resourceType: "job",
                                    clusterId: selectedClusterId,
                                    namespace,
                                })
                            }
                        >
                            <Clock3 className="mr-2 h-4 w-4" />
                            Add Job
                        </Button>
                    </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><h3 className="font-semibold">Jobs</h3></div>
                        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Completions</TableHead><TableHead>Duration</TableHead><TableHead>Age</TableHead></TableRow></TableHeader><TableBody>{filteredJobs.length === 0 ? <TableRow><TableCell colSpan={4} className="h-32 text-center text-zinc-500 dark:text-zinc-400">No jobs found.</TableCell></TableRow> : filteredJobs.map((item) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell>{item.name}</TableCell><TableCell>{item.completions}</TableCell><TableCell>{item.duration}</TableCell><TableCell>{item.age}</TableCell></TableRow>)}</TableBody></Table></div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><h3 className="font-semibold">CronJobs</h3></div>
                        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Schedule</TableHead><TableHead>Active</TableHead><TableHead>Last Run</TableHead></TableRow></TableHeader><TableBody>{filteredCronJobs.length === 0 ? <TableRow><TableCell colSpan={4} className="h-32 text-center text-zinc-500 dark:text-zinc-400">No cronjobs found.</TableCell></TableRow> : filteredCronJobs.map((item) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell>{item.name}</TableCell><TableCell>{item.schedule}</TableCell><TableCell>{item.active}</TableCell><TableCell>{item.last_schedule}</TableCell></TableRow>)}</TableBody></Table></div>
                    </div>
                </div>
            </div>
        </K8sExplorerLayout>
    );
}
