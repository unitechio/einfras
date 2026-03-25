import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Network } from "lucide-react";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { useContainers, useDockerTopology, useNetworkAttachment, useNetworks } from "../api/useDockerHooks";
import { useNotification } from "@/core/NotificationContext";

export default function NetworkDetailPage() {
    const navigate = useNavigate();
    const { networkId = "" } = useParams();
    const { selectedEnvironment } = useEnvironment();
    const environmentId = selectedEnvironment?.type === "docker" ? selectedEnvironment.id : "";
    const { data: networks = [] } = useNetworks(environmentId);
    const { data: topology } = useDockerTopology(environmentId);
    const { data: containers = [] } = useContainers(environmentId, true);
    const attachMutation = useNetworkAttachment(environmentId);
    const { showNotification } = useNotification();
    const [selectedContainerId, setSelectedContainerId] = useState("");

    const network = useMemo(() => networks.find((item) => item.Id === networkId), [networks, networkId]);
    const attached = useMemo(() => topology?.edges
        .filter((edge) => edge.target === `network:${networkId}`)
        .map((edge) => {
            const node = topology.nodes.find((item) => item.id === edge.source);
            return node ? { id: node.id.replace("container:", ""), name: node.label } : null;
        })
        .filter(Boolean) || [], [topology, networkId]);
    const attachable = containers.filter((container) => !attached.some((item) => item?.id === container.Id));

    return (
        <div className="space-y-6 pb-20">
            <Button variant="outline" onClick={() => navigate("/networks")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Card className="p-6">
                <div className="flex items-center gap-2 text-2xl font-semibold"><Network className="h-6 w-6 text-orange-500" /> {network?.Name || networkId}</div>
                <pre className="mt-4 rounded-xl bg-black p-4 font-mono text-xs text-zinc-200">{JSON.stringify(network, null, 2)}</pre>
            </Card>
            <Card className="p-6">
                <div className="font-semibold">Attach Container</div>
                <div className="mt-3 flex flex-wrap gap-3">
                    <select value={selectedContainerId} onChange={(event) => setSelectedContainerId(event.target.value)} className="h-10 min-w-[280px] rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                        <option value="">Select container...</option>
                        {attachable.map((container) => (
                            <option key={container.Id} value={container.Id}>{container.Names?.[0]?.replace(/^\//, "") || container.Id.slice(0, 12)}</option>
                        ))}
                    </select>
                    <Button
                        variant="primary"
                        onClick={() => attachMutation.mutate({ networkId, action: "attach", containerId: selectedContainerId }, {
                            onSuccess: () => showNotification({ type: "success", message: "Container attached", description: selectedContainerId }),
                        })}
                        disabled={!selectedContainerId || attachMutation.isPending}
                    >
                        Attach
                    </Button>
                </div>
            </Card>
            <Card className="p-6">
                <div className="font-semibold">Attached Containers</div>
                <div className="mt-3 space-y-2">
                    {attached.length === 0 ? <div className="text-sm text-zinc-500">No attached containers.</div> : attached.map((item) => item ? (
                        <div key={item.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                            <span>{item.name}</span>
                            <Button variant="ghost" size="sm" onClick={() => attachMutation.mutate({ networkId, action: "detach", containerId: item.id, force: true })}>Detach</Button>
                        </div>
                    ) : null)}
                </div>
            </Card>
        </div>
    );
}
