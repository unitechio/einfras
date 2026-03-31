import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  HardDrive,
  Network,
  Plus,
  Save,
  Settings,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";
import { useContainerConfig, useUpdateContainer } from "../api/useDockerHooks";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";

type EnvRow = { id: string; key: string; value: string; sensitive: boolean };
type PortRow = {
  id: string;
  hostPort: string;
  containerPort: string;
  protocol: "tcp" | "udp";
};
type VolumeRow = {
  id: string;
  hostPath: string;
  containerPath: string;
  mode: "rw" | "ro";
};

const makeId = () => Math.random().toString(36).slice(2, 10);

export default function EditContainerPage() {
  const navigate = useNavigate();
  const { containerId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const environmentId = searchParams.get("envId") || "";

  const { showNotification } = useNotification();
  const { data, isLoading } = useContainerConfig(environmentId, containerId);
  const updateContainer = useUpdateContainer(environmentId);

  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [command, setCommand] = useState("");
  const [restartPolicy, setRestartPolicy] = useState("unless-stopped");
  const [recreate, setRecreate] = useState(false);
  const [healthcheckCommand, setHealthcheckCommand] = useState("");
  const [healthcheckInterval, setHealthcheckInterval] = useState("");
  const [healthcheckTimeout, setHealthcheckTimeout] = useState("");
  const [healthcheckStartPeriod, setHealthcheckStartPeriod] = useState("");
  const [healthcheckRetries, setHealthcheckRetries] = useState("3");
  const [healthcheckDisabled, setHealthcheckDisabled] = useState(false);
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [portRows, setPortRows] = useState<PortRow[]>([]);
  const [volumeRows, setVolumeRows] = useState<VolumeRow[]>([]);

  useEffect(() => {
    if (!data) return;
    setName(data.name || "");
    setImage(data.image || "");
    setCommand((data.command || []).join("\n"));
    setRestartPolicy(data.restart_policy || "unless-stopped");
    setRecreate(false);
    setHealthcheckCommand(data.healthcheck_command || "");
    setHealthcheckInterval(data.healthcheck_interval || "");
    setHealthcheckTimeout(data.healthcheck_timeout || "");
    setHealthcheckStartPeriod(data.healthcheck_start_period || "");
    setHealthcheckRetries(String(data.healthcheck_retries || 3));
    setHealthcheckDisabled(!!data.healthcheck_disabled);
    setEnvRows(
      Object.entries(data.environment || {}).map(([key, value]) => ({
        id: makeId(),
        key,
        value,
        sensitive: /(token|secret|password|key)/i.test(key),
      })),
    );
    setPortRows(
      (data.ports || []).map((value) => {
        const [source = "", targetWithProto = ""] = value.split(":");
        const [containerPort = "", protocol = "tcp"] =
          targetWithProto.split("/");
        return {
          id: makeId(),
          hostPort: source,
          containerPort,
          protocol: protocol === "udp" ? "udp" : "tcp",
        };
      }),
    );
    setVolumeRows(
      (data.volumes || []).map((value) => {
        const parts = value.split(":");
        return {
          id: makeId(),
          hostPath: parts[0] || "",
          containerPath: parts[1] || "",
          mode: parts[2] === "ro" ? "ro" : "rw",
        };
      }),
    );
  }, [data]);

  const envErrors = useMemo(
    () =>
      envRows
        .filter((row) => row.value && !row.key.trim())
        .map((row) => row.id),
    [envRows],
  );
  const portConflicts = useMemo(() => {
    const map = new Map<string, number>();
    portRows.forEach((row) => {
      const key = `${row.hostPort}/${row.protocol}`;
      if (row.hostPort.trim()) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return new Set(
      Array.from(map.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key),
    );
  }, [portRows]);

  const handleSubmit = () => {
    const environment = envRows.reduce<Record<string, string>>((acc, row) => {
      if (row.key.trim()) acc[row.key.trim()] = row.value.trim();
      return acc;
    }, {});
    const ports = portRows
      .filter((row) => row.hostPort.trim() && row.containerPort.trim())
      .map(
        (row) =>
          `${row.hostPort.trim()}:${row.containerPort.trim()}/${row.protocol}`,
      );
    const volumes = volumeRows
      .filter((row) => row.hostPath.trim() && row.containerPath.trim())
      .map(
        (row) =>
          `${row.hostPath.trim()}:${row.containerPath.trim()}:${row.mode}`,
      );

    updateContainer.mutate(
      {
        containerId,
        name,
        image,
        command: command
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        environment,
        ports,
        volumes,
        restart_policy: restartPolicy,
        recreate,
        auto_start: data?.state === "running",
        healthcheck_command: healthcheckCommand,
        healthcheck_interval: healthcheckInterval,
        healthcheck_timeout: healthcheckTimeout,
        healthcheck_start_period: healthcheckStartPeriod,
        healthcheck_retries: Number(healthcheckRetries) || 0,
        healthcheck_disabled: healthcheckDisabled,
      },
      {
        onSuccess: () => {
          showNotification({
            type: "success",
            message: recreate ? "Container recreated" : "Container updated",
            description: name || containerId,
          });
          navigate("/containers");
        },
        onError: (error: any) =>
          showNotification({
            type: "error",
            message: "Container update failed",
            description: error?.message || "Unable to update container.",
          }),
      },
    );
  };

  const hasInvalidPorts =
    portRows.some(
      (row) => !row.hostPort.trim() !== !row.containerPort.trim(),
    ) ||
    portRows.some((row) =>
      portConflicts.has(`${row.hostPort}/${row.protocol}`),
    );
  const disableSave =
    updateContainer.isPending || envErrors.length > 0 || hasInvalidPorts;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-zinc-500">Loading container config...</div>
      </div>
    );
  }

  if (!environmentId) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Missing environment context.
      </div>
    );
  }

  return (
    <div className="pb-32 animate-in fade-in duration-500 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Edit Container
              {data?.state === "running" ? (
                <Badge
                  variant="success"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0"
                >
                  <Activity className="mr-1 h-3 w-3" />
                  Running
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-zinc-500 border-zinc-200 dark:border-zinc-700"
                >
                  {data?.state}
                </Badge>
              )}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <span className="font-mono text-xs max-w-xs truncate">
                {containerId}
              </span>{" "}
              • Adjust runtime configuration
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main Content Area */}
        <div className="space-y-8">
          {/* Health Status Block */}
          {data?.alerts?.length || data?.health_status ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900/30 dark:bg-amber-950/20">
              <div className="flex items-start gap-4">
                <ShieldAlert className="h-6 w-6 text-amber-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                    Runtime Health Issues
                  </h3>
                  <div className="mt-2 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                    <div>
                      <strong>Status:</strong>{" "}
                      {data?.health_status || "unknown"}
                    </div>
                    {(data?.alerts || []).map((alert) => (
                      <div key={alert} className="flex gap-2">
                        <span>•</span>
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* General Configuration */}
          <Card
            title="General Configuration"
            icon={<Box className="h-5 w-5 text-blue-500" />}
            subtitle="Core container details and lifecycle policies"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Container Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900/50"
                />
              </Field>
              <Field label="Image">
                <Input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900/50 font-mono text-sm"
                />
              </Field>
              <Field label="Restart Policy">
                <select
                  value={restartPolicy}
                  onChange={(e) => setRestartPolicy(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="no">No</option>
                  <option value="always">Always</option>
                  <option value="unless-stopped">Unless stopped</option>
                  <option value="on-failure">On failure</option>
                </select>
              </Field>
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer w-5 h-5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                      checked={recreate}
                      onChange={(e) => setRecreate(e.target.checked)}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Recreate container
                    </span>
                    <span className="text-xs text-zinc-500">
                      Required to apply base configuration changes
                    </span>
                  </div>
                </label>
              </div>
              <div className="md:col-span-2">
                <Field
                  label="Command List"
                  helper="One command part per line keeps overrides easier to scan."
                >
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    spellCheck={false}
                    placeholder="npm&#10;start"
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Environment Variables */}
          <Card
            title="Environment Variables"
            icon={<Cpu className="h-5 w-5 text-violet-500" />}
            subtitle="Runtime secrets and configuration mapped as ENV vars"
          >
            <EditableTable
              headers={["Key", "Value", ""]}
              rows={envRows.map((row) => (
                <tr
                  key={row.id}
                  className="group border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
                >
                  <td className="p-3">
                    <Input
                      value={row.key}
                      onChange={(e) =>
                        setEnvRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, key: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="DB_HOST"
                      className={cn(
                        "bg-white dark:bg-black font-mono text-sm",
                        envErrors.includes(row.id) &&
                          "border-red-400 focus:border-red-500 focus:ring-red-500/20",
                      )}
                    />
                    {envErrors.includes(row.id) && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium">
                        Key cannot be empty
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <Input
                        type={row.sensitive ? "password" : "text"}
                        value={row.value}
                        onChange={(e) =>
                          setEnvRows((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, value: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Value..."
                        className="bg-white dark:bg-black font-mono text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEnvRows((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, sensitive: !item.sensitive }
                                : item,
                            ),
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                      >
                        {row.sensitive ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="p-3 w-12 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEnvRows((current) =>
                          current.filter((item) => item.id !== row.id),
                        )
                      }
                      className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              onAdd={() =>
                setEnvRows((current) => [
                  ...current,
                  { id: makeId(), key: "", value: "", sensitive: false },
                ])
              }
              addLabel="Add Variable"
            />
          </Card>

          {/* Port Mappings */}
          <Card
            title="Port Mappings"
            icon={<Network className="h-5 w-5 text-emerald-500" />}
            subtitle="Expose internal container ports to the host interface"
          >
            <EditableTable
              headers={["Host Port", "Container Port", "Protocol", ""]}
              rows={portRows.map((row) => {
                const conflict = portConflicts.has(
                  `${row.hostPort}/${row.protocol}`,
                );
                return (
                  <tr
                    key={row.id}
                    className="group border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
                  >
                    <td className="p-3">
                      <Input
                        value={row.hostPort}
                        onChange={(e) =>
                          setPortRows((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, hostPort: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="8080"
                        className={cn(
                          "bg-white dark:bg-black font-mono text-sm",
                          conflict &&
                            "border-red-400 focus:border-red-500 focus:ring-red-500/20",
                        )}
                      />
                      {conflict && (
                        <p className="mt-1.5 text-xs text-red-500 font-medium">
                          Conflicting mapping
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <Input
                        value={row.containerPort}
                        onChange={(e) =>
                          setPortRows((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, containerPort: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="80"
                        className="bg-white dark:bg-black font-mono text-sm"
                      />
                    </td>
                    <td className="p-3 w-32">
                      <select
                        value={row.protocol}
                        onChange={(e) =>
                          setPortRows((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? {
                                    ...item,
                                    protocol: e.target.value as "tcp" | "udp",
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-black focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      >
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                      </select>
                    </td>
                    <td className="p-3 w-12 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setPortRows((current) =>
                            current.filter((item) => item.id !== row.id),
                          )
                        }
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              onAdd={() =>
                setPortRows((current) => [
                  ...current,
                  {
                    id: makeId(),
                    hostPort: "",
                    containerPort: "",
                    protocol: "tcp",
                  },
                ])
              }
              addLabel="Add Port"
            />
          </Card>

          {/* Volume Mounts */}
          <Card
            title="Volume Mounts"
            icon={<HardDrive className="h-5 w-5 text-cyan-500" />}
            subtitle="Persistent storage mapped from the host to the container"
          >
            <EditableTable
              headers={["Host Path / Vol", "Container Path", "Mode", ""]}
              rows={volumeRows.map((row) => (
                <tr
                  key={row.id}
                  className="group border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
                >
                  <td className="p-3">
                    <Input
                      value={row.hostPath}
                      onChange={(e) =>
                        setVolumeRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, hostPath: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="/srv/data or volume-name"
                      className="bg-white dark:bg-black font-mono text-sm"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      value={row.containerPath}
                      onChange={(e) =>
                        setVolumeRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, containerPath: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="/app/data"
                      className="bg-white dark:bg-black font-mono text-sm"
                    />
                  </td>
                  <td className="p-3 w-40">
                    <select
                      value={row.mode}
                      onChange={(e) =>
                        setVolumeRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, mode: e.target.value as "rw" | "ro" }
                              : item,
                          ),
                        )
                      }
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-black focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    >
                      <option value="rw">Read / Write</option>
                      <option value="ro">Read Only</option>
                    </select>
                  </td>
                  <td className="p-3 w-12 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setVolumeRows((current) =>
                          current.filter((item) => item.id !== row.id),
                        )
                      }
                      className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              onAdd={() =>
                setVolumeRows((current) => [
                  ...current,
                  { id: makeId(), hostPath: "", containerPath: "", mode: "rw" },
                ])
              }
              addLabel="Add Mount"
            />
          </Card>
        </div>

        {/* Sidebar Sticky Area */}
        <div className="relative leading-relaxed">
          <div className="sticky top-6 space-y-6">
            <Card
              title="Healthcheck"
              icon={<Activity className="h-5 w-5 text-rose-500" />}
              subtitle="Self-healing configuration"
              compact
            >
              <label className="flex items-center gap-3 cursor-pointer group mb-5 pb-5 border-b border-zinc-100 dark:border-zinc-800">
                <input
                  type="checkbox"
                  className="peer w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                  checked={healthcheckDisabled}
                  onChange={(e) => setHealthcheckDisabled(e.target.checked)}
                />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">
                  Disable custom healthcheck
                </span>
              </label>
              <div
                className={cn(
                  "space-y-4 transition-opacity",
                  healthcheckDisabled && "opacity-50 pointer-events-none",
                )}
              >
                <Field label="Command">
                  <Input
                    value={healthcheckCommand}
                    onChange={(e) => setHealthcheckCommand(e.target.value)}
                    placeholder="curl -f http://.../health"
                    className="bg-zinc-50 dark:bg-zinc-900/50 font-mono text-sm"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Interval">
                    <Input
                      value={healthcheckInterval}
                      onChange={(e) => setHealthcheckInterval(e.target.value)}
                      placeholder="30s"
                      className="bg-zinc-50 dark:bg-zinc-900/50"
                    />
                  </Field>
                  <Field label="Timeout">
                    <Input
                      value={healthcheckTimeout}
                      onChange={(e) => setHealthcheckTimeout(e.target.value)}
                      placeholder="5s"
                      className="bg-zinc-50 dark:bg-zinc-900/50"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Period">
                    <Input
                      value={healthcheckStartPeriod}
                      onChange={(e) =>
                        setHealthcheckStartPeriod(e.target.value)
                      }
                      placeholder="10s"
                      className="bg-zinc-50 dark:bg-zinc-900/50"
                    />
                  </Field>
                  <Field label="Retries">
                    <Input
                      value={healthcheckRetries}
                      onChange={(e) => setHealthcheckRetries(e.target.value)}
                      placeholder="3"
                      className="bg-zinc-50 dark:bg-zinc-900/50"
                    />
                  </Field>
                </div>
              </div>
            </Card>

            {/* Summary / Save Card */}
            <div className="rounded-md border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-[#121212] dark:shadow-none">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                Summary Configuration
              </h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />{" "}
                  {envRows.length} Environment Variables
                </li>
                <li className="flex items-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />{" "}
                  {portRows.length} Port Mappings
                </li>
                <li className="flex items-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />{" "}
                  {volumeRows.length} Volume Mounts
                </li>
                {recreate && (
                  <li className="flex items-center text-sm font-medium text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />{" "}
                    Container will be explicitly recreated
                  </li>
                )}
              </ul>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                {envErrors.length > 0 || hasInvalidPorts ? (
                  <div className="flex items-center gap-2 mb-4 text-amber-600 text-sm font-medium bg-amber-50 dark:bg-amber-950 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    Please resolve validation issues to apply changes.
                  </div>
                ) : null}
                <Button
                  variant="primary"
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 py-6 text-base shadow-md shadow-blue-500/20"
                  onClick={handleSubmit}
                  disabled={disableSave}
                  isLoading={updateContainer.isPending}
                >
                  <Save className="mr-2 h-5 w-5" />
                  Apply Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]",
        compact ? "p-5" : "p-6 md:p-8",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-4 border-b border-zinc-100 dark:border-zinc-800",
          compact ? "pb-4 mb-5" : "pb-6 mb-8",
        )}
      >
        {icon && (
          <div className="mt-1 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
            {icon}
          </div>
        )}
        <div>
          <h3
            className={cn(
              "font-bold text-zinc-900 dark:text-zinc-50 tracking-tight",
              compact ? "text-base" : "text-lg",
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      {children}
      {helper && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {helper}
        </p>
      )}
    </div>
  );
}

function EditableTable({
  headers,
  rows,
  onAdd,
  addLabel,
}: {
  headers: string[];
  rows: React.ReactNode[];
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50/80 dark:bg-zinc-900/40">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider dark:text-zinc-400"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-zinc-500 font-medium text-sm"
                >
                  No items added.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-zinc-200 bg-zinc-50/30 p-3 dark:border-zinc-800 dark:bg-zinc-900/20 text-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="rounded-xl bg-white dark:bg-[#121212] font-semibold border-zinc-200 dark:border-zinc-700 shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
