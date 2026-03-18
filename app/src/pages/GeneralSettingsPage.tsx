"use client";

import { useState } from "react";
import {
  Settings as SettingsIcon,
  RefreshCw,
  Info,
  AlertTriangle,
  Upload,
  Download,
  Briefcase,
  Shield,
  Lock,
  Key,
  Database,
  Cloud,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";

export default function GeneralSettingsPage() {
  const { showNotification } = useNotification();

  // Application Settings State
  const [snapshotInterval, setSnapshotInterval] = useState("5m");
  const [pollFrequency, setPollFrequency] = useState("5 seconds");
  const [useCustomLogo, setUseCustomLogo] = useState(false);
  const [allowAnonymousStats, setAllowAnonymousStats] = useState(true);
  const [loginBanner, setLoginBanner] = useState(false);
  const [appTemplatesUrl, setAppTemplatesUrl] = useState(
    "https://raw.githubusercontent.com/portainer/templates/master/templates.json",
  );

  // Kubernetes Settings State
  const [helmRepoUrl, setHelmRepoUrl] = useState(
    "https://charts.bitnami.com/bitnami",
  );
  const [kubeconfigExpiry, setKubeconfigExpiry] = useState("No expiry");
  const [enforceCodeDeployment, setEnforceCodeDeployment] = useState(false);
  const [requireNote, setRequireNote] = useState(false);
  const [allowStacks, setAllowStacks] = useState(true);

  // SSL Settings State
  const [forceHttps, setForceHttps] = useState(false);

  // Hidden Containers State
  const [filterName, setFilterName] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filters, setFilters] = useState<
    Array<{ name: string; value: string }>
  >([]);

  // Backup Settings State
  const [backupOption, setBackupOption] = useState<"download" | "s3">(
    "download",
  );
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");

  const handleSaveApplicationSettings = () => {
    showNotification({
      type: "success",
      message: "Settings saved",
      description: "Application settings have been updated successfully.",
    });
  };

  const handleSaveKubernetesSettings = () => {
    showNotification({
      type: "success",
      message: "Settings saved",
      description: "Kubernetes settings have been updated successfully.",
    });
  };

  const handleSaveSSLSettings = () => {
    showNotification({
      type: "success",
      message: "SSL settings saved",
      description: "SSL certificate settings have been updated.",
    });
  };

  const handleAddFilter = () => {
    if (!filterName.trim()) {
      showNotification({
        type: "error",
        message: "Name is required",
        description: "Please enter a filter name.",
      });
      return;
    }
    setFilters([...filters, { name: filterName, value: filterValue }]);
    setFilterName("");
    setFilterValue("");
    showNotification({
      type: "success",
      message: "Filter added",
      description: "Container filter has been added successfully.",
    });
  };

  const handleDownloadBackup = () => {
    if (passwordProtect && !backupPassword) {
      showNotification({
        type: "error",
        message: "Password required",
        description: "Please enter a password to protect the backup.",
      });
      return;
    }
    showNotification({
      type: "info",
      message: "Preparing backup",
      description: "Your backup file is being generated...",
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Settings{" "}
            <RefreshCw
              size={16}
              className="text-zinc-500 cursor-pointer hover:text-white transition-colors"
            />
          </h1>
        </div>
      </div>

      {/* Application Settings */}
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded overflow-hidden">
        <div className="px-6 py-4 bg-zinc-900/50 border-b border-[#2e2e2e] flex items-center gap-2">
          <SettingsIcon
            size={16}
            className="text-white bg-gray-400 rounded-full"
          />
          <h2 className="text-sm font-bold text-white">Application settings</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Snapshot Interval */}
          <div className="grid grid-cols-[200px_1fr] items-center gap-4">
            <label className="text-sm text-white">Snapshot interval</label>
            <input
              type="text"
              value={snapshotInterval}
              onChange={(e) => setSnapshotInterval(e.target.value)}
              className="bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all max-w-md"
            />
          </div>

          {/* Edge Agent Poll Frequency */}
          <div className="grid grid-cols-[200px_1fr] items-center gap-4">
            <label className="text-sm text-white">
              Edge agent default poll frequency
            </label>
            <select
              value={pollFrequency}
              onChange={(e) => setPollFrequency(e.target.value)}
              className="bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all max-w-md cursor-pointer"
            >
              <option>5 seconds</option>
              <option>10 seconds</option>
              <option>30 seconds</option>
              <option>1 minute</option>
            </select>
          </div>

          {/* Use Custom Logo */}
          <div className="grid grid-cols-[200px_1fr] items-center gap-4">
            <label className="text-sm text-white">Use custom logo</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setUseCustomLogo(!useCustomLogo)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors cursor-pointer",
                  useCustomLogo ? "bg-blue-600" : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                    useCustomLogo ? "translate-x-6" : "translate-x-0.5",
                  )}
                />
              </button>
              <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded">
                <Briefcase size={10} className="text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-400">
                  Business Feature
                </span>
              </div>
            </div>
          </div>

          {/* Allow Anonymous Statistics */}
          <div className="grid grid-cols-[200px_1fr] items-start gap-4">
            <label className="text-sm text-white pt-1">
              Allow the collection of anonymous statistics
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setAllowAnonymousStats(!allowAnonymousStats)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors cursor-pointer",
                  allowAnonymousStats ? "bg-blue-600" : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                    allowAnonymousStats ? "translate-x-6" : "translate-x-0.5",
                  )}
                />
              </button>
              <p className="text-xs text-zinc-500">
                You can find more information about this in our{" "}
                <a
                  href="#"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  privacy policy
                </a>
                .
              </p>
            </div>
          </div>

          {/* Login Screen Banner */}
          <div className="grid grid-cols-[200px_1fr] items-center gap-4">
            <label className="text-sm text-white">Login screen banner</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLoginBanner(!loginBanner)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors cursor-pointer",
                  loginBanner ? "bg-blue-600" : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                    loginBanner ? "translate-x-6" : "translate-x-0.5",
                  )}
                />
              </button>
              <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded">
                <Briefcase size={10} className="text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-400">
                  Business Feature
                </span>
              </div>
            </div>
          </div>

          {/* App Templates Section */}
          <div className="pt-4 border-t border-[#2e2e2e]">
            <h3 className="text-sm font-bold text-white mb-4">App Templates</h3>
            <p className="text-xs text-zinc-500 mb-4">
              You can specify the URL to your own template definitions file. See{" "}
              <a
                href="#"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Portainer documentation
              </a>{" "}
              for more details.
            </p>
            <p className="text-xs text-zinc-500 mb-4">
              The default value is{" "}
              <span className="text-blue-400">
                https://raw.githubusercontent.com/portainer/templates/master/templates.json
              </span>
            </p>
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm text-white">URL</label>
              <input
                type="text"
                value={appTemplatesUrl}
                onChange={(e) => setAppTemplatesUrl(e.target.value)}
                className="bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleSaveApplicationSettings}
            className="bg-zinc-100 hover:bg-white text-zinc-800  cursor-pointer border border-zinc-200 px-6 py-2 rounded text-xs transition-all shadow-sm hover:shadow-md"
          >
            Save application settings
          </button>
        </div>
      </div>

      {/* Kubernetes Settings */}
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded overflow-hidden">
        <div className="px-6 py-4 bg-zinc-900/50 border-b border-[#2e2e2e] flex items-center gap-2">
          <Database size={16} className="text-blue-400" />
          <h2 className="text-sm font-bold text-white">Kubernetes settings</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Helm Repository */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white">Helm repository</h3>
            <p className="text-xs text-zinc-500">
              You can specify the URL to your own{" "}
              <a
                href="#"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Helm repository
              </a>{" "}
              here.
            </p>
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm text-white">URL</label>
              <input
                type="text"
                value={helmRepoUrl}
                onChange={(e) => setHelmRepoUrl(e.target.value)}
                className="bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all"
              />
            </div>
          </div>

          {/* Kubeconfig */}
          <div className="pt-4 border-t border-[#2e2e2e]">
            <h3 className="text-sm font-bold text-white mb-4">Kubeconfig</h3>
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm text-white">Kubeconfig expiry</label>
              <select
                value={kubeconfigExpiry}
                onChange={(e) => setKubeconfigExpiry(e.target.value)}
                className="bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all max-w-md cursor-pointer"
              >
                <option>No expiry</option>
                <option>1 hour</option>
                <option>1 day</option>
                <option>7 days</option>
                <option>30 days</option>
              </select>
            </div>
          </div>

          {/* Deployment Options */}
          <div className="pt-4 border-t border-[#2e2e2e] space-y-4">
            <h3 className="text-sm font-bold text-white">Deployment options</h3>

            {/* Enforce Code-based Deployment */}
            <div className="grid grid-cols-[300px_1fr] items-center gap-4">
              <label className="text-sm text-white">
                Enforce code-based deployment
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setEnforceCodeDeployment(!enforceCodeDeployment)
                  }
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors cursor-pointer",
                    enforceCodeDeployment ? "bg-blue-600" : "bg-zinc-700",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                      enforceCodeDeployment
                        ? "translate-x-6"
                        : "translate-x-0.5",
                    )}
                  />
                </button>
                <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded">
                  <Briefcase size={10} className="text-zinc-500" />
                  <span className="text-[10px] font-bold text-zinc-400">
                    Business Feature
                  </span>
                </div>
              </div>
            </div>

            {/* Require Note */}
            <div className="grid grid-cols-[300px_1fr] items-center gap-4">
              <label className="text-sm text-white">
                Require a note on applications
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRequireNote(!requireNote)}
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors cursor-pointer",
                    requireNote ? "bg-blue-600" : "bg-zinc-700",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                      requireNote ? "translate-x-6" : "translate-x-0.5",
                    )}
                  />
                </button>
                <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded">
                  <Briefcase size={10} className="text-zinc-500" />
                  <span className="text-[10px] font-bold text-zinc-400">
                    Business Feature
                  </span>
                </div>
              </div>
            </div>

            {/* Allow Stacks */}
            <div className="grid grid-cols-[300px_1fr] items-center gap-4">
              <label className="text-sm text-white">
                Allow stacks functionality with Kubernetes environments
              </label>
              <button
                onClick={() => setAllowStacks(!allowStacks)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors cursor-pointer",
                  allowStacks ? "bg-blue-600" : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                    allowStacks ? "translate-x-6" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveKubernetesSettings}
            className="bg-zinc-100 hover:bg-white cursor-pointer text-zinc-800 border border-zinc-200 px-6 py-2 rounded text-xs font-bold transition-all shadow-sm hover:shadow-md"
          >
            Save Kubernetes settings
          </button>
        </div>
      </div>

      {/* Certificate Authority */}
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded overflow-hidden">
        <div className="px-6 py-4 bg-zinc-900/50 border-b border-[#2e2e2e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-blue-400" />
            <h2 className="text-sm font-bold text-white">
              Certificate Authority file for Kubernetes Helm repositories
            </h2>
          </div>
          <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded">
            <Briefcase size={10} className="text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-400">
              Business Feature
            </span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-zinc-500">
            Provide an additional CA file containing certificate(s) for HTTPS
            connections to Helm repositories.
          </p>
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm text-white">CA file</label>
            <button className="bg-zinc-800 hover:bg-zinc-700 cursor-pointer border border-zinc-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all max-w-fit">
              <Upload size={14} /> Select a file
            </button>
          </div>
          <div className="pt-2">
            <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded text-xs font-bold transition-all">
              Apply changes
            </button>
          </div>
        </div>
      </div>

      {/* SSL Certificate */}
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded overflow-hidden">
        <div className="px-6 py-4 bg-zinc-900/50 border-b border-[#2e2e2e] flex items-center gap-2">
          <Lock size={16} className="text-blue-400" />
          <h2 className="text-sm font-bold text-white">SSL certificate</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded">
            <AlertTriangle
              size={16}
              className="mt-0.5 flex-shrink-0 text-yellow-500"
            />
            <p className="text-xs text-yellow-200/90">
              Forcing HTTPS only will cause Portainer to stop listening on the
              HTTP port. Any edge agent environment that uses HTTP will no
              longer be available.
            </p>
          </div>

          <div className="grid grid-cols-[200px_1fr] items-center gap-4">
            <label className="text-sm text-white">Force HTTPS only</label>
            <button
              onClick={() => setForceHttps(!forceHttps)}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors cursor-pointer",
                forceHttps ? "bg-blue-600" : "bg-zinc-700",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                  forceHttps ? "translate-x-6" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Provide a new SSL Certificate to replace the existing one that is
            used for HTTPS connections.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm text-white">SSL/TLS certificate</label>
              <button className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all max-w-fit">
                <Upload size={14} /> Select a file
              </button>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm text-white">SSL/TLS private key</label>
              <button className="bg-zinc-800 hover:bg-zinc-700 border cursor-pointer border-zinc-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all max-w-fit">
                <Upload size={14} /> Select a file
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveSSLSettings}
            className="bg-zinc-100 hover:bg-white text-zinc-800 cursor-pointer border border-zinc-200 px-6 py-2 rounded text-xs font-bold transition-all shadow-sm hover:shadow-md"
          >
            Save SSL settings
          </button>
        </div>
      </div>

      {/* Hidden Containers */}
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded overflow-hidden">
        <div className="px-6 py-4 bg-zinc-900/50 border-b border-[#2e2e2e] flex items-center gap-2">
          <Shield size={16} className="text-blue-400" />
          <h2 className="text-sm font-bold text-white">Hidden containers</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded">
            <Info size={16} className="mt-0.5 flex-shrink-0 text-yellow-500" />
            <p className="text-xs text-yellow-200/90">
              You can hide containers with specific labels from Portainer UI.
              You need to specify the label name and value.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">Name</label>
                <input
                  type="text"
                  placeholder="e.g. com.example.foo"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all"
                />
                {!filterName && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={10} /> Name is required.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">
                  Value
                </label>
                <input
                  type="text"
                  placeholder="e.g. bar"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleAddFilter}
              className="bg-zinc-100 hover:bg-white text-zinc-800 border border-zinc-200 px-6 py-2 rounded text-xs font-bold transition-all shadow-sm hover:shadow-md"
            >
              + Add filter
            </button>
          </div>

          {/* Filters Table */}
          <div className="border border-[#2e2e2e] rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-[#2e2e2e]">
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-400 uppercase">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {filters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                    >
                      No filter available.
                    </td>
                  </tr>
                ) : (
                  filters.map((filter, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[#2e2e2e]/50 hover:bg-zinc-800/20"
                    >
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {filter.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {filter.value}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Back up Portainer */}
      <div className="bg-[#1c1c1c] border border-[#2e2e2e] rounded overflow-hidden">
        <div className="px-6 py-4 bg-zinc-900/50 border-b border-[#2e2e2e] flex items-center gap-2">
          <Download size={16} className="text-blue-400" />
          <h2 className="text-sm font-bold text-white">Back up Portainer</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Backup Configuration Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white">
              Backup configuration
            </h3>
            <p className="text-xs text-zinc-500">
              This will back up your Portainer server configuration and does not
              include containers.
            </p>
          </div>

          {/* Backup Options */}
          <div className="grid grid-cols-2 gap-4">
            {/* Download Backup */}
            <button
              onClick={() => setBackupOption("download")}
              className={cn(
                "relative p-6 rounded border-2 transition-all text-left group",
                backupOption === "download"
                  ? "bg-blue-600/20 border-blue-500"
                  : "bg-zinc-900/30 border-[#2e2e2e] hover:border-zinc-700",
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <Download size={20} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  Download backup file
                </h3>
              </div>
              {backupOption === "download" && (
                <div className="absolute top-4 right-4 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </button>

            {/* S3 Backup */}
            <button
              disabled
              className="relative p-6 rounded border-2 bg-zinc-900/10 border-[#2e2e2e] opacity-50 cursor-not-allowed text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <Cloud size={20} className="text-zinc-600" />
                <h3 className="text-sm font-bold text-zinc-500">Store in S3</h3>
              </div>
              <p className="text-xs text-zinc-600">Define a cron schedule</p>
            </button>
          </div>

          {/* Security Settings */}
          <div className="pt-4 border-t border-[#2e2e2e] space-y-4">
            <h3 className="text-sm font-bold text-white">Security settings</h3>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm text-white">Password Protect</label>
              <button
                onClick={() => setPasswordProtect(!passwordProtect)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  passwordProtect ? "bg-blue-600" : "bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                    passwordProtect ? "translate-x-6" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            {passwordProtect && (
              <div className="grid grid-cols-[200px_1fr] items-start gap-4 animate-in slide-in-from-top-2 duration-200">
                <label className="text-sm text-zinc-400 pt-2">Password</label>
                <div className="space-y-1">
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    className="w-full max-w-md bg-[#121212] border border-[#2e2e2e] rounded px-4 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-700 transition-all"
                  />
                  {!backupPassword && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertTriangle size={10} /> This field is required.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleDownloadBackup}
            className="bg-zinc-100 hover:bg-white text-zinc-800 border border-zinc-200 px-6 py-2 rounded text-xs font-bold transition-all shadow-sm hover:shadow-md"
          >
            <Download size={14} className="inline mr-2" />
            Download backup
          </button>
        </div>
      </div>
    </div>
  );
}
