import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Cloud,
  Server,
  Cuboid,
  Settings,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Activity,
  Layers,
  Database,
  Box,
  FileCode,
  HardDrive,
  Share2,
  Monitor,
  Globe,
  Boxes,
  HeartPulse,
  ChevronDown,
  Tag,
  X,
} from "lucide-react";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useGenericKubernetesResources } from "@/features/kubernetes/api/useKubernetesHooks";
import { useRuntimeFeatureFlags } from "@/features/settings/useRuntimeFeatureFlags";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MenuItem {
  icon?: any;
  label: string;
  path?: string;
  items?: MenuItem[];
  type?: "header";
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { selectedEnvironment, setSelectedEnvironment, isEnvironmentMode } =
    useEnvironment();
  const [expanded, setExpanded] = useState<Record<number, string>>({});
  const featureFlags = useRuntimeFeatureFlags();
  const { data: dynamicCRDs = [] } = useGenericKubernetesResources(
    selectedEnvironment?.type === "kubernetes" ? selectedEnvironment.id : "",
    "customresourcedefinitions",
    "default",
    false,
    {
      enabled: selectedEnvironment?.type === "kubernetes",
      watch: true,
    },
  );

  const toggle = (key: string, depth: number) => {
    setExpanded((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([level]) => Number(level) < depth),
      ) as Record<number, string>;
      if (prev[depth] !== key) {
        next[depth] = key;
      }
      return next;
    });
  };

  const adminMenu: MenuItem[] = [
    { type: "header", label: "Administration" },
    {
      icon: Users,
      label: "Users",
      items: [
        { label: "Users", path: "/users" },
        { label: "Teams", path: "/teams" },
        { label: "Roles", path: "/roles" },
      ],
    },
    {
      icon: Layers,
      label: "Infrastructure",
      items: [
        { icon: Cloud, label: "Environments", path: "/environments" },
        { icon: Server, label: "Servers", path: "/servers" },
        { icon: Cuboid, label: "Applications", path: "/applications" },
        { icon: Tag, label: "Tags", path: "/tags" },
      ],
    },
    { icon: Database, label: "Registries", path: "/registries" },
    {
      icon: Activity,
      label: "Logs",
      items: [
        { label: "Auth Logs", path: "/logs/auth" },
        { label: "Activity Logs", path: "/logs/activity" },
      ],
    },
    {
      icon: Settings,
      label: "Settings",
      items: [
        { label: "General", path: "/settings/general" },
        { label: "Authentication", path: "/settings/authentication" },
        ...(featureFlags.isEnabled("edge_compute", true)
          ? [{ label: "Edge Compute", path: "/settings/edge-compute" }]
          : []),
        ...(featureFlags.isEnabled("notification_routing", true)
          ? [
              {
                label: "Notification Routing",
                path: "/settings/notification-routing",
              },
            ]
          : []),
        { label: "Feature Flags", path: "/settings/feature-flags" },
        ...(featureFlags.isEnabled("license_management", true)
          ? [{ label: "License Keys", path: "/settings/license" }]
          : []),
      ],
    },
  ];

  const envMenu: MenuItem[] =
    selectedEnvironment?.type === "kubernetes"
      ? [
          { icon: Home, label: "Dashboard", path: "/dashboard" },
          {
            icon: Layers,
            label: "Workloads",
            items: [
              { icon: Cuboid, label: "Pods", path: "/pods" },
              { icon: Layers, label: "Deployments", path: "/deployments" },
              { icon: Layers, label: "StatefulSets", path: "/statefulsets" },
              { icon: Layers, label: "DaemonSets", path: "/daemonsets" },
              { icon: Layers, label: "ReplicaSets", path: "/replicasets" },
              { icon: Activity, label: "Jobs", path: "/jobs" },
              { icon: Activity, label: "CronJobs", path: "/jobs?tab=cronjobs" },
            ],
          },
          {
            icon: Share2,
            label: "Network",
            items: [
              { icon: Share2, label: "Services", path: "/services" },
              { icon: Share2, label: "Endpoints", path: "/endpoints" },
              {
                icon: Share2,
                label: "EndpointSlices",
                path: "/endpointslices",
              },
              { icon: Globe, label: "Ingresses", path: "/ingresses" },
              { icon: Globe, label: "IngressClasses", path: "/ingressclasses" },
              { icon: Globe, label: "Gateways", path: "/gateways" },
              { icon: Globe, label: "GatewayClasses", path: "/gatewayclasses" },
              { icon: Globe, label: "HTTPRoutes", path: "/httproutes" },
              {
                icon: Shield,
                label: "NetworkPolicies",
                path: "/networkpolicies",
              },
            ],
          },
          {
            icon: Database,
            label: "Configuration",
            items: [
              { icon: Database, label: "ConfigMaps", path: "/configmaps" },
              { icon: Shield, label: "Secrets", path: "/secrets" },
              {
                icon: Database,
                label: "StorageClasses",
                path: "/storageclasses",
              },
            ],
          },
          {
            icon: Shield,
            label: "RBAC",
            items: [
              {
                icon: Shield,
                label: "ServiceAccounts",
                path: "/serviceaccounts",
              },
              { icon: Shield, label: "Roles", path: "/roles-k8s" },
              { icon: Shield, label: "RoleBindings", path: "/rolebindings" },
              { icon: Shield, label: "Cluster Roles", path: "/clusterroles" },
              {
                icon: Shield,
                label: "Cluster Role Bindings",
                path: "/clusterrolebindings",
              },
            ],
          },
          {
            icon: Server,
            label: "Cluster",
            items: [
              { icon: HardDrive, label: "Nodes", path: "/nodes" },
              { icon: Layers, label: "Namespaces", path: "/namespaces" },
              { icon: Activity, label: "Search", path: "/kubernetes-search" },
              { icon: Database, label: "Storage", path: "/persistent-volumes" },
              { icon: Activity, label: "Autoscaling", path: "/hpa" },
              { icon: Activity, label: "VPA", path: "/vpa" },
              { icon: Database, label: "CRDs", path: "/crds" },
              ...buildDynamicCRDMenus(dynamicCRDs),
              { icon: Globe, label: "Topology", path: "/kubernetes-topology" },
              { icon: Box, label: "Helm", path: "/helm" },
              { icon: Activity, label: "Events", path: "/events" },
              { icon: Cloud, label: "Environments", path: "/environments" },
            ],
          },
        ]
      : [
          { icon: Home, label: "Dashboard", path: "/dashboard" },
          {
            icon: FileCode,
            label: "Templates",
            items: [
              { label: "App Templates", path: "/templates" },
              { label: "Custom Templates", path: "/templates/custom" },
            ],
          },
          { icon: Layers, label: "Stacks", path: "/stacks" },
          { icon: Box, label: "Containers", path: "/containers" },
          { icon: Server, label: "Nodes", path: "/nodes" },
          { icon: Activity, label: "Logs", path: "/logs" },
          ...(featureFlags.isEnabled("runtime_topology", true)
            ? [{ icon: Boxes, label: "Topology", path: "/topology" }]
            : []),
          { icon: HeartPulse, label: "Auto-Heal", path: "/auto-heal" },
          { icon: Monitor, label: "Images", path: "/images" },
          { icon: Box, label: "Build & Import", path: "/images/build" },
          { icon: Share2, label: "Networks", path: "/networks" },
          { icon: HardDrive, label: "Volumes", path: "/volumes" },
          { icon: Globe, label: "Events", path: "/events" },
        ];

  const menu = isEnvironmentMode ? envMenu : adminMenu;

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-300",
        "bg-white/70 dark:bg-[#0f1115]/80 backdrop-blur-xl",
        "border-r border-zinc-200/50 dark:border-white/5",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* HEADER */}
      <div className="h-14 px-4 flex items-center justify-between">
        {!collapsed && (
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">
              EINFRA
            </span>
          </NavLink>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ENV BAR */}
      {isEnvironmentMode && !collapsed && (
        <div className="px-4 py-2 text-xs text-blue-500 flex justify-between items-center">
          {selectedEnvironment?.name}
          <X
            size={14}
            className="cursor-pointer"
            onClick={() => setSelectedEnvironment(null)}
          />
        </div>
      )}

      {/* NAV */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {menu.map((item, idx) => (
          <NavItem
            key={idx}
            item={item}
            collapsed={collapsed}
            expandedKeys={expanded}
            onToggle={toggle}
            itemKey={item.label}
            depth={0}
          />
        ))}
      </nav>

      {/* FOOTER */}
      <div className="p-3 border-t border-zinc-200/50 dark:border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
            AD
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                Admin
              </div>
              <div className="text-xs text-zinc-400">admin@einfra.io</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  item,
  collapsed,
  expandedKeys,
  onToggle,
  itemKey,
  depth = 0,
}: any) {
  if (item.type === "header") {
    return !collapsed ? (
      <div className="px-3 pt-4 pb-2 text-xs text-zinc-400 uppercase">
        {item.label}
      </div>
    ) : null;
  }

  const Icon = item.icon;
  const hasChildren = item.items;
  const expanded = expandedKeys?.[depth] === itemKey;

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path || "#"}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition",
            isActive
              ? "bg-blue-500/10 text-blue-600 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
            "hover:bg-zinc-100/60 dark:hover:bg-white/5",
            collapsed && "justify-center",
          )
        }
      >
        {Icon && <Icon size={16} />}
        {!collapsed && (
          <span className="min-w-0 flex-1 break-words text-left text-sm leading-snug">
            {item.label}
          </span>
        )}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => onToggle(itemKey, depth)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2.5 rounded-xl",
          "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
          "hover:bg-zinc-100/60 dark:hover:bg-white/5",
          collapsed && "justify-center",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {Icon && <Icon size={16} />}
          {!collapsed && (
            <span className="min-w-0 flex-1 break-words text-left text-sm leading-snug">
              {item.label}
            </span>
          )}
        </div>

        {!collapsed && (
          <ChevronDown
            size={14}
            className={cn("transition", expanded && "rotate-180")}
          />
        )}
      </button>

      {!collapsed && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            depth === 0 ? "pl-9" : "pl-4",
            expanded
              ? "max-h-[70vh] overflow-y-auto opacity-100"
              : "max-h-0 opacity-0",
          )}
        >
          {item.items.map((sub: any, i: number) => (
            <NavItem
              key={`${sub.label}-${i}`}
              item={sub}
              collapsed={false}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              itemKey={`${itemKey}/${sub.label}`}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildDynamicCRDMenus(
  resources: Array<{
    name?: string;
    group?: string;
    version?: string;
    plural?: string;
    resource_kind?: string;
    scope?: string;
  }>,
): MenuItem[] {
  if (!resources.length) {
    return [];
  }

  const groups = new Map<string, MenuItem[]>();
  resources.forEach((resource: any) => {
    const group = resource.group || resource.detail || "Custom Resources";
    const namespaced = String(resource.scope || "").toLowerCase() !== "cluster";
    const params = new URLSearchParams({
      kind: resource.plural || resource.name || "",
      title:
        resource.resource_kind ||
        resource.plural ||
        resource.name ||
        "Custom Resource",
      namespaced: namespaced ? "true" : "false",
      resourceKind: resource.resource_kind || "",
      apiVersion:
        resource.group && resource.version
          ? `${resource.group}/${resource.version}`
          : resource.group || "",
    });
    const items = groups.get(group) || [];
    items.push({
      label:
        resource.resource_kind ||
        resource.plural ||
        resource.name ||
        "Resource",
      path: `/custom-resources?${params.toString()}`,
    });
    groups.set(group, items);
  });

  return [
    {
      icon: Database,
      label: "Custom Resources",
      items: Array.from(groups.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([group, items]) => ({
          label: group,
          items: items.sort((left, right) =>
            left.label.localeCompare(right.label),
          ),
        })),
    },
  ];
}
