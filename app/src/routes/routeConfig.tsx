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
const ImagesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.ImagesPage })),
);
const NetworksPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.NetworksPage })),
);
const VolumesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.VolumesPage })),
);
const StacksPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.StacksPage })),
);
const TemplatesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.TemplatesPage })),
);
const CustomTemplatesPage = lazy(() =>
  import("@/features/docker").then((m) => ({ default: m.CustomTemplatesPage })),
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
  { path: "/services", element: React.createElement(ServicesPage) },
  { path: "/dashboard", element: React.createElement(DashboardPage) },
  { path: "/templates", element: React.createElement(TemplatesPage) },
  {
    path: "/templates/custom",
    element: React.createElement(CustomTemplatesPage),
  },
  { path: "/stacks", element: React.createElement(StacksPage) },
  { path: "/containers", element: React.createElement(ContainersPage) },
  { path: "/images", element: React.createElement(ImagesPage) },
  { path: "/volumes", element: React.createElement(VolumesPage) },
  { path: "/users", element: React.createElement(UsersPage) },
  { path: "/roles", element: React.createElement(RolesPage) },
  { path: "/teams", element: React.createElement(TeamsPage) },
  { path: "/networks", element: React.createElement(NetworksPage) },
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
