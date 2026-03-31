import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Code,
  LayoutTemplate,
  Play,
  Search,
  Server,
} from "lucide-react";

import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";
import { useCreateContainer } from "../api/useDockerHooks";
import { useEnvironment } from "@/core/EnvironmentContext";
import { buildRequiredRuntimeEnv } from "../runtime-image-presets";

type TemplateItem = {
  title: string;
  image: string;
  description: string;
  logo: string;
  stack: string;
};

const APP_TEMPLATES: TemplateItem[] = [
  {
    title: "NGINX",
    image: "nginx:stable-alpine",
    description:
      "Lightweight reverse proxy and static web server for frontends and API edges.",
    logo: "https://hub.docker.com/api/content/v1/products/images/nginx/icon",
    stack: "Edge delivery",
  },
  {
    title: "Traefik",
    image: "traefik:v3.1",
    description:
      "Dynamic ingress proxy with Docker-native service discovery and dashboard support.",
    logo: "https://doc.traefik.io/traefik/assets/img/traefik.logo.png",
    stack: "Ingress",
  },
  {
    title: "Caddy",
    image: "caddy:2-alpine",
    description:
      "Modern web server with automatic HTTPS and clean app delivery defaults.",
    logo: "https://caddyserver.com/resources/images/caddy-logo.svg",
    stack: "Edge delivery",
  },
  {
    title: "WordPress",
    image: "wordpress:latest",
    description:
      "Content management system for blogs, landing pages, and internal publishing portals.",
    logo: "https://hub.docker.com/api/content/v1/products/images/wordpress/icon",
    stack: "Content platform",
  },
  {
    title: "Ghost",
    image: "ghost:5-alpine",
    description:
      "Modern publishing platform for teams shipping product docs and editorial content.",
    logo: "https://ghost.org/images/logos/ghost-logo-orb.png",
    stack: "Content platform",
  },
  {
    title: "Node.js",
    image: "node:20-alpine",
    description:
      "Application runtime for JavaScript services, workers, and API backends.",
    logo: "https://hub.docker.com/api/content/v1/products/images/node/icon",
    stack: "App runtime",
  },
  {
    title: "Python",
    image: "python:3.12-alpine",
    description:
      "General-purpose runtime for automation, APIs, and data-processing workloads.",
    logo: "https://www.python.org/static/community_logos/python-logo.png",
    stack: "App runtime",
  },
  {
    title: "PostgreSQL",
    image: "postgres:16",
    description:
      "Relational database for production applications, analytics, and transactional workloads.",
    logo: "https://hub.docker.com/api/content/v1/products/images/postgres/icon",
    stack: "Primary database",
  },
  {
    title: "MariaDB",
    image: "mariadb:11",
    description:
      "Drop-in MySQL-compatible database engine for app stacks and legacy workloads.",
    logo: "https://hub.docker.com/api/content/v1/products/images/mariadb/icon",
    stack: "Primary database",
  },
  {
    title: "MongoDB",
    image: "mongo:7",
    description:
      "Document database suited for flexible application schemas and event-heavy services.",
    logo: "https://www.mongodb.com/assets/images/global/leaf.png",
    stack: "Document database",
  },
  {
    title: "Redis",
    image: "redis:7-alpine",
    description:
      "High-performance in-memory cache, queue, and session store for distributed systems.",
    logo: "https://hub.docker.com/api/content/v1/products/images/redis/icon",
    stack: "Caching layer",
  },
  {
    title: "Memcached",
    image: "memcached:1.6-alpine",
    description:
      "Simple distributed memory cache for low-latency response acceleration.",
    logo: "https://hub.docker.com/api/content/v1/products/images/memcached/icon",
    stack: "Caching layer",
  },
  {
    title: "RabbitMQ",
    image: "rabbitmq:3-management",
    description:
      "Reliable messaging broker with management UI for queue-based workloads.",
    logo: "https://www.rabbitmq.com/img/rabbitmq-logo.svg",
    stack: "Messaging",
  },
  {
    title: "Kafka UI",
    image: "provectuslabs/kafka-ui:latest",
    description:
      "Operations UI for Kafka clusters, topics, consumer groups, and broker insight.",
    logo: "https://raw.githubusercontent.com/provectus/kafka-ui/master/documentation/images/kafka-ui-logo.svg",
    stack: "Messaging ops",
  },
  {
    title: "Grafana",
    image: "grafana/grafana:latest",
    description:
      "Observability dashboards for metrics, logs, tracing, and runtime health views.",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Grafana_logo.svg",
    stack: "Observability",
  },
  {
    title: "Prometheus",
    image: "prom/prometheus:latest",
    description:
      "Metrics collection and alerting engine for platform and application monitoring.",
    logo: "https://prometheus.io/assets/prometheus_logo_grey.svg",
    stack: "Observability",
  },
  {
    title: "Loki",
    image: "grafana/loki:latest",
    description:
      "Horizontal-friendly log backend built to pair with Grafana observability stacks.",
    logo: "https://grafana.com/static/assets/img/logos/logo-loki.svg",
    stack: "Log platform",
  },
  {
    title: "MinIO",
    image: "minio/minio:latest",
    description:
      "S3-compatible object storage for backups, artifacts, and media workloads.",
    logo: "https://min.io/resources/img/logo/MINIO_Bird.png",
    stack: "Object storage",
  },
  {
    title: "Vault",
    image: "hashicorp/vault:latest",
    description:
      "Secrets management platform for dynamic credentials, tokens, and policy control.",
    logo: "https://www.datocms-assets.com/2885/1620155117-brandvaultprimaryattributedcolor.svg",
    stack: "Secrets security",
  },
  {
    title: "Keycloak",
    image: "quay.io/keycloak/keycloak:25.0",
    description:
      "Identity and access management server for SSO, OAuth2, and user federation.",
    logo: "https://www.keycloak.org/resources/images/keycloak_logo_200px.svg",
    stack: "Identity",
  },
  {
    title: "Portainer Agent",
    image: "portainer/agent:latest",
    description:
      "Agent-based remote runtime operations for multi-host Docker management.",
    logo: "https://www.portainer.io/hubfs/Brand/Portainer%20Logo%20Blue.svg",
    stack: "Runtime ops",
  },
  {
    title: "Gitea",
    image: "gitea/gitea:latest",
    description:
      "Self-hosted Git service for internal repositories, review, and lightweight CI workflows.",
    logo: "https://about.gitea.com/images/gitea.png",
    stack: "Developer platform",
  },
  {
    title: "Jenkins",
    image: "jenkins/jenkins:lts",
    description:
      "Automation server for CI/CD orchestration and plugin-based build pipelines.",
    logo: "https://www.jenkins.io/images/logos/jenkins/jenkins.svg",
    stack: "Delivery automation",
  },
];

