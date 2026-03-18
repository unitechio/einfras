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
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header Section */}
      <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
              <Server size={32} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
                {info.hostname}
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider border border-emerald-200/50 dark:border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online
                </span>
              </h1>
              <div className="flex items-center gap-4 mt-2 text-[13px] font-medium text-zinc-500">
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
                  <Globe size={14} className="text-zinc-400" />
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{info.ip}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
                  <Activity size={14} className="text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">v1.2.4 Agent</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="text-right text-[12px] font-medium text-zinc-400 hidden md:block bg-zinc-50 dark:bg-[#1A1A1A] px-3 py-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
              <div className="text-zinc-500">Last synced</div>
              <div className="text-zinc-700 dark:text-zinc-300">{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-500/20 shadow-inner">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">
              System Uptime
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">
              {info.uptime}
            </div>
            <div className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md w-fit border border-emerald-100/50 dark:border-emerald-500/20">
              <CheckCircle2 size={12} /> Stable
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-100/50 dark:border-orange-500/20 shadow-inner">
            <Shield size={24} />
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">OS Info</div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">
              {info.os}
            </div>
            <div className="text-[13px] text-zinc-500 mt-1.5 font-mono bg-zinc-50 dark:bg-[#1A1A1A] px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-800/50 w-fit">
              {info.kernel}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20 shadow-inner">
            <Cpu size={24} />
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">
              Load Average
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">
              0.45, <span className="text-zinc-400">0.60, 0.40</span>
            </div>
            <div className="text-[12px] font-medium text-zinc-500 mt-1.5 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              4 Cores Available
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Editable Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
              <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                <Info size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white">
                General Configuration
              </h3>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Display Hostname
                  </label>
                  <Input
                    type="text"
                    defaultValue={info.hostname}
                    className="font-mono text-sm w-full"
                  />
                  <p className="text-[12px] text-zinc-500 font-medium">
                    Internal hostname used for DNS resolution.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    defaultValue={info.description}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 transition-all font-medium text-zinc-900 dark:text-zinc-100 resize-none min-h-[100px]"
                    placeholder="Describe the purpose of this server..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Tags
                  </label>
                  <div className="relative">
                    <Tag
                      size={16}
                      className="absolute left-3.5 top-3 text-zinc-400"
                    />
                    <Input
                      type="text"
                      defaultValue={info.tags}
                      placeholder="production, database, us-east..."
                      className="pl-10 w-full"
                    />
                  </div>
                  <p className="text-[12px] text-zinc-500 font-medium">
                    Comma separated keywords for filtering.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end pt-5 border-t border-zinc-100 dark:border-zinc-800/60">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                className="shadow-sm"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Read-only Hardware Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
              <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg">
                <HardDrive size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white">
                Hardware Specs
              </h3>
            </div>

            <div className="space-y-5">
              <div className="flex justify-between items-center py-2.5 border-b border-zinc-50 dark:border-zinc-800/30">
                <span className="text-[13px] font-medium text-zinc-500">Architecture</span>
                <span className="text-[12px] font-bold font-mono bg-zinc-100 dark:bg-[#1A1A1A] px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-300">
                  {info.arch}
                </span>
              </div>
              <div className="py-2.5 border-b border-zinc-50 dark:border-zinc-800/30">
                <span className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider mb-2.5 block">
                  Processors
                </span>
                <div className="text-[14px] text-zinc-900 dark:text-zinc-100 font-bold flex items-center gap-2.5">
                  <Cpu size={16} className="text-zinc-400" />
                  Intel Xeon E5-2676 v3
                </div>
                <div className="text-[12px] font-medium text-zinc-500 mt-1 pl-6.5">
                  @ 2.40GHz (4 vCPUs)
                </div>
              </div>
              <div className="py-2.5 border-b border-zinc-50 dark:border-zinc-800/30">
                <span className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider mb-2.5 block">
                  Memory
                </span>
                <div className="text-[14px] text-zinc-900 dark:text-zinc-100 font-bold flex items-center gap-2.5">
                  <Activity size={16} className="text-zinc-400" />
                  16 GB DDR4
                </div>
                <div className="w-full bg-zinc-100 dark:bg-[#1A1A1A] h-2 rounded-full mt-3 overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50 shadow-inner">
                  <div className="bg-purple-500 h-full w-[45%] rounded-r-full transition-all duration-1000"></div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[11px] font-semibold text-zinc-500">Used: 7.2GB</span>
                  <span className="text-[11px] font-semibold text-zinc-500">Total: 16GB</span>
                </div>
              </div>
              <div className="py-2">
                <span className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider mb-3 block">
                  Network
                </span>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-[#1A1A1A] p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                    <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Public IP</span>
                    <span className="text-[12px] font-bold font-mono bg-blue-100/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-500/20">
                      1.2.3.4
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-[#1A1A1A] p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                    <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Private IP</span>
                    <span className="text-[12px] font-bold font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">
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
