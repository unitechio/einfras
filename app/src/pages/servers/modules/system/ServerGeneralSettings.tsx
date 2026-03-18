import { useState, useEffect } from "react";
import {
  Save,
  Server,
  Clock,
  Cpu,
  Activity,
  HardDrive,
  Tag,
  Globe,
  Info,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { mockSecurityService } from "../shared/mockServerService";

export default function ServerGeneralSettings() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadInfo = async () => {
      setLoading(true);
      const data = await (mockSecurityService as any).getServerInfo();
      setInfo(data);
      setLoading(false);
    };
    loadInfo();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSaving(false);
    // Ideally show toast here
    alert("Settings saved successfully!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">Loading server details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Server size={32} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                {info.hostname}
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Online
                </span>
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Globe size={14} />
                  <span className="font-mono">{info.ip}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity size={14} />
                  <span>v1.2.4 Agent</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="text-right text-xs text-zinc-400 hidden md:block">
              <div>Last synced</div>
              <div>{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-sm text-zinc-500 font-medium">
              System Uptime
            </div>
            <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
              {info.uptime}
            </div>
            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Stable
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
            <Shield size={24} />
          </div>
          <div>
            <div className="text-sm text-zinc-500 font-medium">OS Info</div>
            <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
              {info.os}
            </div>
            <div className="text-xs text-zinc-400 mt-1 font-mono">
              {info.kernel}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
            <Cpu size={24} />
          </div>
          <div>
            <div className="text-sm text-zinc-500 font-medium">
              Load Average
            </div>
            <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
              0.45, 0.60, 0.40
            </div>
            <div className="text-xs text-zinc-400 mt-1">4 Cores Available</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Editable Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <Info size={20} className="text-blue-500" />
              <h3 className="font-bold text-zinc-900 dark:text-white">
                General Configuration
              </h3>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Display Hostname
                  </label>
                  <input
                    type="text"
                    defaultValue={info.hostname}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-zinc-500">
                    Internal hostname used for DNS resolution.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    defaultValue={info.description}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
                    placeholder="Describe the purpose of this server..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Tags
                  </label>
                  <div className="relative">
                    <Tag
                      size={16}
                      className="absolute left-3 top-3 text-zinc-400"
                    />
                    <input
                      type="text"
                      defaultValue={info.tags}
                      placeholder="production, database, us-east..."
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md pl-10 pr-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Comma separated keywords for filtering.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Save size={16} />
                )}
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Read-only Hardware Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <HardDrive size={20} className="text-purple-500" />
              <h3 className="font-bold text-zinc-900 dark:text-white">
                Hardware Specs
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-zinc-50 dark:border-zinc-800/50">
                <span className="text-sm text-zinc-500">Architecture</span>
                <span className="text-sm font-medium font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  {info.arch}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-400 uppercase font-semibold mb-2 block">
                  Processors
                </span>
                <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-2">
                  <Cpu size={16} className="text-zinc-400" />
                  Intel Xeon E5-2676 v3
                </div>
                <div className="text-xs text-zinc-500 mt-1 pl-6">
                  @ 2.40GHz (4 vCPUs)
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-400 uppercase font-semibold mb-2 block">
                  Memory
                </span>
                <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-2">
                  <Activity size={16} className="text-zinc-400" />
                  16 GB DDR4
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-purple-500 h-full w-[45%]"></div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-zinc-400">Used: 7.2GB</span>
                  <span className="text-[10px] text-zinc-400">Total: 16GB</span>
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-400 uppercase font-semibold mb-2 block">
                  Network
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Public IP</span>
                    <span className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                      1.2.3.4
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Private IP</span>
                    <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded">
                      {info.ip}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
