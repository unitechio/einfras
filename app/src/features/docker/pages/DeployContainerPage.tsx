import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Rocket, Server } from "lucide-react";
import DeployContainerModal from "../components/DeployContainerModal";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useEnvironmentInventory } from "@/features/kubernetes/api/useEnvironmentInventory";

export default function DeployContainerPage() {
  const { selectedEnvironment } = useEnvironment();
  const { data: inventory = [], isLoading } = useEnvironmentInventory();
  const dockerEnvironments = useMemo(
    () => inventory.filter((env) => env.type === "docker"),
    [inventory],
  );
  const [searchParams] = useSearchParams();
  const initialImage = searchParams.get("image") || "";
  const initialMode =
    searchParams.get("mode") === "compose" ? "compose" : "single";
  const requestedEnvironmentId = searchParams.get("environmentId") || "";
  const [environmentId, setEnvironmentId] = useState("");

  useEffect(() => {
    if (
      requestedEnvironmentId &&
      dockerEnvironments.some(
        (environment) => environment.id === requestedEnvironmentId,
      )
    ) {
      setEnvironmentId(requestedEnvironmentId);
      return;
    }
    if (selectedEnvironment?.type === "docker") {
      setEnvironmentId(selectedEnvironment.id);
      return;
    }
    if (!environmentId && dockerEnvironments.length > 0) {
      setEnvironmentId(dockerEnvironments[0].id);
    }
  }, [
    dockerEnvironments,
    environmentId,
    requestedEnvironmentId,
    selectedEnvironment,
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Rocket className="h-6 w-6 text-blue-500" />
            Deploy Container
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Structured deployment form for Docker containers with registry, env,
            ports, and volumes.
          </p>
        </div>
        <div className="relative">
          <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <select
            value={environmentId}
            onChange={(event) => setEnvironmentId(event.target.value)}
            disabled={isLoading}
            className="h-10 min-w-[260px] cursor-pointer appearance-none rounded-md border border-zinc-200 bg-white pl-9 pr-8 text-[13px] font-medium text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
          >
            <option value="" disabled>
              Select Docker environment...
            </option>
            {dockerEnvironments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name} ({environment.url})
              </option>
            ))}
          </select>
        </div>
      </div>

      {environmentId ? (
        <DeployContainerModal
          embedded
          environmentId={environmentId}
          initialImage={initialImage}
          initialMode={initialMode}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Select a Docker environment before deploying a container.
        </div>
      )}
    </div>
  );
}
