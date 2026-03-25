import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Layers3 } from "lucide-react";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Badge } from "@/shared/ui/Badge";
import { useRestartStackService, useScaleStackService, useStackServiceDetail, useStackServiceLogs } from "../api/useDockerHooks";
import { useNotification } from "@/core/NotificationContext";

export default function ServiceDetailPage() {
    const navigate = useNavigate();
    const { stackName = "", serviceName = "" } = useParams();
    const { selectedEnvironment } = useEnvironment();
    const environmentId = selectedEnvironment?.type === "docker" ? selectedEnvironment.id : "";
    const { data } = useStackServiceDetail(environmentId, stackName, serviceName);
    const { data: logs } = useStackServiceLogs(environmentId, stackName, serviceName, 200);
    const scaleService = useScaleStackService(environmentId, stackName);
    const restartService = useRestartStackService(environmentId, stackName);
    const { showNotification } = useNotification();

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => navigate("/stacks")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => restartService.mutate(serviceName)}>Force Restart</Button>
                    <Button variant="primary" onClick={() => {
                        const next = prompt("Scale replicas to:", data?.replicas || "1");
                        const replicas = Number(next);
                        if (!Number.isNaN(replicas) && replicas >= 0) {
                            scaleService.mutate({ serviceName, replicas }, {
                                onSuccess: () => showNotification({ type: "success", message: "Service scaled", description: `${serviceName} -> ${replicas}` }),
                            });
                        }
                    }}>Scale</Button>
                </div>
            </div>

            <Card className="p-6">
                <div className="flex items-center gap-2 text-2xl font-semibold"><Layers3 className="h-6 w-6 text-pink-500" /> {data?.name || serviceName}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline">{data?.mode || "service"}</Badge>
                    <Badge variant="success">{data?.replicas || "-"}</Badge>
                    {data?.stack ? <Badge variant="outline">{data.stack}</Badge> : null}
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-black p-4 font-mono text-xs text-zinc-200">{JSON.stringify(data, null, 2)}</pre>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-2 font-semibold"><FileText size={16} /> Service Logs</div>
                <pre className="mt-4 h-[480px] overflow-auto rounded-xl bg-black p-4 font-mono text-xs text-zinc-200">{logs?.logs || "No service logs available."}</pre>
            </Card>
        </div>
    );
}
