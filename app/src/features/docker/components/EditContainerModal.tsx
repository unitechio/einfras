import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";
import { useContainerConfig, useUpdateContainer } from "../api/useDockerHooks";

interface EditContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  environmentId: string;
  containerId: string;
}

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

export default function EditContainerModal({
  isOpen,
  onClose,
  environmentId,
  containerId,
}: EditContainerModalProps) {
  const { showNotification } = useNotification();
  const { data } = useContainerConfig(environmentId, containerId);
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
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  if (!isOpen) return null;

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
          onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <Pencil className="h-5 w-5 text-blue-500" />
              Edit Container
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Update runtime config with a clearer, production-grade editing
              flow.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              {data?.alerts?.length || data?.health_status ? (
                <SectionCard title="Runtime Health" tone="warning">
                  <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                    <div>Health status: {data?.health_status || "unknown"}</div>
                    {(data?.alerts || []).map((alert) => (
                      <div key={alert}>• {alert}</div>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard title="General Info">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Container Name">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label="Image">
                    <Input
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                    />
                  </Field>
                  <Field label="Restart Policy">
                    <select
                      value={restartPolicy}
                      onChange={(e) => setRestartPolicy(e.target.value)}
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                    >
                      <option value="no">No</option>
                      <option value="always">Always</option>
                      <option value="unless-stopped">Unless stopped</option>
                      <option value="on-failure">On failure</option>
                    </select>
                  </Field>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={recreate}
                        onChange={(e) => setRecreate(e.target.checked)}
                      />
                      Recreate container to apply runtime changes
                    </label>
                  </div>
                </div>
                <Field
                  label="Command"
                  helper="One command part per line keeps overrides easier to scan."
                >
                  <textarea
                    className="min-h-[110px] w-full rounded-2xl border border-zinc-200 bg-white p-3 font-mono text-sm dark:border-zinc-800 dark:bg-[#121212]"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    spellCheck={false}
                  />
                </Field>
              </SectionCard>

              <SectionCard
                title="Environment Variables"
                helper="Inline editing, sensitive value masking and empty-key validation."
              >
                <EditableTable
                  headers={["Key", "Value", "Actions"]}
                  rows={envRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-zinc-100 dark:border-zinc-800"
                    >
                      <td className="p-3 align-top">
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
                          placeholder="ENV_KEY"
                          className={
                            envErrors.includes(row.id)
                              ? "border-red-300 dark:border-red-700"
                              : ""
                          }
                        />
                        {envErrors.includes(row.id) ? (
                          <p className="mt-1 text-xs text-red-600">
                            Key is required when a value is set.
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3 align-top">
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
                            placeholder="value"
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                          >
                            {row.sensitive ? (
                              <Eye size={15} />
                            ) : (
                              <EyeOff size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setEnvRows((current) =>
                              current.filter((item) => item.id !== row.id),
                            )
                          }
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
                  addLabel="Add variable"
                />
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard
                title="Port Mappings"
                helper="Avoid duplicate host ports per protocol."
              >
                <EditableTable
                  headers={[
                    "Host Port",
                    "Container Port",
                    "Protocol",
                    "Actions",
                  ]}
                  rows={portRows.map((row) => {
                    const conflict = portConflicts.has(
                      `${row.hostPort}/${row.protocol}`,
                    );
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="p-3 align-top">
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
                            className={
                              conflict
                                ? "border-red-300 dark:border-red-700"
                                : ""
                            }
                          />
                        </td>
                        <td className="p-3 align-top">
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
                          />
                        </td>
                        <td className="p-3 align-top">
                          <select
                            value={row.protocol}
                            onChange={(e) =>
                              setPortRows((current) =>
                                current.map((item) =>
                                  item.id === row.id
                                    ? {
                                        ...item,
                                        protocol: e.target.value as
                                          | "tcp"
                                          | "udp",
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                          >
                            <option value="tcp">TCP</option>
                            <option value="udp">UDP</option>
                          </select>
                          {conflict ? (
                            <p className="mt-1 text-xs text-red-600">
                              Duplicate host port for this protocol.
                            </p>
                          ) : null}
                        </td>
                        <td className="p-3 align-top">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setPortRows((current) =>
                                current.filter((item) => item.id !== row.id),
                              )
                            }
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
                  addLabel="Add port"
                />
              </SectionCard>

              <SectionCard
                title="Volume Mounts"
                helper="Keep host path, target path and access mode visible in one place."
              >
                <EditableTable
                  headers={["Host Path", "Container Path", "Mode", "Actions"]}
                  rows={volumeRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-zinc-100 dark:border-zinc-800"
                    >
                      <td className="p-3 align-top">
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
                          placeholder="/srv/data or named-volume"
                        />
                      </td>
                      <td className="p-3 align-top">
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
                        />
                      </td>
                      <td className="p-3 align-top">
                        <select
                          value={row.mode}
                          onChange={(e) =>
                            setVolumeRows((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      mode: e.target.value as "rw" | "ro",
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                        >
                          <option value="rw">Read / Write</option>
                          <option value="ro">Read Only</option>
                        </select>
                      </td>
                      <td className="p-3 align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setVolumeRows((current) =>
                              current.filter((item) => item.id !== row.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  onAdd={() =>
                    setVolumeRows((current) => [
                      ...current,
                      {
                        id: makeId(),
                        hostPath: "",
                        containerPath: "",
                        mode: "rw",
                      },
                    ])
                  }
                  addLabel="Add mount"
                />
              </SectionCard>

              <SectionCard
                title="Advanced Settings"
                helper="Collapse low-frequency healthcheck settings by default."
              >
                <button
                  type="button"
                  onClick={() => setShowAdvanced((current) => !current)}
                  className="mb-4 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                >
                  {showAdvanced
                    ? "Hide advanced health settings"
                    : "Show advanced health settings"}
                </button>
                {showAdvanced ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Healthcheck Command">
                      <Input
                        value={healthcheckCommand}
                        onChange={(e) => setHealthcheckCommand(e.target.value)}
                        placeholder="curl -f http://localhost:8080/health || exit 1"
                      />
                    </Field>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={healthcheckDisabled}
                          onChange={(e) =>
                            setHealthcheckDisabled(e.target.checked)
                          }
                        />
                        Disable healthcheck for recreated container
                      </label>
                    </div>
                    <Field label="Healthcheck Interval">
                      <Input
                        value={healthcheckInterval}
                        onChange={(e) => setHealthcheckInterval(e.target.value)}
                        placeholder="30s"
                      />
                    </Field>
                    <Field label="Healthcheck Timeout">
                      <Input
                        value={healthcheckTimeout}
                        onChange={(e) => setHealthcheckTimeout(e.target.value)}
                        placeholder="5s"
                      />
                    </Field>
                    <Field label="Healthcheck Start Period">
                      <Input
                        value={healthcheckStartPeriod}
                        onChange={(e) =>
                          setHealthcheckStartPeriod(e.target.value)
                        }
                        placeholder="10s"
                      />
                    </Field>
                    <Field label="Healthcheck Retries">
                      <Input
                        value={healthcheckRetries}
                        onChange={(e) => setHealthcheckRetries(e.target.value)}
                        placeholder="3"
                      />
                    </Field>
                  </div>
                ) : null}
              </SectionCard>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-zinc-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-[#121212]/95">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {envErrors.length > 0 || hasInvalidPorts ? (
              <span className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                Resolve validation issues before saving.
              </span>
            ) : (
              "Changes are ready to apply."
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={disableSave}
              isLoading={updateContainer.isPending}
            >
              Apply Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  helper,
  tone = "default",
  children,
}: {
  title: string;
  helper?: string;
  tone?: "default" | "warning";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[24px] border p-5 shadow-sm ${tone === "warning" ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#121212]"}`}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        {helper ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {helper}
          </p>
        ) : null}
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
      <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      {children}
      {helper ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {helper}
        </p>
      ) : null}
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
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
