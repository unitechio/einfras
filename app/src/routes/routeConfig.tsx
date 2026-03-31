import { lazy } from "react";
import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import React from "react";

// Lazy load feature pages
const DashboardPage = lazy(() =>
  import("@/features/dashboard").then((m) =>
    m
      ? { default: m.DashboardPage }
      : import("@/features/dashboard/pages/DashboardPage"),
  ),
);
const UsersPage = lazy(() =>
  import("@/features/users_teams").then((m) => ({ default: m.UsersPage })),
);
const EventsPage = lazy(() =>
  import("@/features/monitoring").then((m) => ({ default: m.EventsPage })),
);
const UserProfilePage = lazy(() =>
  import("@/features/users_teams").then((m) => ({
    default: m.UserProfilePage,
  })),
);
const EnvironmentsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({
    default: m.EnvironmentsPage,
  })),
);
const RegistriesPage = lazy(() =>
  import("@/features/repositories").then((m) => ({
    default: m.RegistriesPage,
  })),
);
const AuthLogsPage = lazy(() =>
  import("@/features/monitoring").then((m) => ({ default: m.AuthLogsPage })),
);
const ActivityLogsPage = lazy(() =>
  import("@/features/monitoring").then((m) => ({
    default: m.ActivityLogsPage,
  })),
);
const GeneralSettingsPage = lazy(() =>
  import("@/features/settings").then((m) => ({
    default: m.GeneralSettingsPage,
  })),
);
const TeamsPage = lazy(() =>
  import("@/features/users_teams").then((m) => ({ default: m.TeamsPage })),
);
const RolesPage = lazy(() =>
  import("@/features/users_teams").then((m) => ({ default: m.RolesPage })),
);
const InfraDiagram = lazy(() =>
  import("@/features/servers").then((m) => ({ default: m.InfraDiagram })),
);
const AuthenticationSettingsPage = lazy(() =>
  import("@/features/settings").then((m) => ({
    default: m.AuthenticationSettingsPage,
  })),
);
const EdgeComputeSettingsPage = lazy(() =>
  import("@/features/settings").then((m) => ({
    default: m.EdgeComputeSettingsPage,
  })),
);
const FeatureFlagsSettingsPage = lazy(() =>
  import("@/features/settings").then((m) => ({
    default: m.FeatureFlagsSettingsPage,
  })),
);
const LicenseSettingsPage = lazy(() =>
  import("@/features/settings").then((m) => ({
    default: m.LicenseSettingsPage,
  })),
);
const NotificationRoutingRulesPage = lazy(() =>
  import("@/features/settings").then((m) => ({
    default: m.NotificationRoutingRulesPage,
  })),
);
const ApplicationsPage = lazy(() =>
  import("@/features/applications").then((m) => ({
    default: m.ApplicationsPage,
  })),
);
const TagsPage = lazy(() =>
  import("@/features/tags").then((m) => ({ default: m.TagsPage })),
);
const NotificationsPage = lazy(() =>
  import("@/features/notifications").then((m) => ({
    default: m.NotificationsPage,
  })),
);

// Servers Pages
const ServerOnboardingPage = lazy(
  () => import("@/features/servers/pages/ServerOnboardingPage"),
);
const ServerDeepLayout = lazy(
  () => import("@/features/servers/pages/ServerDeepLayout"),
);
const ServerDashboard = lazy(
  () => import("@/features/servers/pages/ServerDashboard"),
);
const ServerGeneralSettings = lazy(
  () => import("@/features/servers/pages/modules/system/ServerGeneralSettings"),
);
const ServerBackup = lazy(
  () => import("@/features/servers/pages/modules/storage/ServerBackup"),
);
const ServerCron = lazy(
  () => import("@/features/servers/pages/modules/system/ServerCron"),
);
const ServerFirewall = lazy(
  () => import("@/features/servers/pages/modules/network/ServerFirewall"),
);
const ServerServices = lazy(
  () => import("@/features/servers/pages/modules/system/ServerServices"),
);
const ServerCronEditorPage = lazy(
  () => import("@/features/servers/pages/modules/system/ServerCronEditorPage"),
);
const FirewallRuleEditor = lazy(
  () => import("@/features/servers/pages/modules/network/FirewallRuleEditor"),
);
const ServerMonitoring = lazy(
  () => import("@/features/servers/pages/modules/monitoring/ServerMonitoring"),
);
const ServerUsers = lazy(
  () => import("@/features/servers/pages/modules/access/ServerUsers"),
);
const ServerSSHKeys = lazy(
  () => import("@/features/servers/pages/modules/access/ServerSSHKeys"),
);
const ServerAuditLogs = lazy(
  () => import("@/features/servers/pages/modules/access/ServerAuditLogs"),
);
const ServerProcesses = lazy(
  () => import("@/features/servers/pages/modules/system/ServerProcesses"),
);
const ServerTerminal = lazy(
  () => import("@/features/servers/pages/modules/system/ServerTerminal"),
);
const ServerNetwork = lazy(
  () => import("@/features/servers/pages/modules/network/ServerNetwork"),
);
const ServerStorage = lazy(
  () => import("@/features/servers/pages/modules/storage/ServerStorage"),
);
const ServerPackages = lazy(
  () => import("@/features/servers/pages/modules/system/ServerPackages"),
);
const LoadingPage = lazy(() => import("@/pages/LoadingPage"));

