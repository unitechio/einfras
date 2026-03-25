import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Rocket, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { Badge } from "@/shared/ui/Badge";
import { useNotification } from "@/core/NotificationContext";
import { useCreateContainer, useDeployStack, useDockerSwarmStatus } from "../api/useDockerHooks";
import { useRegistries } from "@/features/repositories/api/useRepositories";
import { tagsApi } from "@/features/catalog/api";
import { useRuntimeFeatureFlags } from "@/features/settings/useRuntimeFeatureFlags";
import {
  buildRequiredRuntimeEnv,
  getImageDeployPreset,
  getRequiredEnvWarnings,
  getSuggestedPortMappings,
  getVolumeTargetWarnings,
} from "../runtime-image-presets";

type KeyValueRow = { key: string; value: string };
type PortRow = { hostPort: string; containerPort: string; protocol: "tcp" | "udp" };
type VolumeRow = {
  source: string;
  target: string;
  mode: "rw" | "ro";
  sourceType: "named" | "bind";
};
type ServiceDraft = {
  id: string;
  name: string;
  image: string;
  env: KeyValueRow[];
  ports: PortRow[];
  volumes: VolumeRow[];
  networks: string[];
  dependsOn: string[];
  secretRefs: string[];
  configRefs: string[];
  tags: string[];
  restartPolicy: "no" | "always" | "unless-stopped" | "on-failure";
  containerName: string;
  memoryLimit: string;
  cpuLimit: string;
  healthcheckCommand: string;
  healthcheckInterval: string;
  healthcheckTimeout: string;
  healthcheckRetries: string;
  loggingDriver: string;
  loggingMaxSize: string;
  loggingMaxFile: string;
  expanded: boolean;
  advancedOpen: boolean;
};

interface DeployContainerModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  environmentId: string;
  embedded?: boolean;
  initialImage?: string;
  initialMode?: "single" | "compose";
}

const emptyEnv = (): KeyValueRow => ({ key: "", value: "" });
const emptyPort = (): PortRow => ({ hostPort: "", containerPort: "", protocol: "tcp" });
const emptyVolume = (): VolumeRow => ({ source: "", target: "", mode: "rw", sourceType: "named" });
const createService = (
  name = "app",
  image = "nginx:stable-alpine",
): ServiceDraft => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  image,
  env: [emptyEnv()],
  ports: [emptyPort()],
  volumes: [emptyVolume()],
  networks: ["default"],
  dependsOn: [],
  secretRefs: [],
  configRefs: [],
  tags: [],
  restartPolicy: "unless-stopped",
  containerName: "",
  memoryLimit: "",
  cpuLimit: "",
  healthcheckCommand: "",
  healthcheckInterval: "30s",
  healthcheckTimeout: "5s",
  healthcheckRetries: "3",
  loggingDriver: "json-file",
  loggingMaxSize: "10m",
  loggingMaxFile: "3",
  expanded: true,
  advancedOpen: false,
});

const toRecord = (rows: KeyValueRow[]) =>
  rows.reduce<Record<string, string>>((acc, row) => {
    if (row.key.trim()) acc[row.key.trim()] = row.value;
    return acc;
  }, {});

const toPortList = (rows: PortRow[]) =>
  rows
    .filter((row) => row.hostPort.trim() && row.containerPort.trim())
    .map(
      (row) =>
        `${row.hostPort.trim()}:${row.containerPort.trim()}${row.protocol === "udp" ? "/udp" : ""}`,
    );

const toVolumeList = (rows: VolumeRow[]) =>
  rows
    .filter((row) => row.source.trim() && row.target.trim())
    .map(
      (row) =>
        `${row.source.trim()}:${row.target.trim()}${row.mode === "ro" ? ":ro" : ""}`,
    );

const isBindSource = (value: string) =>
  /^(\/|\.\/|\.\.\/|[a-zA-Z]:\\|\\\\)/.test(value.trim());

const isValidBindPath = (value: string) =>
  /^(\/[^\0]*|\.\/[^\0]*|\.\.\/[^\0]*|[a-zA-Z]:\\[^\0]*|\\\\[^\\]+\\[^\\]+.*)$/.test(
    value.trim(),
  );

