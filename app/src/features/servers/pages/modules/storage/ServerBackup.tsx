import { useState } from "react";
import {
  Download,
  Upload,
  History,
  HardDrive,
  Cloud,
  Network,
  Settings,
  Clock,
  CheckCircle2,
  Database,
  FileText,
  Files,
  Lock,
  Plus,
  X,
  Play,
  Calendar,
  FileArchive,
  Trash2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";

import { useServerBackups, useCreateBackup, useRestoreBackup, useDeleteBackup } from "../../../api/useServerHooks";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export default function ServerBackup() {
  const { serverId } = useParams<{ serverId: string }>();
  const qc = useQueryClient();
  const { showNotification } = useNotification();

  // Real Hooks
  const { data: backupsData, isLoading } = useServerBackups(serverId || "");
  const { mutateAsync: createBackup, isPending: isCreating } = useCreateBackup(serverId || "");
  const { mutateAsync: restoreBackup } = useRestoreBackup();
  const { mutateAsync: deleteBackup } = useDeleteBackup(serverId || "");

  const backups = backupsData || [];
  const [search, setSearch] = useState("");
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState("/etc");
  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const handleRunBackup = async () => {
    try {
      await createBackup({ label: `Manual Backup ${new Date().toLocaleString()}`, path: customPath.trim() || "/etc" });
      showNotification({
        type: "success",
        message: "Backup queued",
        description: `A new backup job was created for ${customPath.trim() || "/etc"}.`,
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Failed to create backup",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  const handleRestore = async (backupId: string) => {
    try {
      await restoreBackup(backupId);
      showNotification({
        type: "success",
        message: "Restore queued",
        description: "The selected backup is being restored.",
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Failed to restore backup",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  const handleDelete = async (backupId: string) => {
    try {
      await deleteBackup(backupId);
      showNotification({
        type: "success",
        message: "Backup deleted",
        description: "The selected backup has been removed.",
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Failed to delete backup",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  }
  const filteredBackups = backups.filter((backup) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [backup.label, backup.path, backup.status, backup.type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });
  const selectedBackup = backups.find((backup) => backup.id === selectedBackupId) ?? filteredBackups[0] ?? null;

  const [scheduleType, setScheduleType] = useState("daily");

  // Destinations State
  const [destinations, setDestinations] = useState({
    local: true,
    s3: false,
    ftp: false,
    gcs: false,
  });

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-pink-50 dark:bg-pink-500/10 rounded-lg border border-pink-100/50 dark:border-pink-500/20">
              <History className="text-pink-500" size={20} />
            </div>
            Backup & Recovery
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
            Configure data protection policies and restore points
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white dark:bg-[#121212] shadow-sm" onClick={() => void qc.invalidateQueries({ queryKey: ["servers", "backup", serverId] })}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
          <Button variant="outline" className="bg-white dark:bg-[#121212] shadow-sm">
            <FileText size={16} className="mr-2" />
            View Logs
          </Button>
          <Button 
            variant="primary" 
            className="shadow-sm"
            onClick={handleRunBackup}
            disabled={isCreating}
          >
            <Play size={16} className={isCreating ? "animate-pulse mr-2" : "mr-2"} />
            {isCreating ? "Backing up..." : "Run Backup Now"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Configuration */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2 flex-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Backup Path
                </label>
                <Input value={customPath} onChange={(e) => setCustomPath(e.target.value)} placeholder="/etc or /var/www" />
              </div>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search backups by name, status, path..." className="pl-10" />
              </div>
            </div>
          </div>

          {/* 1. DATA SCOPE */}
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30">
                <Files size={20} />
              </div>
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white">
                Data Scope
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Include
                </label>
                <div className="space-y-2.5">
                  {[
                    { label: "Databases", icon: Database, default: true },
                    {
                      label: "Application Files",
                      icon: FileText,
                      default: true,
                    },
                    {
                      label: "User Uploads & Assets",
                      icon: Upload,
                      default: false,
                    },
                    { label: "System Configs", icon: Settings, default: true },
                    { label: "System Logs", icon: FileText, default: false },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-[#1A1A1A] cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        defaultChecked={item.default}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      />
                      <div className="flex items-center gap-2.5 text-[14px] font-medium text-zinc-700 dark:text-zinc-300">
                        <item.icon size={16} className="text-zinc-500" />
                        {item.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Exclude Paths
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="/tmp, /var/cache"
                      className="flex-1"
                    />
                    <Button variant="outline" size="icon" className="shrink-0 bg-white dark:bg-[#121212]">
                      <Plus size={16} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["/tmp/*", "/var/log/*", ".git"].map((path) => (
                      <span
                        key={path}
                        className="text-[12px] font-mono font-medium bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-md flex items-center gap-1.5"
                      >
                        {path}
                        <X
                          size={12}
                          className="cursor-pointer hover:text-red-800 dark:hover:text-red-300 opacity-60 hover:opacity-100 transition-opacity"
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800/60 mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
                      Retention Policy
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-zinc-500">
                        Auto-cleanup
                      </span>
                      <div className="w-8 h-4 bg-emerald-500 rounded-full relative cursor-pointer shadow-inner">
                        <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-zinc-500">Keep last</span>
                    <Input
                      type="number"
                      defaultValue={7}
                      className="w-20 text-center font-bold"
                    />
                    <span className="text-[13px] font-medium text-zinc-500">backups</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ADVANCED SETTINGS (Encryption, Compression, Type) */}
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white mb-6">
              Settings & Security
            </h3>

            <div className="space-y-8">
              {/* Backup Type */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-4">
                  Backup Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      id: "full",
                      label: "Full Backup",
                      desc: "Complete copy of all data",
                    },
                    {
                      id: "inc",
                      label: "Incremental",
                      desc: "Changes since last backup",
                    },
                    {
                      id: "diff",
                      label: "Differential",
                      desc: "Changes since last Full",
                    },
                  ].map((type) => (
                    <label
                      key={type.id}
                      className="relative flex flex-col p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-[#1A1A1A] cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="backupType"
                        className="absolute top-4 right-4 text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        defaultChecked={type.id === "inc"}
                      />
                      <span className="font-bold text-[14px] text-zinc-900 dark:text-white mb-1">
                        {type.label}
                      </span>
                      <span className="text-[12px] text-zinc-500 leading-tight">
                        {type.desc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/60">
                {/* Compression */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileArchive size={18} className="text-zinc-500" />
                      <span className="font-semibold text-[14px] text-zinc-700 dark:text-zinc-300">
                        Compression
                      </span>
                    </div>
                    <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer shadow-inner">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                  <select className="flex h-10 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 transition-all font-medium text-zinc-900 dark:text-zinc-100">
                    <option>GZIP (Fastest)</option>
                    <option>ZSTD (Best Level)</option>
                    <option>BZIP2 (High Compression)</option>
                  </select>
                </div>

                {/* Encryption */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={18} className="text-zinc-500" />
                      <span className="font-semibold text-[14px] text-zinc-700 dark:text-zinc-300">
                        Encryption (AES-256)
                      </span>
                    </div>
                    <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full relative cursor-pointer shadow-inner">
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="Enter encryption key..."
                      disabled
                      className="opacity-60 cursor-not-allowed font-medium w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. DESTINATIONS */}
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/30">
                <Cloud size={20} />
              </div>
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white">
                Storage Destinations
              </h3>
            </div>

            <div className="flex gap-4 mb-6 border-b border-zinc-100 dark:border-zinc-800/60 pb-1 overflow-x-auto no-scrollbar">
              {[
                { id: "local", icon: HardDrive, label: "Local" },
                { id: "s3", icon: Cloud, label: "Amazon S3" },
                { id: "ftp", icon: Network, label: "FTP / SFTP" },
                { id: "gcs", icon: Cloud, label: "Google Cloud" },
              ].map((dest) => (
                <button
                  key={dest.id}
                  onClick={() =>
                    setDestinations((prev) => ({
                      ...prev,
                      [dest.id]: !prev[dest.id as keyof typeof destinations],
                    }))
                  }
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                    destinations[dest.id as keyof typeof destinations]
                      ? "border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/10 dark:text-purple-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300",
                  )}
                >
                  <dest.icon size={16} />
                  {dest.label}
                  {destinations[dest.id as keyof typeof destinations] && (
                    <CheckCircle2 size={14} className="ml-1" />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {/* Dynamic Form Example for S3 (Enabled) */}
              {destinations.s3 && (
                <div className="animate-in fade-in slide-in-from-top-2 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-[#1A1A1A]">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="font-bold text-[14px] text-zinc-900 dark:text-white flex items-center gap-2.5">
                      <div className="p-1.5 bg-orange-100/50 dark:bg-orange-900/20 rounded-md">
                        <Cloud size={16} className="text-orange-500" />
                      </div>
                      Amazon S3 Configuration
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-zinc-500">
                        Bucket Name
                      </label>
                      <Input
                        type="text"
                        placeholder="my-backup-bucket"
                        className="w-full bg-white dark:bg-[#121212]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-zinc-500">
                        Region
                      </label>
                      <select className="flex h-10 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 transition-all font-medium text-zinc-900 dark:text-zinc-100">
                        <option>us-east-1</option>
                        <option>us-west-2</option>
                        <option>eu-central-1</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-zinc-500">
                        Access Key ID
                      </label>
                      <Input
                        type="password"
                        value="********************"
                        readOnly
                        className="w-full bg-white dark:bg-[#121212] font-mono text-zinc-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-zinc-500">
                        Secret Access Key
                      </label>
                      <Input
                        type="password"
                        value="****************************************"
                        readOnly
                        className="w-full bg-white dark:bg-[#121212] font-mono text-zinc-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback if nothing selected */}
              {!Object.values(destinations).some(Boolean) && (
                <div className="text-center py-10 text-zinc-500 text-[13px] font-medium bg-zinc-50 dark:bg-[#1A1A1A] rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800/60 transition-all">
                  Please select at least one storage destination above
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Schedule & History */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                <History size={20} />
              </div>
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white">
                Backup Inventory
              </h3>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-zinc-500">Loading backups...</div>
            ) : filteredBackups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200/70 bg-zinc-50/70 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800/70 dark:bg-[#171717] dark:text-zinc-400">
                Chưa có data backup
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBackups.map((backup) => (
                  <button
                    key={backup.id}
                    onClick={() => setSelectedBackupId(backup.id)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      selectedBackup?.id === backup.id
                        ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                        : "border-zinc-200/60 bg-zinc-50/40 hover:border-zinc-300 dark:border-zinc-800/60 dark:bg-[#1A1A1A] dark:hover:border-zinc-700",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-white">{backup.label || backup.id}</div>
                        <div className="mt-1 text-[12px] text-zinc-500">{backup.path || "-"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{backup.status || "unknown"}</div>
                        <div className="mt-1 text-[12px] text-zinc-500">{backup.created_at ? new Date(backup.created_at).toLocaleString() : "n/a"}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. SCHEDULE */}
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                <Calendar size={20} />
              </div>
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white">
                Schedule
              </h3>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Frequency
                </label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 transition-all font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily (midnight)</option>
                  <option value="weekly">Weekly (Sunday)</option>
                  <option value="monthly">Monthly (1st)</option>
                  <option value="custom">Custom Cron Expression</option>
                </select>
              </div>

              {scheduleType === "custom" && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    Cron Expression
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      defaultValue="0 0 * * *"
                      className="font-mono text-emerald-600 dark:text-emerald-400 font-bold tracking-wider text-[14px] bg-zinc-50 dark:bg-zinc-950 w-full"
                    />
                  </div>
                </div>
              )}

              <div className="pt-5 border-t border-zinc-100 dark:border-zinc-800/60">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-3">
                  Event Triggers
                </label>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                      Before System Update
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                      Before Deployment
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 5. RESTORE UI (Simplified List) */}
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                  <History size={18} className="text-zinc-500" />
                </div>
                Restore Points
              </h3>
              <Link
                to="#"
                className="text-[13px] font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                View All
              </Link>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
              {isLoading ? (
                <div className="p-12 text-center text-sm font-medium text-zinc-500 animate-pulse">
                    Loading backups...
                </div>
              ) : backups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200/70 bg-zinc-50/60 p-8 text-center dark:border-zinc-800/70 dark:bg-zinc-900/30">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-400 shadow-sm dark:bg-zinc-950 dark:text-zinc-500">
                    <History size={20} />
                  </div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    Chưa có data backup
                  </div>
                  <div className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                    Server này chưa có restore point nào được tạo. Bạn có thể chạy backup thủ công ngay bây giờ để bắt đầu lưu lịch sử sao lưu.
                  </div>
                  <Button
                    variant="primary"
                    className="mt-4 shadow-sm"
                    onClick={handleRunBackup}
                    disabled={isCreating}
                  >
                    <Play size={14} className={isCreating ? "mr-2 animate-pulse" : "mr-2"} />
                    {isCreating ? "Backing up..." : "Run First Backup"}
                  </Button>
                </div>
              ) : (
                backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="group p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 rounded-xl border border-transparent hover:border-zinc-200/60 dark:hover:border-zinc-700/60 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                        Full
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {backup.size ? `${(backup.size / 1024 / 1024).toFixed(1)} MB` : "0 MB"}
                      </span>
                    </div>
                    <div
                      className="font-semibold text-[14px] text-zinc-900 dark:text-zinc-100 mb-2 truncate"
                      title={backup.label || backup.path}
                    >
                      {backup.label || backup.path || "Untitled Backup"}
                    </div>
                    <div className="flex justify-between items-center text-[12px] text-zinc-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} /> {backup.created_at ? new Date(backup.created_at).toLocaleString() : "-"}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20" 
                            title="Restore"
                            onClick={(e) => { e.stopPropagation(); setRestoreCandidate(backup.id); }}
                        >
                          <Upload size={14} />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20" 
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); setDeleteCandidate(backup.id); }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30">
                <Database size={20} />
              </div>
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white">
                Selected Backup
              </h3>
            </div>

            {selectedBackup ? (
              <div className="space-y-4">
                <DetailRow label="Name" value={selectedBackup.label || selectedBackup.id} />
                <DetailRow label="Path" value={selectedBackup.path || "-"} mono />
                <DetailRow label="Status" value={selectedBackup.status || "unknown"} />
                <DetailRow label="Type" value={selectedBackup.type || "full"} />
                <DetailRow label="Size" value={formatBytes(selectedBackup.size ?? 0)} />
                <DetailRow label="Created" value={selectedBackup.created_at ? new Date(selectedBackup.created_at).toLocaleString() : "n/a"} />
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setRestoreCandidate(selectedBackup.id)}>
                    <Download size={14} className="mr-2" />
                    Restore
                  </Button>
                  <Button variant="danger" onClick={() => setDeleteCandidate(selectedBackup.id)}>
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Select a backup to inspect details.</div>
            )}
          </div>
        </div>
      </div>
      <ConfirmActionDialog
        open={!!restoreCandidate}
        title="Restore backup?"
        description="This will overwrite current data on the server with the selected restore point."
        confirmLabel="Restore Backup"
        onClose={() => setRestoreCandidate(null)}
        onConfirm={() => {
          if (!restoreCandidate) return;
          void handleRestore(restoreCandidate).finally(() => setRestoreCandidate(null));
        }}
        pending={false}
        tone="warning"
      />
      <ConfirmActionDialog
        open={!!deleteCandidate}
        title="Delete backup?"
        description="This permanently removes the selected backup artifact."
        confirmLabel="Delete Backup"
        onClose={() => setDeleteCandidate(null)}
        onConfirm={() => {
          if (!deleteCandidate) return;
          void handleDelete(deleteCandidate).finally(() => setDeleteCandidate(null));
        }}
        pending={false}
        tone="danger"
      />
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 text-sm dark:border-zinc-800/60">
      <span className="font-medium text-zinc-500">{label}</span>
      <span className={cn("text-right text-zinc-900 dark:text-zinc-100", mono && "font-mono text-[12px]")}>{value}</span>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