// FSD Top-level Features
const ServersPage = lazy(() =>
  import("@/features/servers").then((m) => ({ default: m.ServersPage })),
);
const ContainersPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.ContainersPage })),
);
const DeployContainerPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.DeployContainerPage })),
);
const ContainerDetailPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.ContainerDetailPage })),
);
const EditContainerPage = lazy(() =>
  import("@/features/docker/pages/EditContainerPage").then((m) => ({ default: m.default })),
);
const ImagesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.ImagesPage })),
);
const NetworksPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.NetworksPage })),
);
const NetworkDetailPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.NetworkDetailPage })),
);
const VolumesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.VolumesPage })),
);
const DiskUsagePage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.DiskUsagePage })),
);
const VolumeDetailPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.VolumeDetailPage })),
);
const ServiceDetailPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.ServiceDetailPage })),
);
const StacksPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.StacksPage })),
);
const StackEditorPage = lazy(() =>
  import("@/features/docker/pages/StackEditorPage").then((m) => ({ default: m.default })),
);
const LogsPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.LogsPage })),
);
const TopologyPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.TopologyPage })),
);
const AutoHealPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.AutoHealPage })),
);
const TemplatesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.TemplatesPage })),
);
const CustomTemplatesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.CustomTemplatesPage })),
);
const CustomTemplateEditorPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.CustomTemplateEditorPage })),
);
const CustomTemplateSettingsPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.CustomTemplateSettingsPage })),
);
const BuildArtifactsPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.BuildArtifactsPage })),
);
const KubernetesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.KubernetesPage })),
);
const PodsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.PodsPage })),
);
const DeploymentsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.DeploymentsPage })),
);
const ServicesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.ServicesPage })),
);
const IngressesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.IngressesPage })),
);
const ConfigMapsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.ConfigMapsPage })),
);
const ConfigMapDetailPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.ConfigMapDetailPage })),
);
const SecretsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.SecretsPage })),
);
const NodesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.NodesPage })),
);
const PersistentVolumesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.PersistentVolumesPage })),
);
const JobsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.JobsPage })),
);
const HelmReleasesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.HelmReleasesPage })),
);
const NamespacesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.NamespacesPage })),
);
const StatefulSetsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.StatefulSetsPage })),
);
const DaemonSetsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.DaemonSetsPage })),
);
const ReplicaSetsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.ReplicaSetsPage })),
);
const NetworkPoliciesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.NetworkPoliciesPage })),
);
const StorageClassesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.StorageClassesPage })),
);
const ServiceAccountsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.ServiceAccountsPage })),
);
const RolesK8sPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.RolesPage })),
);
const RoleBindingsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.RoleBindingsPage })),
);
const ClusterRolesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.ClusterRolesPage })),
);
const ClusterRoleBindingsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.ClusterRoleBindingsPage })),
);
const HPAPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.HPAPage })),
);
const VPAPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.VPAPage })),
);
const CRDsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.CRDsPage })),
);
const EndpointsPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.EndpointsPage })),
);
const EndpointSlicesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.EndpointSlicesPage })),
);
const IngressClassesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.IngressClassesPage })),
);
const GatewaysPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.GatewaysPage })),
);
const GatewayClassesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.GatewayClassesPage })),
);
const HTTPRoutesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.HTTPRoutesPage })),
);
const KubernetesTopologyPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.TopologyPage })),
);
const K8sSearchPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.SearchPage })),
);
const CustomResourceInstancesPage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.CustomResourceInstancesPage })),
);
const K8sCreateResourcePage = lazy(() =>
  import("@/features/kubernetes").then((m) => ({ default: m.K8sCreateResourcePage })),
);
const RepositoriesPage = lazy(() =>
  import("@/features/repositories").then((m) => ({
    default: m.RepositoriesPage,
  })),
);
const MonitoringPage = lazy(() =>
  import("@/features/monitoring").then((m) => ({ default: m.MonitoringPage })),
);