const fallbackLogo =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYTFBMTBhIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJjbGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=";

const PAGE_SIZE = 9;

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { data: inventory = [], isLoading: isLoadingServers } =
    useEnvironmentInventory();
  const { selectedEnvironment } = useEnvironment();
  const servers = inventory.filter((env) => env.type === "docker");

  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deployingTemplateTitle, setDeployingTemplateTitle] = useState("");
  const createContainer = useCreateContainer(selectedServerId);
  const { showNotification } = useNotification();

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
  }, [selectedEnvironment, selectedServerId, servers]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return APP_TEMPLATES;
    return APP_TEMPLATES.filter((template) =>
      [template.title, template.description, template.image, template.stack]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTemplates.length / PAGE_SIZE),
  );
  const pagedTemplates = filteredTemplates.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const deployTemplate = (template: TemplateItem) => {
    if (!selectedServerId) {
      showNotification({
        type: "warning",
        message: "Select a Docker environment",
        description: `Choose where to deploy ${template.title} before continuing.`,
      });
      return;
    }

    const presetEnv = buildRequiredRuntimeEnv(template.image);
    setDeployingTemplateTitle(template.title);
    createContainer.mutate(
      {
        name: `${template.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`,
        image: template.image,
        environment: presetEnv.environment,
        auto_start: true,
        restart_policy: "unless-stopped",
      },
      {
        onSuccess: (result) => {
          setDeployingTemplateTitle("");
          showNotification({
            type: "success",
            message: "Application deployed",
            description:
              presetEnv.autofilled.length > 0
                ? `${template.title} deployed as ${result.container_id}. Auto-filled: ${presetEnv.autofilled.join(", ")}`
                : `${template.title} deployed as ${result.container_id}`,
          });
        },
        onError: (error: any) => {
          setDeployingTemplateTitle("");
          showNotification({
            type: "error",
            message: "Deploy failed",
            description: error?.message || `Unable to deploy ${template.title}`,
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="rounded-md border border-zinc-200 bg-white/95 p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              <LayoutTemplate className="h-6 w-6 text-indigo-500" />
              App Templates
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Launch common application stacks faster, then jump into advanced
              deploy when you need more control.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[460px]">
            <div className="relative">
              <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                disabled={isLoadingServers}
                className="h-11 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-zinc-200 bg-white pl-9 pr-8 text-[13px] font-medium text-zinc-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
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

            <Button
              variant="primary"
              size="md"
              className="h-11"
              onClick={() => navigate("/templates/custom")}
            >
              <Code className="mr-2 h-4 w-4" />
              Custom Templates
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <Input
              type="text"
              placeholder="Search templates, images, stacks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4 text-zinc-400" />}
            />
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            Showing{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {pagedTemplates.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {filteredTemplates.length}
            </span>{" "}
            templates
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pagedTemplates.map((template) => (
          <div
            key={template.title}
            className="group flex h-full flex-col rounded-md border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-indigo-700/50"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/40">
                <img
                  src={template.logo}
                  alt={template.title}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = fallbackLogo;
                  }}
                />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {template.title}
                </h3>
                <div className="mt-1 truncate text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {template.stack}
                </div>
              </div>
            </div>

            <p className="line-clamp-3 flex-grow text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {template.description}
            </p>

            <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
              <span className="block truncate" title={template.image}>
                {template.image}
              </span>
            </div>

            <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
              <Button
                variant="outline"
                className="w-full transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:border-indigo-500/30 dark:group-hover:bg-indigo-500/10 dark:group-hover:text-indigo-400"
                onClick={() => deployTemplate(template)}
                disabled={createContainer.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {createContainer.isPending &&
                deployingTemplateTitle === template.title
                  ? "Deploying..."
                  : "Deploy Application"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() =>
                  navigate(
                    `/containers/deploy?image=${encodeURIComponent(template.image)}&environmentId=${encodeURIComponent(selectedServerId)}`,
                  )
                }
              >
                <ArrowUpRight className="mr-2 h-3.5 w-3.5" />
                Open advanced deploy form
              </Button>
            </div>
          </div>
        ))}

        {pagedTemplates.length === 0 ? (
          <div className="col-span-full flex h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <LayoutTemplate className="mb-3 h-8 w-8 text-zinc-400 dark:text-zinc-600" />
            <h3 className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              No templates found
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Try another search term.
            </p>
          </div>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <div className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            Page{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {page}
            </span>{" "}
            / {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