const isValidNamedVolume = (value: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(value.trim());

const slugifyTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildTagLabels = (tags: string[]) => {
  const normalized = Array.from(
    new Set(tags.map((item) => item.trim()).filter(Boolean)),
  );
  if (normalized.length === 0) {
    return {};
  }
  return normalized.reduce<Record<string, string>>((acc, tag) => {
    const slug = slugifyTag(tag);
    if (slug) {
      acc[`einfra.tag.${slug}`] = "true";
    }
    acc["einfra.tags"] = normalized.join(", ");
    return acc;
  }, {});
};

const toSwarmRestartCondition = (value: ServiceDraft["restartPolicy"]) => {
  switch (value) {
    case "always":
    case "unless-stopped":
      return "any";
    case "on-failure":
      return "on-failure";
    case "no":
    default:
      return "none";
  }
};

const buildComposeYaml = (
  services: ServiceDraft[],
  namedVolumes: string[],
  namedNetworks: string[],
  sharedEnvRows: KeyValueRow[],
  sharedTags: string[],
  secretRows: KeyValueRow[],
  configRows: KeyValueRow[],
) => {
  const normalizedVolumes = namedVolumes
    .map((item) => item.trim())
    .filter(Boolean);
  const normalizedNetworks = namedNetworks
    .map((item) => item.trim())
    .filter(Boolean);
  const sharedEnv = toRecord(sharedEnvRows);
  const sharedSecrets = toRecord(secretRows);
  const sharedConfigs = toRecord(configRows);
  const defaultNetwork = normalizedNetworks[0] || "default";
  const servicesBlock = services
    .map((service) => {
      const env = { ...sharedEnv, ...toRecord(service.env) };
      const ports = toPortList(service.ports);
      const volumes = toVolumeList(service.volumes);
      const networks = service.networks
        .map((item) => item.trim())
        .filter(Boolean);
      const labels = buildTagLabels([...sharedTags, ...service.tags]);
      const lines = [
        `  ${service.name || "service"}:`,
        `    image: ${service.image || "nginx:stable-alpine"}`,
      ];
      if (Object.keys(env).length) {
        lines.push("    environment:");
        Object.entries(env).forEach(([key, value]) =>
          lines.push(`      ${key}: "${value}"`),
        );
      }
      if (Object.keys(labels).length) {
        lines.push("    labels:");
        Object.entries(labels).forEach(([key, value]) =>
          lines.push(`      ${key}: "${value}"`),
        );
      }
      if (ports.length) {
        lines.push("    ports:");
        ports.forEach((port) => lines.push(`      - "${port}"`));
      }
      if (volumes.length) {
        lines.push("    volumes:");
        volumes.forEach((volume) => lines.push(`      - "${volume}"`));
      }
      lines.push("    networks:");
      (networks.length ? networks : [defaultNetwork]).forEach((network) =>
        lines.push(`      - ${network}`),
      );
      if (service.dependsOn.length) {
        lines.push("    depends_on:");
        service.dependsOn.filter((dependency) => dependency.trim()).forEach((dependency) =>
          lines.push(`      - ${dependency}`),
        );
      }
      if (service.secretRefs.filter((item) => item.trim()).length) {
        lines.push("    secrets:");
        service.secretRefs.filter((item) => item.trim()).forEach((secret) =>
          lines.push(`      - ${secret}`),
        );
      }
      if (service.configRefs.filter((item) => item.trim()).length) {
        lines.push("    configs:");
        service.configRefs.filter((item) => item.trim()).forEach((config) =>
          lines.push(`      - ${config}`),
        );
      }
      const needsDeployBlock =
        service.memoryLimit.trim() ||
        service.cpuLimit.trim() ||
        service.restartPolicy;
      if (needsDeployBlock) {
        lines.push("    deploy:");
        lines.push("      restart_policy:");
        lines.push(
          `        condition: ${toSwarmRestartCondition(service.restartPolicy)}`,
        );
      }
      if (service.memoryLimit.trim() || service.cpuLimit.trim()) {
        lines.push("      resources:");
        lines.push("        limits:");
        if (service.memoryLimit.trim()) {
          lines.push(`          memory: "${service.memoryLimit.trim()}"`);
        }
        if (service.cpuLimit.trim()) {
          lines.push(`          cpus: "${service.cpuLimit.trim()}"`);
        }
      }
      if (service.healthcheckCommand.trim()) {
        lines.push("    healthcheck:");
        lines.push(
          `      test: ["CMD-SHELL", "${service.healthcheckCommand.replace(/"/g, '\\"')}"]`,
        );
        if (service.healthcheckInterval.trim()) {
          lines.push(`      interval: "${service.healthcheckInterval.trim()}"`);
        }
        if (service.healthcheckTimeout.trim()) {
          lines.push(`      timeout: "${service.healthcheckTimeout.trim()}"`);
        }
        if (service.healthcheckRetries.trim()) {
          lines.push(`      retries: ${service.healthcheckRetries.trim()}`);
        }
      }
      if (service.loggingDriver.trim()) {
        lines.push("    logging:");
        lines.push(`      driver: ${service.loggingDriver.trim()}`);
        lines.push("      options:");
        if (service.loggingMaxSize.trim()) {
          lines.push(`        max-size: "${service.loggingMaxSize.trim()}"`);
        }
        if (service.loggingMaxFile.trim()) {
          lines.push(`        max-file: "${service.loggingMaxFile.trim()}"`);
        }
      }
      return lines.join("\n");
    })
    .join("\n");

  const volumeBlock = normalizedVolumes.length
    ? `\nvolumes:\n${normalizedVolumes.map((volume) => `  ${volume}:`).join("\n")}`
    : "";
  const composeNetworks = Array.from(new Set([...normalizedNetworks, defaultNetwork]));
  const networkBlock = `\nnetworks:\n${composeNetworks.map((network) => `  ${network}:\n    driver: bridge`).join("\n")}`;
  const secretsBlock = Object.keys(sharedSecrets).length
    ? `\nsecrets:\n${Object.keys(sharedSecrets).map((secret) => `  ${secret}:\n    external: false`).join("\n")}`
    : "";
  const configsBlock = Object.keys(sharedConfigs).length
    ? `\nconfigs:\n${Object.keys(sharedConfigs).map((config) => `  ${config}:\n    external: false`).join("\n")}`
    : "";
  return `services:\n${servicesBlock}${volumeBlock}${networkBlock}${secretsBlock}${configsBlock}`;
};

const buildSingleContainerYaml = ({
  image,
  name,
  containerName,
  restartPolicy,
  registryId,
  selectedRegistryName,
  envRows,
  portRows,
  volumeRows,
  selectedTags,
  memoryLimit,
  cpuLimit,
  healthcheckCommand,
  healthcheckInterval,
  healthcheckTimeout,
  healthcheckStartPeriod,
  healthcheckRetries,
  healthcheckDisabled,
}: {
  image: string;
  name: string;
  containerName: string;
  restartPolicy: string;
  registryId: string;
  selectedRegistryName?: string;
  envRows: KeyValueRow[];
  portRows: PortRow[];
  volumeRows: VolumeRow[];
  selectedTags: string[];
  memoryLimit: string;
  cpuLimit: string;
  healthcheckCommand: string;
  healthcheckInterval: string;
  healthcheckTimeout: string;
  healthcheckStartPeriod: string;
  healthcheckRetries: string;
  healthcheckDisabled: boolean;
}) => {
  const lines = [
    `image: ${image || "nginx:stable-alpine"}`,
    `name: ${name || containerName || "auto"}`,
    `restart: ${restartPolicy}`,
  ];
  if (containerName.trim()) {
    lines.push(`container_name: ${containerName.trim()}`);
  }
  if (registryId.trim() || selectedRegistryName?.trim()) {
    lines.push("registry:");
    if (selectedRegistryName?.trim()) {
      lines.push(`  name: ${selectedRegistryName.trim()}`);
    }
    if (registryId.trim()) {
      lines.push(`  id: ${registryId.trim()}`);
    }
  }
  lines.push("ports:");
  const ports = toPortList(portRows);
  if (ports.length) {
    ports.forEach((row) => lines.push(`  - "${row}"`));
  } else {
    lines.push("  []");
  }
  lines.push("volumes:");
  const volumes = toVolumeList(volumeRows);
  if (volumes.length) {
    volumes.forEach((row) => lines.push(`  - "${row}"`));
  } else {
    lines.push("  []");
  }
  lines.push("environment:");
  const environment = toRecord(envRows);
  if (Object.keys(environment).length) {
    Object.entries(environment).forEach(([key, value]) =>
      lines.push(`  ${key}: "${value}"`),
    );
  } else {
    lines.push("  {}");
  }
  const labels = buildTagLabels(selectedTags);
  if (Object.keys(labels).length) {
    lines.push("labels:");
    Object.entries(labels).forEach(([key, value]) =>
      lines.push(`  ${key}: "${value}"`),
    );
  }
  if (memoryLimit.trim() || cpuLimit.trim()) {
    lines.push("resources:");
    if (memoryLimit.trim()) {
      lines.push(`  memory: "${memoryLimit.trim()}"`);
    }
    if (cpuLimit.trim()) {
      lines.push(`  cpus: "${cpuLimit.trim()}"`);
    }
  }
  if (healthcheckDisabled) {
    lines.push("healthcheck:");
    lines.push("  disabled: true");
  } else if (healthcheckCommand.trim()) {
    lines.push("healthcheck:");
    lines.push(`  test: "${healthcheckCommand.trim().replace(/"/g, '\\"')}"`);
    if (healthcheckInterval.trim()) {
      lines.push(`  interval: "${healthcheckInterval.trim()}"`);
    }
    if (healthcheckTimeout.trim()) {
      lines.push(`  timeout: "${healthcheckTimeout.trim()}"`);
    }
    if (healthcheckStartPeriod.trim()) {
      lines.push(`  start_period: "${healthcheckStartPeriod.trim()}"`);
    }
    if (healthcheckRetries.trim()) {
      lines.push(`  retries: ${healthcheckRetries.trim()}`);
    }
  }
  return lines.join("\n");
};

function RowEditor({
  title,
  rows,
  onChange,
  leftLabel,
  rightLabel,
  leftPlaceholder,
  rightPlaceholder,
  isEnv = false,
}: {
  title: string;
  rows: Array<KeyValueRow | PortRow | VolumeRow>;
  onChange: (rows: any[]) => void;
  leftLabel: string;
  rightLabel: string;
  leftPlaceholder: string;
  rightPlaceholder: string;
  isEnv?: boolean;
}) {
  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </label>
      </div>
      <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
        {rows.map((row: any, index) => (
          <div
            key={`${title}-${index}`}
            className="grid grid-cols-[1fr_1fr_auto] gap-2"
          >
            <div>
              {index === 0 ? (
                <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {leftLabel}
                </div>
              ) : null}
              <Input
                value={row.key ?? row.hostPort ?? row.source}
                onChange={(event) =>
                  onChange(
                    rows.map((item: any, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            [row.key !== undefined
                              ? "key"
                              : row.hostPort !== undefined
                                ? "hostPort"
                                : "source"]:
                              event.target.value,
                          }
                        : item,
                    ),
                  )
                }
                placeholder={leftPlaceholder}
              />
            </div>
            <div>
              {index === 0 ? (
                <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {rightLabel}
                </div>
              ) : null}
              <Input
                value={row.value ?? row.containerPort ?? row.target}
                onChange={(event) =>
                  onChange(
                    rows.map((item: any, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            [row.value !== undefined
                              ? "value"
                              : row.containerPort !== undefined
                                ? "containerPort"
                                : "target"]:
                              event.target.value,
                          }
                        : item,
                    ),
                  )
                }
                placeholder={rightPlaceholder}
              />
            </div>
            <div className="flex items-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  onChange([
                    ...rows,
                    isEnv
                      ? emptyEnv()
                      : title.toLowerCase().includes("volume")
                        ? emptyVolume()
                        : emptyPort(),
                  ])
                }
                title="Add row"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  onChange(
                    rows.length > 1
                      ? rows.filter((_, itemIndex) => itemIndex !== index)
                      : [
                          isEnv
                            ? emptyEnv()
                            : title.toLowerCase().includes("volume")
                              ? emptyVolume()
                              : emptyPort(),
                        ],
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange([
              ...rows,
              isEnv
                ? emptyEnv()
                : title.toLowerCase().includes("volume")
                  ? emptyVolume()
                  : emptyPort(),
            ])
          }
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <Plus className="h-4 w-4" />
          Add row
        </button>
      </div>
    </div>
  );
}