export const routes: RouteObject[] = [
  {
    path: "/diagram",
    element: React.createElement(InfraDiagram),
  },
  {
    path: "/",
    element: React.createElement(Navigate, { to: "/dashboard", replace: true }),
  },

  // -- Extracted Feature Modules --
  { path: "/servers", element: React.createElement(ServersPage) },
  { path: "/kubernetes", element: React.createElement(KubernetesPage) },
  { path: "/repositories", element: React.createElement(RepositoriesPage) },
  { path: "/monitoring", element: React.createElement(MonitoringPage) },

  {
    path: "/servers/add",
    element: React.createElement(ServerOnboardingPage),
  },
  {
    path: "/servers/:serverId",
    element: React.createElement(ServerDeepLayout),
    children: [
      {
        path: "",
        element: React.createElement(Navigate, {
          to: "overview",
          replace: true,
        }),
      },
      { path: "overview", element: React.createElement(ServerDashboard) },
      {
        path: "dashboard",
        element: React.createElement(Navigate, {
          to: "overview",
          replace: true,
        }),
      },

      // System
      {
        path: "system/info",
        element: React.createElement(ServerGeneralSettings),
      },
      {
        path: "system/monitoring",
        element: React.createElement(ServerMonitoring),
      },
      {
        path: "system/processes",
        element: React.createElement(ServerProcesses),
      },
      {
        path: "system/terminal",
        element: React.createElement(ServerTerminal),
      },

      // Access
      { path: "access/users", element: React.createElement(ServerUsers) },
      { path: "access/ssh-keys", element: React.createElement(ServerSSHKeys) },
      {
        path: "access/audit-logs",
        element: React.createElement(ServerAuditLogs),
      },

      // Others
      { path: "network", element: React.createElement(ServerNetwork) },
      { path: "firewall", element: React.createElement(ServerFirewall) },
      {
        path: "firewall/new",
        element: React.createElement(FirewallRuleEditor),
      },
      {
        path: "firewall/:ruleId/edit",
        element: React.createElement(FirewallRuleEditor),
      },
      { path: "services", element: React.createElement(ServerServices) },
      { path: "cron", element: React.createElement(ServerCron) },
      { path: "cron/new", element: React.createElement(ServerCronEditorPage) },
      {
        path: "cron/:jobId/edit",
        element: React.createElement(ServerCronEditorPage),
      },
      { path: "backup", element: React.createElement(ServerBackup) },
      { path: "storage", element: React.createElement(ServerStorage) },
      { path: "packages", element: React.createElement(ServerPackages) },
    ],
  },
  { path: "/environments", element: React.createElement(EnvironmentsPage) }, // Old route, could redirect
  { path: "/pods", element: React.createElement(PodsPage) },
  { path: "/deployments", element: React.createElement(DeploymentsPage) },
  { path: "/statefulsets", element: React.createElement(StatefulSetsPage) },
  { path: "/daemonsets", element: React.createElement(DaemonSetsPage) },
  { path: "/replicasets", element: React.createElement(ReplicaSetsPage) },
  { path: "/services", element: React.createElement(ServicesPage) },
  { path: "/endpoints", element: React.createElement(EndpointsPage) },
  { path: "/endpointslices", element: React.createElement(EndpointSlicesPage) },
  { path: "/ingresses", element: React.createElement(IngressesPage) },
  { path: "/ingressclasses", element: React.createElement(IngressClassesPage) },
  { path: "/networkpolicies", element: React.createElement(NetworkPoliciesPage) },
  { path: "/gateways", element: React.createElement(GatewaysPage) },
  { path: "/gatewayclasses", element: React.createElement(GatewayClassesPage) },
  { path: "/httproutes", element: React.createElement(HTTPRoutesPage) },
  { path: "/configmaps", element: React.createElement(ConfigMapsPage) },
  { path: "/configmaps/:namespace/:name", element: React.createElement(ConfigMapDetailPage) },
  { path: "/secrets", element: React.createElement(SecretsPage) },
  { path: "/serviceaccounts", element: React.createElement(ServiceAccountsPage) },
  { path: "/roles-k8s", element: React.createElement(RolesK8sPage) },
  { path: "/rolebindings", element: React.createElement(RoleBindingsPage) },
  { path: "/clusterroles", element: React.createElement(ClusterRolesPage) },
  { path: "/clusterrolebindings", element: React.createElement(ClusterRoleBindingsPage) },
  { path: "/nodes", element: React.createElement(NodesPage) },
  { path: "/persistent-volumes", element: React.createElement(PersistentVolumesPage) },
  { path: "/storageclasses", element: React.createElement(StorageClassesPage) },
  { path: "/jobs", element: React.createElement(JobsPage) },
  { path: "/hpa", element: React.createElement(HPAPage) },
  { path: "/vpa", element: React.createElement(VPAPage) },
  { path: "/crds", element: React.createElement(CRDsPage) },
  { path: "/kubernetes-search", element: React.createElement(K8sSearchPage) },
  { path: "/custom-resources", element: React.createElement(CustomResourceInstancesPage) },
  { path: "/resources/:resourceType/create", element: React.createElement(K8sCreateResourcePage) },
  { path: "/kubernetes-topology", element: React.createElement(KubernetesTopologyPage) },
  { path: "/helm", element: React.createElement(HelmReleasesPage) },
  { path: "/namespaces", element: React.createElement(NamespacesPage) },
  { path: "/dashboard", element: React.createElement(DashboardPage) },
  { path: "/templates", element: React.createElement(TemplatesPage) },
  {
    path: "/templates/custom",
    element: React.createElement(CustomTemplatesPage),
  },
  { path: "/templates/custom/new/edit", element: React.createElement(CustomTemplateEditorPage) },
  { path: "/templates/custom/:templateId/edit", element: React.createElement(CustomTemplateEditorPage) },
  { path: "/templates/custom/:templateId/settings", element: React.createElement(CustomTemplateSettingsPage) },
  { path: "/stacks", element: React.createElement(StacksPage) },
  { path: "/stacks/new", element: React.createElement(StackEditorPage) },
  { path: "/stacks/:stackName/edit", element: React.createElement(StackEditorPage) },
  { path: "/stacks/:stackName/services/:serviceName", element: React.createElement(ServiceDetailPage) },
  { path: "/containers", element: React.createElement(ContainersPage) },
  { path: "/containers/deploy", element: React.createElement(DeployContainerPage) },
  { path: "/containers/:containerId", element: React.createElement(ContainerDetailPage) },
  { path: "/containers/:containerId/edit", element: React.createElement(EditContainerPage) },
  { path: "/images", element: React.createElement(ImagesPage) },
  { path: "/images/build", element: React.createElement(BuildArtifactsPage) },
  { path: "/logs", element: React.createElement(LogsPage) },
  { path: "/topology", element: React.createElement(TopologyPage) },
  { path: "/auto-heal", element: React.createElement(AutoHealPage) },
  { path: "/volumes", element: React.createElement(VolumesPage) },
  { path: "/disk-usage", element: React.createElement(DiskUsagePage) },
  { path: "/volumes/:volumeName", element: React.createElement(VolumeDetailPage) },
  { path: "/users", element: React.createElement(UsersPage) },
  { path: "/roles", element: React.createElement(RolesPage) },
  { path: "/teams", element: React.createElement(TeamsPage) },
  { path: "/networks", element: React.createElement(NetworksPage) },
  { path: "/networks/:networkId", element: React.createElement(NetworkDetailPage) },
  { path: "/registries", element: React.createElement(RegistriesPage) },
  { path: "/events", element: React.createElement(EventsPage) },
  {
    path: "/settings",
    element: React.createElement(Navigate, {
      to: "/settings/general",
      replace: true,
    }),
  },
  {
    path: "/settings/general",
    element: React.createElement(GeneralSettingsPage),
  },
  {
    path: "/settings/authentication",
    element: React.createElement(AuthenticationSettingsPage),
  },
  {
    path: "/settings/edge-compute",
    element: React.createElement(EdgeComputeSettingsPage),
  },
  {
    path: "/settings/feature-flags",
    element: React.createElement(FeatureFlagsSettingsPage),
  },
  {
    path: "/settings/license",
    element: React.createElement(LicenseSettingsPage),
  },
  {
    path: "/settings/notification-routing",
    element: React.createElement(NotificationRoutingRulesPage),
  },
  { path: "/applications", element: React.createElement(ApplicationsPage) },
  { path: "/tags", element: React.createElement(TagsPage) },
  { path: "/notifications", element: React.createElement(NotificationsPage) },
  { path: "/profile", element: React.createElement(UserProfilePage) },
  { path: "/loading", element: React.createElement(LoadingPage) },
  { path: "/logs/auth", element: React.createElement(AuthLogsPage) },
  { path: "/logs/activity", element: React.createElement(ActivityLogsPage) },
  {
    path: "*",
    element: React.createElement(Navigate, { to: "/", replace: true }),
  },
];


