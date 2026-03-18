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
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Mock Data for Restore List
const backupHistory = [
  {
    id: 1,
    name: "full-backup-2024-01-08.tar.gz",
    size: "2.4 GB",
    date: "2024-01-08 02:00",
    type: "Full",
    destination: "S3 Bucket",
    status: "Success",
  },
  {
    id: 2,
    name: "inc-backup-2024-01-07.tar.gz",
    size: "156 MB",
    date: "2024-01-07 02:00",
    type: "Incremental",
    destination: "S3 Bucket",
    status: "Success",
  },
  {
    id: 3,
    name: "inc-backup-2024-01-06.tar.gz",
    size: "142 MB",
    date: "2024-01-06 02:00",
    type: "Incremental",
    destination: "Local",
    status: "Warning",
  },
];

export default function ServerBackup() {
  const [scheduleType, setScheduleType] = useState("daily");

  // Destinations State
  const [destinations, setDestinations] = useState({
    local: true,
    s3: false,
    ftp: false,
    gcs: false,
  });

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Backup & Recovery
          </h2>
          <p className="text-xs text-zinc-500">
            Configure data protection policies and restore points
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-4 py-2 rounded-sm text-sm  flex items-center gap-2 transition-all">
            <FileText size={16} />
            <span>View Logs</span>
          </button>
          <button className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
            <Play size={16} />
            <span>Run Backup Now</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Configuration */}
        <div className="xl:col-span-2 space-y-6">
          {/* 1. DATA SCOPE */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                <Files size={20} />
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-white">
                Data Scope
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Include
                </label>
                <div className="space-y-2">
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
                      className="flex items-center gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        defaultChecked={item.default}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        <item.icon size={16} className="text-zinc-400" />
                        {item.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Exclude Paths
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="/tmp, /var/cache"
                      className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-sm cursor-pointer text-zinc-500 transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["/tmp/*", "/var/log/*", ".git"].map((path) => (
                      <span
                        key={path}
                        className="text-xs font-mono bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded flex items-center gap-1"
                      >
                        {path}
                        <X
                          size={12}
                          className="cursor-pointer hover:text-red-800"
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Retention Policy
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">
                        Auto-cleanup
                      </span>
                      <div className="w-8 h-4 bg-green-500 rounded-full relative cursor-pointer">
                        <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">Keep last</span>
                    <input
                      type="number"
                      defaultValue={7}
                      className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-center text-sm font-bold"
                    />
                    <span className="text-sm text-zinc-500">backups</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ADVANCED SETTINGS (Encryption, Compression, Type) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-6">
              Settings & Security
            </h3>

            <div className="space-y-6">
              {/* Backup Type */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-3">
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
                      className="relative flex flex-col p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                    >
                      <input
                        type="radio"
                        name="backupType"
                        className="absolute top-4 right-4 text-blue-600 focus:ring-blue-500"
                        defaultChecked={type.id === "inc"}
                      />
                      <span className="font-bold text-sm text-zinc-900 dark:text-white mb-1">
                        {type.label}
                      </span>
                      <span className="text-xs text-zinc-500 leading-tight">
                        {type.desc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                {/* Compression */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileArchive size={18} className="text-zinc-500" />
                      <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                        Compression
                      </span>
                    </div>
                    <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                  <select className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm">
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
                      <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                        Encryption (AES-256)
                      </span>
                    </div>
                    <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full relative cursor-pointer">
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Enter encryption key..."
                      disabled
                      className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. DESTINATIONS */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                <Cloud size={20} />
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-white">
                Storage Destinations
              </h3>
            </div>

            <div className="flex gap-4 mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-1 overflow-x-auto">
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
                <div className="animate-in fade-in slide-in-from-top-2 p-4 pt-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                      <Cloud size={16} className="text-orange-500" />
                      Amazon S3 Configuration
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500">
                        Bucket Name
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm"
                        placeholder="my-backup-bucket"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500">
                        Region
                      </label>
                      <select className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm">
                        <option>us-east-1</option>
                        <option>us-west-2</option>
                        <option>eu-central-1</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500">
                        Access Key ID
                      </label>
                      <input
                        type="password"
                        value="********************"
                        readOnly
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-zinc-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500">
                        Secret Access Key
                      </label>
                      <input
                        type="password"
                        value="****************************************"
                        readOnly
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-zinc-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback if nothing selected */}
              {!Object.values(destinations).some(Boolean) && (
                <div className="text-center py-8 text-zinc-400 text-sm bg-zinc-50 dark:bg-zinc-800/20 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  Please select at least one storage destination above
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Schedule & History */}
        <div className="space-y-6">
          {/* 4. SCHEDULE */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                <Calendar size={20} />
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-white">
                Schedule
              </h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">
                  Frequency
                </label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2.5 text-xs font-medium outline-none"
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
                  <label className="text-xs font-bold text-zinc-500 uppercase">
                    Cron Expression
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue="0 0 * * *"
                      className="flex-1 font-mono bg-zinc-900 text-green-400 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-3">
                  Event Triggers
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Before System Update
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      Before Deployment
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 5. RESTORE UI (Simplified List) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <History size={18} className="text-zinc-400" />
                Restore Points
              </h3>
              <Link
                to="#"
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View All
              </Link>
            </div>

            <div className="space-y-0.5 max-h-[400px] overflow-y-auto pr-1">
              {backupHistory.map((backup) => (
                <div
                  key={backup.id}
                  className="group p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                        backup.type === "Full"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                      )}
                    >
                      {backup.type}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {backup.size}
                    </span>
                  </div>
                  <div
                    className="font-medium text-sm text-zinc-700 dark:text-zinc-200 mb-1 truncate"
                    title={backup.name}
                  >
                    {backup.name}
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {backup.date}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 hover:text-blue-600"
                        title="Restore"
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        className="p-1 hover:text-green-600"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