export default function DeployContainerModal({
  isOpen = true,
  onClose,
  environmentId,
  embedded = false,
  initialImage = "",
  initialMode = "single",
}: DeployContainerModalProps) {
  const { showNotification } = useNotification();
  const featureFlags = useRuntimeFeatureFlags();
  const createContainer = useCreateContainer(environmentId);
  const deployStack = useDeployStack(environmentId);
  const { data: swarmStatus } = useDockerSwarmStatus(environmentId);
  const { data: registries = [] } = useRegistries();
  const [mode, setMode] = useState<"single" | "compose">(initialMode);
  const [singleTab, setSingleTab] = useState("basic");
  const [name, setName] = useState("");
  const [image, setImage] = useState(initialImage);
  const [envRows, setEnvRows] = useState<KeyValueRow[]>([emptyEnv()]);
  const [portRows, setPortRows] = useState<PortRow[]>([emptyPort()]);
  const [volumeRows, setVolumeRows] = useState<VolumeRow[]>([emptyVolume()]);
  const [restartPolicy, setRestartPolicy] = useState<"no" | "always" | "unless-stopped" | "on-failure">("unless-stopped");
  const [registryId, setRegistryId] = useState("");
  const [containerName, setContainerName] = useState("");
  const [memoryLimit, setMemoryLimit] = useState("");
  const [cpuLimit, setCpuLimit] = useState("");
  const [singleAdvancedOpen, setSingleAdvancedOpen] = useState(false);
  const [healthcheckCommand, setHealthcheckCommand] = useState("");
  const [healthcheckInterval, setHealthcheckInterval] = useState("30s");
  const [healthcheckTimeout, setHealthcheckTimeout] = useState("5s");
  const [healthcheckStartPeriod, setHealthcheckStartPeriod] = useState("");
  const [healthcheckRetries, setHealthcheckRetries] = useState("3");
  const [healthcheckDisabled, setHealthcheckDisabled] = useState(false);
  const [stackName, setStackName] = useState("app-stack");
  const [stackEnvRows, setStackEnvRows] = useState<KeyValueRow[]>([emptyEnv()]);
  const [stackSecretRows, setStackSecretRows] = useState<KeyValueRow[]>([emptyEnv()]);
  const [stackConfigRows, setStackConfigRows] = useState<KeyValueRow[]>([emptyEnv()]);
  const [namedVolumes, setNamedVolumes] = useState<string[]>(["app-data"]);
  const [namedNetworks, setNamedNetworks] = useState<string[]>(["app-network"]);
  const [services, setServices] = useState<ServiceDraft[]>([
    createService("app", initialImage || "nginx:stable-alpine"),
  ]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [composeYaml, setComposeYaml] = useState(
    buildComposeYaml(
      [createService("app", initialImage || "nginx:stable-alpine")],
      ["app-data"],
      ["app-network"],
      [emptyEnv()],
      [],
      [emptyEnv()],
      [emptyEnv()],
    ),
  );

  const selectedRegistry = useMemo(
    () =>
      registries.find((item) => item.id === registryId) ||
      registries.find((item) => item.is_default),
    [registries, registryId],
  );

  const singlePreset = useMemo(() => getImageDeployPreset(image), [image]);
  const singlePortSuggestions = useMemo(() => getSuggestedPortMappings(image), [image]);
  const singleVolumeWarnings = useMemo(
    () => getVolumeTargetWarnings(image, volumeRows.map((row) => row.target)),
    [image, volumeRows],
  );
  const singleEnvWarnings = useMemo(
    () => getRequiredEnvWarnings(image, toRecord(envRows)),
    [image, envRows],
  );
  const singlePortConflicts = useMemo(() => {
    const ports = portRows
      .filter((row) => row.hostPort.trim())
      .map((row) => `${row.hostPort.trim()}/${row.protocol}`);
    return new Set(
      ports.filter((port, index) => ports.indexOf(port) !== index),
    );
  }, [portRows]);
  const composePortConflicts = useMemo(() => {
    const ports = services.flatMap((service) =>
      service.ports
        .filter((row) => row.hostPort.trim())
        .map((row) => `${row.hostPort.trim()}/${row.protocol}`),
    );
    return new Set(
      ports.filter((port, index) => ports.indexOf(port) !== index),
    );
  }, [services]);
  const composeWarnings = useMemo(
    () =>
      [
        ...services.flatMap((service) => [
          ...getVolumeTargetWarnings(
            service.image,
            service.volumes.map((row) => row.target),
          ).map((warning) => `${service.name || "service"}: ${warning}`),
          ...getRequiredEnvWarnings(service.image, {
            ...toRecord(stackEnvRows),
            ...toRecord(service.env),
          }).map((warning) => `${service.name || "service"}: ${warning}`),
          ...(!service.networks.map((item) => item.trim()).filter(Boolean).length
            ? [`${service.name || "service"}: no network selected, default will be attached automatically.`]
            : []),
          ...(service.containerName.trim()
            ? [`${service.name || "service"}: container_name is ignored for swarm stack deploy and will not be applied.`]
            : []),
          ...(service.restartPolicy === "unless-stopped"
            ? [`${service.name || "service"}: unless-stopped is converted to swarm restart policy 'any'.`]
            : []),
        ]),
        ...(swarmStatus && !swarmStatus.is_manager
          ? [
              `This Docker environment is not a Swarm manager (${swarmStatus.local_node_state || "inactive"}). The runtime will fall back to docker compose up -d for this deploy.`,
            ]
          : []),
      ],
    [services, stackEnvRows, swarmStatus],
  );

  useEffect(() => {
    if (initialImage.trim()) {
      setImage(initialImage.trim());
      setServices((current) =>
        current.map((service, index) =>
          index === 0 ? { ...service, image: initialImage.trim() } : service,
        ),
      );
    }
  }, [initialImage]);

  useEffect(() => {
    if (!image.trim()) {
      return;
    }
    setEnvRows((current) => {
      const preset = buildRequiredRuntimeEnv(image, toRecord(current as KeyValueRow[]));
      if (preset.autofilled.length === 0 && Object.keys(toRecord(current)).length > 0) {
        return current;
      }
      return Object.entries(preset.environment).map(([key, value]) => ({ key, value }));
    });
    const preset = getImageDeployPreset(image);
    if (preset?.suggestedPorts?.length && !portRows.some((row) => row.hostPort.trim() || row.containerPort.trim())) {
      setPortRows(
        preset.suggestedPorts.map((entry) => {
          const [hostPort = "", containerPort = ""] = entry.split(":");
          return { hostPort, containerPort, protocol: "tcp" as const };
        }),
      );
    }
    if (preset?.volumeTargets?.length && !volumeRows.some((row) => row.target.trim())) {
      setVolumeRows(
        preset.volumeTargets.map((target) => ({
          source: `${(name || preset.defaultContainerName || "app").replace(/\s+/g, "-")}-data`,
          target,
          mode: "rw" as const,
          sourceType: "named" as const,
        })),
      );
    }
    if (preset?.defaultContainerName && !containerName.trim()) {
      setContainerName(preset.defaultContainerName);
    }
    if (preset?.suggestedMemory && !memoryLimit.trim()) {
      setMemoryLimit(preset.suggestedMemory);
    }
    if (preset?.suggestedCpus && !cpuLimit.trim()) {
      setCpuLimit(preset.suggestedCpus);
    }
    if (preset?.healthcheckCommand && !healthcheckCommand.trim()) {
      setHealthcheckCommand(preset.healthcheckCommand);
    }
  }, [image]);

  useEffect(() => {
    tagsApi
      .list()
      .then((items) =>
        setAvailableTags(
          items
            .map((item) => item.name)
            .sort((left, right) => left.localeCompare(right)),
        ),
      )
      .catch(() => setAvailableTags([]));
  }, []);

  useEffect(() => {
    setComposeYaml(
      buildComposeYaml(
        services,
        namedVolumes,
        namedNetworks,
        stackEnvRows,
        selectedTags,
        stackSecretRows,
        stackConfigRows,
      ),
    );
  }, [namedNetworks, namedVolumes, selectedTags, services, stackEnvRows, stackSecretRows, stackConfigRows]);

  useEffect(() => {
    if (
      !featureFlags.isLoading &&
      !featureFlags.isEnabled("docker_compose_runtime", true) &&
      mode === "compose"
    ) {
      setMode("single");
    }
  }, [featureFlags, mode]);

  if (!embedded && !isOpen) return null;

  const close = () => onClose?.();

  const submitSingle = () => {
    const preset = buildRequiredRuntimeEnv(image, toRecord(envRows));
    if (singlePortConflicts.size) {
      showNotification({
        type: "error",
        message: "Port conflict detected",
        description: "Resolve duplicate host ports before deploy.",
      });
      return;
    }
    if (preset.autofilled.length > 0) {
      showNotification({
        type: "info",
        message: "Required environment values generated",
        description: `Auto-filled ${preset.autofilled.join(", ")} for ${image}.`,
      });
    }
    createContainer.mutate(
      {
        name: name || containerName || undefined,
        image,
        environment: preset.environment,
        ports: toPortList(portRows),
        volumes: toVolumeList(volumeRows),
        labels: buildTagLabels(selectedTags),
        restart_policy: restartPolicy,
        registry_id: registryId || selectedRegistry?.id,
        auto_start: true,
        healthcheck_command: healthcheckCommand || undefined,
        healthcheck_interval: healthcheckInterval || undefined,
        healthcheck_timeout: healthcheckTimeout || undefined,
        healthcheck_start_period: healthcheckStartPeriod || undefined,
        healthcheck_retries: Number(healthcheckRetries) || undefined,
        healthcheck_disabled: healthcheckDisabled,
      },
      {
        onSuccess: (response) => {
          showNotification({
            type: "success",
            message: "Container deployed",
            description: response.container_id || image,
          });
          onClose?.();
        },
        onError: (error: any) =>
          showNotification({
            type: "error",
            message: "Container deploy failed",
            description: error?.message || "Unable to create container.",
          }),
      },
    );
  };

  const submitCompose = () => {
    if (!stackName.trim()) {
      showNotification({
        type: "error",
        message: "Stack name required",
        description: "Provide a Docker Compose stack name.",
      });
      return;
    }
    if (composePortConflicts.size) {
      showNotification({
        type: "error",
        message: "Port conflict detected",
        description: "Resolve duplicate host ports across services before deploy.",
      });
      return;
    }
    deployStack.mutate(
      {
        name: stackName.trim(),
        compose: composeYaml,
        environment: toRecord(stackEnvRows),
        secrets: toRecord(stackSecretRows),
        configs: toRecord(stackConfigRows),
        tags: selectedTags,
      },
      {
        onSuccess: () => {
          showNotification({
            type: "success",
            message: "Compose stack deployed",
            description: stackName.trim(),
          });
          onClose?.();
        },
        onError: (error: any) =>
          showNotification({
            type: "error",
            message: "Compose deploy failed",
            description:
              error?.message || "Unable to deploy the compose stack.",
          }),
      },
    );
  };

  return (
    <>
      {embedded ? null : (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      )}
      <div
        className={
          embedded
            ? "space-y-6 animate-in fade-in duration-500 pb-20"
            : "fixed inset-0 z-50 flex items-center justify-center p-4"
        }
      >
        <div
          className={
            embedded
              ? "mx-auto flex min-h-[calc(100vh-8rem)] w-full  flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]"
              : "flex h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#121212]"
          }
        >
          <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Deploy Runtime
              </h2>
              <p className="text-sm text-zinc-500">
                Deploy a single container or a Docker Compose stack with
                form-driven YAML generation.
              </p>
            </div>
            {!embedded ? (
              <button
                onClick={close}
                className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "single" ? "bg-white shadow-sm dark:bg-[#121212]" : "text-zinc-500"}`}
              >
                Single Container
              </button>
              <button
                type="button"
                onClick={() =>
                  featureFlags.isEnabled("docker_compose_runtime", true) &&
                  setMode("compose")
                }
                disabled={
                  !featureFlags.isEnabled("docker_compose_runtime", true)
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "compose" ? "bg-white shadow-sm dark:bg-[#121212]" : "text-zinc-500"} ${!featureFlags.isEnabled("docker_compose_runtime", true) ? "cursor-not-allowed opacity-50" : ""}`}
              >
                Docker Compose
              </button>
            </div>
            {!featureFlags.isLoading &&
            !featureFlags.isEnabled("docker_compose_runtime", true) ? (
              <div className="mt-3 rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-700">
                Docker Compose runtime is disabled by feature flag. Re-enable
                `docker_compose_runtime` from Settings to deploy multi-service
                stacks here.
              </div>
            ) : null}
          </div>
          <div className="flex-1 overflow-auto p-6">
            {mode === "single" ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
                <div className="space-y-5">
                  {singlePreset ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                      <Sparkles className="h-4 w-4" />
                      Suggested config detected for {singlePreset.key}
                    </div>
                  ) : null}
                  <Tabs value={singleTab} onValueChange={setSingleTab}>
                    <TabsList>
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="storage">Storage</TabsTrigger>
                      <TabsTrigger value="network">Network</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>
                    <TabsContent value="basic" className="space-y-4">
                      <SectionCard title="Container Basics" helper="Use image-aware defaults so common images start with safer ports and names.">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Field label="Display Name">
                            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="web-api" />
                          </Field>
                          <Field label="Container Name">
                            <Input value={containerName} onChange={(event) => setContainerName(event.target.value)} placeholder={singlePreset?.defaultContainerName || "app"} />
                          </Field>
                          <div className="lg:col-span-2">
                            <Field label="Image">
                              <Input value={image} onChange={(event) => setImage(event.target.value)} placeholder="sonatype/nexus3:latest" />
                            </Field>
                          </div>
                          <Field label="Registry">
                            <select value={registryId} onChange={(event) => setRegistryId(event.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                              <option value="">
                                {selectedRegistry?.name ? `Use default (${selectedRegistry.name})` : "Use daemon / default registry"}
                              </option>
                              {registries.map((registry) => (
                                <option key={registry.id} value={registry.id}>
                                  {registry.name} ({registry.url})
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Restart Policy">
                            <select value={restartPolicy} onChange={(event) => setRestartPolicy(event.target.value as typeof restartPolicy)} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                              <option value="no">no</option>
                              <option value="always">always</option>
                              <option value="unless-stopped">unless-stopped</option>
                              <option value="on-failure">on-failure</option>
                            </select>
                          </Field>
                        </div>
                        {singlePortSuggestions.length ? (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                            Suggested ports: {singlePortSuggestions.join(", ")}
                          </div>
                        ) : null}
                        {singlePortConflicts.size ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
                            Duplicate host ports detected in this container form.
                          </div>
                        ) : null}
                        <RowEditor
                          title="Port Mappings"
                          rows={portRows}
                          onChange={setPortRows}
                          leftLabel="Host Port"
                          rightLabel="Container Port"
                          leftPlaceholder="8081"
                          rightPlaceholder="8081"
                        />
                      </SectionCard>
                    </TabsContent>
                    <TabsContent value="storage" className="space-y-4">
                      <SectionCard title="Storage" helper="Volume targets are validated against known image conventions where possible.">
                        {singleVolumeWarnings.map((warning) => (
                          <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                            {warning}
                          </div>
                        ))}
                        <VolumeEditor
                          title="Volume Mounts"
                          rows={volumeRows}
                          onChange={setVolumeRows}
                          image={image}
                        />
                      </SectionCard>
                    </TabsContent>
                    <TabsContent value="network" className="space-y-4">
                      <SectionCard title="Environment and Tags" helper="Environment values are injected directly and tags become Docker labels.">
                        {singleEnvWarnings.map((warning) => (
                          <div key={warning} className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                            {warning}
                          </div>
                        ))}
                        <RowEditor
                          title="Environment Variables"
                          rows={envRows}
                          onChange={setEnvRows}
                          leftLabel="Key"
                          rightLabel="Value"
                          leftPlaceholder="APP_ENV"
                          rightPlaceholder="production"
                          isEnv
                        />
                        <div className="mt-4">
                          <TagSelector
                            title="Runtime Tags"
                            description="Persist tags as Docker labels so they can be reused in filters, audit, and alert routing."
                            availableTags={availableTags}
                            selectedTags={selectedTags}
                            onToggleTag={(tag) =>
                              setSelectedTags((current) =>
                                current.includes(tag)
                                  ? current.filter((item) => item !== tag)
                                  : [...current, tag],
                              )
                            }
                          />
                        </div>
                      </SectionCard>
                    </TabsContent>
                    <TabsContent value="advanced" className="space-y-4">
                      <SectionCard title="Resources and Healthcheck" helper="Keep advanced settings collapsed until you need resource caps or runtime checks.">
                        <button
                          type="button"
                          onClick={() => setSingleAdvancedOpen((current) => !current)}
                          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                        >
                          {singleAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {singleAdvancedOpen ? "Hide advanced settings" : "Show advanced settings"}
                        </button>
                        {singleAdvancedOpen ? (
                          <div className="grid gap-4 lg:grid-cols-2">
                            <Field label="Memory Limit">
                              <Input value={memoryLimit} onChange={(event) => setMemoryLimit(event.target.value)} placeholder={singlePreset?.suggestedMemory || "2g"} />
                            </Field>
                            <Field label="CPU Limit">
                              <Input value={cpuLimit} onChange={(event) => setCpuLimit(event.target.value)} placeholder={singlePreset?.suggestedCpus || "1.0"} />
                            </Field>
                            <Field label="Healthcheck Command">
                              <Input value={healthcheckCommand} onChange={(event) => setHealthcheckCommand(event.target.value)} placeholder={singlePreset?.healthcheckCommand || "curl -f http://localhost || exit 1"} />
                            </Field>
                            <Field label="Healthcheck Interval">
                              <Input value={healthcheckInterval} onChange={(event) => setHealthcheckInterval(event.target.value)} placeholder="30s" />
                            </Field>
                            <Field label="Healthcheck Timeout">
                              <Input value={healthcheckTimeout} onChange={(event) => setHealthcheckTimeout(event.target.value)} placeholder="5s" />
                            </Field>
                            <Field label="Healthcheck Start Period">
                              <Input value={healthcheckStartPeriod} onChange={(event) => setHealthcheckStartPeriod(event.target.value)} placeholder="10s" />
                            </Field>
                            <Field label="Healthcheck Retries">
                              <Input value={healthcheckRetries} onChange={(event) => setHealthcheckRetries(event.target.value)} placeholder="3" />
                            </Field>
                            <div className="flex items-end">
                              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                <input type="checkbox" checked={healthcheckDisabled} onChange={(event) => setHealthcheckDisabled(event.target.checked)} />
                                Disable healthcheck
                              </label>
                            </div>
                          </div>
                        ) : null}
                      </SectionCard>
                    </TabsContent>
                  </Tabs>
                </div>
                <YamlPreviewCard
                  title="Single Container Summary"
                  warnings={[
                    ...singleEnvWarnings,
                    ...singleVolumeWarnings,
                    ...volumeRows
                      .filter((row) => row.source.trim())
                      .map((row) =>
                        isBindSource(row.source)
                          ? `Bind mount detected: ${row.source}`
                          : `Named volume detected: ${row.source}`,
                      ),
                    ...(singlePortConflicts.size ? ["Duplicate host ports detected."] : []),
                  ]}
                  yaml={buildSingleContainerYaml({
                    image,
                    name,
                    containerName,
                    restartPolicy,
                    registryId,
                    selectedRegistryName: selectedRegistry?.name,
                    envRows,
                    portRows,
                    volumeRows,
                    selectedTags,
                    memoryLimit,
                    cpuLimit,
                    healthcheckCommand,
                    healthcheckInterval,
                    healthcheckTimeout,
                    healthcheckStartPeriod,
                    healthcheckRetries,
                    healthcheckDisabled,
                  })}
                />
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                <div className="space-y-4">
                  <SectionCard title="Compose Basics" helper="Shared environment is merged into every service, and default network attach is enforced when a service has none.">
                    {swarmStatus && !swarmStatus.is_manager ? (
                      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                        This runtime is currently <span className="font-medium">{swarmStatus.local_node_state || "inactive"}</span>, not a Swarm manager. Multi-service deploy from this screen will use <span className="font-mono">docker compose up -d</span> instead of <span className="font-mono">docker stack deploy</span>.
                      </div>
                    ) : null}
                    <Field label="Stack Name">
                      <Input value={stackName} onChange={(event) => setStackName(event.target.value)} placeholder="customer-platform" />
                    </Field>
                    <div className="mt-4">
                      <TagSelector
                        title="Stack Tags"
                        description="Shared deployment metadata is copied into compose labels and audit trail entries."
                        availableTags={availableTags}
                        selectedTags={selectedTags}
                        onToggleTag={(tag) =>
                          setSelectedTags((current) =>
                            current.includes(tag)
                              ? current.filter((item) => item !== tag)
                              : [...current, tag],
                          )
                        }
                      />
                    </div>
                    <div className="mt-4">
                      <RowEditor
                        title="Shared Environment Variables"
                        rows={stackEnvRows}
                        onChange={setStackEnvRows}
                        leftLabel="Key"
                        rightLabel="Value"
                        leftPlaceholder="APP_ENV"
                        rightPlaceholder="prod"
                        isEnv
                      />
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <RowEditor
                        title="Compose Secrets"
                        rows={stackSecretRows}
                        onChange={setStackSecretRows}
                        leftLabel="Secret Name"
                        rightLabel="Secret Value"
                        leftPlaceholder="db_password"
                        rightPlaceholder="super-secret"
                        isEnv
                      />
                      <RowEditor
                        title="Compose Configs"
                        rows={stackConfigRows}
                        onChange={setStackConfigRows}
                        leftLabel="Config Name"
                        rightLabel="Config Value"
                        leftPlaceholder="app_config"
                        rightPlaceholder="key=value"
                        isEnv
                      />
                    </div>
                  </SectionCard>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <CompactNameList title="Named Volumes" items={namedVolumes} onChange={setNamedVolumes} addLabel="Add volume" placeholder="app-data" />
                    <CompactNameList title="Named Networks" items={namedNetworks} onChange={setNamedNetworks} addLabel="Add network" placeholder="app-network" includeDefaultHint />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Services</h3>
                      <p className="text-sm text-zinc-500">Expand a service only when you need to tune it.</p>
                    </div>
                    <Button variant="outline" onClick={() => setServices((current) => [...current, createService(`service-${current.length + 1}`)])}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add service
                    </Button>
                  </div>
                  {services.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      stackEnvRows={stackEnvRows}
                      availableTags={availableTags}
                      portConflicts={composePortConflicts}
                      onChange={(nextService) =>
                        setServices((current) =>
                          current.map((item) => (item.id === service.id ? nextService : item)),
                        )
                      }
                      onRemove={() =>
                        setServices((current) =>
                          current.length > 1
                            ? current.filter((item) => item.id !== service.id)
                            : current,
                        )
                      }
                      disableRemove={services.length === 1}
                    />
                  ))}
                </div>
                <YamlPreviewCard
                  title="Generated Compose YAML"
                  yaml={composeYaml}
                  warnings={[
                    ...composeWarnings,
                    ...(composePortConflicts.size
                      ? ["Duplicate host ports detected across services."]
                      : []),
                  ]}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-[#121212]">
            {!embedded ? (
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
            ) : null}
            {mode === "single" ? (
              <Button
                variant="primary"
                onClick={submitSingle}
                disabled={!image}
                isLoading={createContainer.isPending}
              >
                <Rocket className="mr-2 h-4 w-4" />
                Deploy Container
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={submitCompose}
                disabled={!stackName.trim()}
                isLoading={deployStack.isPending}
              >
                <Rocket className="mr-2 h-4 w-4" />
                Deploy Compose Stack
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CompactNameList({
  title,
  items,
  onChange,
  addLabel,
  placeholder,
  includeDefaultHint = false,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  placeholder: string;
  includeDefaultHint?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        {includeDefaultHint ? (
          <p className="text-xs text-zinc-500">
            If a service has no selected network, `default` will be attached automatically.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              value={item}
              onChange={(event) =>
                onChange(
                  items.map((entry, entryIndex) =>
                    entryIndex === index ? event.target.value : entry,
                  ),
                )
              }
              placeholder={placeholder}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                onChange(
                  items.length > 1
                    ? items.filter((_, entryIndex) => entryIndex !== index)
                    : [""],
                )
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

function VolumeEditor({
  title,
  rows,
  onChange,
  image,
}: {
  title: string;
  rows: VolumeRow[];
  onChange: (rows: VolumeRow[]) => void;
  image: string;
}) {
  const imageHints = getImageDeployPreset(image)?.volumeTargets || [];
  const bindSuggestions = [
    "./data",
    "/srv/app-data",
    "C:\\docker\\data",
  ];

  return (
    <div>
      <div className="mb-2">
        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </label>
      </div>
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
        {rows.map((row, index) => {
          const sourceValid = row.sourceType === "bind" ? isValidBindPath(row.source) : isValidNamedVolume(row.source);
          const sourceHint = row.sourceType === "bind" ? "Bind Path" : "Named Volume";
          return (
            <div key={`${title}-${index}`} className="space-y-2 rounded-xl border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-800 dark:bg-[#121212]">
              <div className="grid grid-cols-[160px_1fr_1fr_120px_auto] gap-2">
                <div>
                  {index === 0 ? <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Source Type</div> : null}
                  <select
                    value={row.sourceType}
                    onChange={(event) =>
                      onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, sourceType: event.target.value as "named" | "bind" } : item))
                    }
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                  >
                    <option value="named">Named Volume</option>
                    <option value="bind">Bind Path</option>
                  </select>
                </div>
                <div>
                  {index === 0 ? <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{sourceHint}</div> : null}
                  <Input
                    value={row.source}
                    onChange={(event) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, source: event.target.value } : item))}
                    placeholder={row.sourceType === "bind" ? "./data or /srv/app-data" : "app-data"}
                    className={row.source.trim() && !sourceValid ? "border-red-300 dark:border-red-700" : ""}
                  />
                </div>
                <div>
                  {index === 0 ? <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Target Path</div> : null}
                  <Input
                    value={row.target}
                    onChange={(event) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, target: event.target.value } : item))}
                    placeholder={imageHints[0] || "/data"}
                  />
                </div>
                <div>
                  {index === 0 ? <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Mode</div> : null}
                  <select
                    value={row.mode}
                    onChange={(event) => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, mode: event.target.value as "rw" | "ro" } : item))}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                  >
                    <option value="rw">Read/Write</option>
                    <option value="ro">Read only</option>
                  </select>
                </div>
                <div className="flex items-end gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => onChange([...rows, emptyVolume()])} title="Add row">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onChange(rows.length > 1 ? rows.filter((_, itemIndex) => itemIndex !== index) : [emptyVolume()])}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {row.sourceType === "bind"
                  ? bindSuggestions.map((suggestion) => (
                      <button
                        key={`${row.source}-${suggestion}`}
                        type="button"
                        onClick={() => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, source: suggestion, sourceType: "bind" } : item))}
                        className="rounded-full border border-zinc-200 px-2.5 py-1 text-zinc-600 hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {suggestion}
                      </button>
                    ))
                  : imageHints.map((hint) => (
                      <button
                        key={`${row.source}-${hint}`}
                        type="button"
                        onClick={() => onChange(rows.map((item, itemIndex) => itemIndex === index ? { ...item, target: hint } : item))}
                        className="rounded-full border border-zinc-200 px-2.5 py-1 text-zinc-600 hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {hint}
                      </button>
                    ))}
              </div>
              {row.source.trim() && !sourceValid ? (
                <div className="text-xs text-red-600 dark:text-red-300">
                  {row.sourceType === "bind"
                    ? "Bind path must be a valid absolute or relative filesystem path."
                    : "Named volume can only use letters, numbers, dot, underscore, and dash."}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      {children}
    </div>
  );
}

function YamlPreviewCard({
  title,
  yaml,
  warnings,
}: {
  title: string;
  yaml: string;
  warnings: string[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
      <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      {warnings.length ? (
        <div className="mb-4 space-y-2">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="inline-flex w-full items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      ) : null}
      <textarea
        value={yaml}
        onChange={() => undefined}
        readOnly
        spellCheck={false}
        className="min-h-[520px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950"
      />
    </div>
  );
}

function ServiceCard({
  service,
  stackEnvRows,
  availableTags,
  portConflicts,
  onChange,
  onRemove,
  disableRemove,
}: {
  service: ServiceDraft;
  stackEnvRows: KeyValueRow[];
  availableTags: string[];
  portConflicts: Set<string>;
  onChange: (service: ServiceDraft) => void;
  onRemove: () => void;
  disableRemove: boolean;
}) {
  const preset = getImageDeployPreset(service.image);
  const warnings = [
    ...getVolumeTargetWarnings(
      service.image,
      service.volumes.map((row) => row.target),
    ),
    ...getRequiredEnvWarnings(service.image, {
      ...toRecord(stackEnvRows),
      ...toRecord(service.env),
    }),
    ...(!service.networks.map((item) => item.trim()).filter(Boolean).length
      ? ["No network selected, default will be auto attached."]
      : []),
    ...service.volumes
      .filter((row) => row.source.trim())
      .map((row) =>
        isBindSource(row.source)
          ? `Bind mount detected: ${row.source}`
          : `Named volume detected: ${row.source}`,
      ),
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {service.name || "service"}
            {preset ? <Badge variant="success">{preset.key}</Badge> : null}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {service.image || "No image selected"} • ports {toPortList(service.ports).length} • volumes {toVolumeList(service.volumes).length}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onChange({ ...service, expanded: !service.expanded })}>
            {service.expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {service.expanded ? "Collapse" : "Expand"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} disabled={disableRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {service.expanded ? (
        <>
          {warnings.map((warning) => (
            <div key={`${service.id}-${warning}`} className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {warning}
            </div>
          ))}
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Service Name">
                  <Input value={service.name} onChange={(event) => onChange({ ...service, name: event.target.value })} placeholder="web" />
                </Field>
                <Field label="Image">
                  <Input value={service.image} onChange={(event) => onChange({ ...service, image: event.target.value })} placeholder="nginx:stable-alpine" />
                </Field>
                <Field label="Container Name">
                  <Input value={service.containerName} onChange={(event) => onChange({ ...service, containerName: event.target.value })} placeholder={preset?.defaultContainerName || "service"} />
                </Field>
                <Field label="Restart Policy">
                  <select value={service.restartPolicy} onChange={(event) => onChange({ ...service, restartPolicy: event.target.value as ServiceDraft["restartPolicy"] })} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <option value="no">no</option>
                    <option value="always">always</option>
                    <option value="unless-stopped">unless-stopped</option>
                    <option value="on-failure">on-failure</option>
                  </select>
                </Field>
              </div>
              <RowEditor
                title="Service Ports"
                rows={service.ports}
                onChange={(rows) => onChange({ ...service, ports: rows })}
                leftLabel="Host Port"
                rightLabel="Container Port"
                leftPlaceholder="8080"
                rightPlaceholder="80"
              />
              {portConflicts.size ? (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
                  Duplicate host ports detected across compose services.
                </div>
              ) : null}
            </TabsContent>
            <TabsContent value="storage" className="space-y-4">
              <VolumeEditor
                title="Service Volumes"
                rows={service.volumes}
                onChange={(rows) => onChange({ ...service, volumes: rows })}
                image={service.image}
              />
            </TabsContent>
            <TabsContent value="network" className="space-y-4">
              <RowEditor
                title="Service Environment"
                rows={service.env}
                onChange={(rows) => onChange({ ...service, env: rows })}
                leftLabel="Key"
                rightLabel="Value"
                leftPlaceholder="environment"
                rightPlaceholder="prod"
                isEnv
              />
              <CompactNameList title="Service Networks" items={service.networks} onChange={(items) => onChange({ ...service, networks: items })} addLabel="Add network" placeholder="app-network" includeDefaultHint />
              <CompactNameList title="Depends On" items={service.dependsOn.length ? service.dependsOn : [""]} onChange={(items) => onChange({ ...service, dependsOn: items })} addLabel="Add dependency" placeholder="postgres" />
              <CompactNameList title="Secret References" items={service.secretRefs.length ? service.secretRefs : [""]} onChange={(items) => onChange({ ...service, secretRefs: items })} addLabel="Add secret" placeholder="db_password" />
              <CompactNameList title="Config References" items={service.configRefs.length ? service.configRefs : [""]} onChange={(items) => onChange({ ...service, configRefs: items })} addLabel="Add config" placeholder="app_config" />
              <TagSelector
                title="Service Tags"
                description="Use service-level tags when only one compose service should receive a routing or policy label."
                availableTags={availableTags}
                selectedTags={service.tags}
                onToggleTag={(tag) =>
                  onChange({
                    ...service,
                    tags: service.tags.includes(tag)
                      ? service.tags.filter((entry) => entry !== tag)
                      : [...service.tags, tag],
                  })
                }
              />
            </TabsContent>
            <TabsContent value="advanced" className="space-y-4">
              <button type="button" onClick={() => onChange({ ...service, advancedOpen: !service.advancedOpen })} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                {service.advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {service.advancedOpen ? "Hide advanced settings" : "Show advanced settings"}
              </button>
              {service.advancedOpen ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Memory Limit">
                    <Input value={service.memoryLimit} onChange={(event) => onChange({ ...service, memoryLimit: event.target.value })} placeholder={preset?.suggestedMemory || "2g"} />
                  </Field>
                  <Field label="CPU Limit">
                    <Input value={service.cpuLimit} onChange={(event) => onChange({ ...service, cpuLimit: event.target.value })} placeholder={preset?.suggestedCpus || "1.0"} />
                  </Field>
                  <Field label="Healthcheck Command">
                    <Input value={service.healthcheckCommand} onChange={(event) => onChange({ ...service, healthcheckCommand: event.target.value })} placeholder={preset?.healthcheckCommand || "curl -f http://localhost || exit 1"} />
                  </Field>
                  <Field label="Healthcheck Interval">
                    <Input value={service.healthcheckInterval} onChange={(event) => onChange({ ...service, healthcheckInterval: event.target.value })} placeholder="30s" />
                  </Field>
                  <Field label="Healthcheck Timeout">
                    <Input value={service.healthcheckTimeout} onChange={(event) => onChange({ ...service, healthcheckTimeout: event.target.value })} placeholder="5s" />
                  </Field>
                  <Field label="Healthcheck Retries">
                    <Input value={service.healthcheckRetries} onChange={(event) => onChange({ ...service, healthcheckRetries: event.target.value })} placeholder="3" />
                  </Field>
                  <Field label="Logging Driver">
                    <Input value={service.loggingDriver} onChange={(event) => onChange({ ...service, loggingDriver: event.target.value })} placeholder="json-file" />
                  </Field>
                  <Field label="Log Max Size">
                    <Input value={service.loggingMaxSize} onChange={(event) => onChange({ ...service, loggingMaxSize: event.target.value })} placeholder="10m" />
                  </Field>
                  <Field label="Log Max File">
                    <Input value={service.loggingMaxFile} onChange={(event) => onChange({ ...service, loggingMaxFile: event.target.value })} placeholder="3" />
                  </Field>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

function TagSelector({
  title,
  description,
  availableTags,
  selectedTags,
  onToggleTag,
}: {
  title: string;
  description: string;
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {availableTags.length === 0 ? (
          <span className="text-xs text-zinc-500">
            No saved tags available yet.
          </span>
        ) : (
          availableTags.map((tag) => {
            const selected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? "border-blue-500 bg-blue-500 text-white" : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-[#121212] dark:text-zinc-300"}`}
              >
                {tag}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
