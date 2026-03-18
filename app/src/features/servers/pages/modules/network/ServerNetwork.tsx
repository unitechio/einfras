import { useState, useEffect } from "react";
import { mockSecurityService } from "../shared/mockServerService";
import { Network, ArrowUp, ArrowDown } from "lucide-react";

export default function ServerNetwork() {
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNetwork = async () => {
      setLoading(true);
      const data = await (mockSecurityService as any).getNetworkInterfaces();
      setInterfaces(data);
      setLoading(false);
    };
    loadNetwork();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-100/50 dark:border-purple-500/20">
              <Network className="text-purple-500" size={20} />
            </div>
            Network Interfaces
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-[13px] mt-1">
            Monitor network activity and configuration.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
             [...Array(3)].map((_, i) => (
               <div key={i} className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm min-h-[220px] isolate overflow-hidden animate-pulse">
               </div>
             ))
        ) : (
          interfaces.map((iface) => (
            <div
              key={iface.name}
              className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 border border-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-105 transition-transform">
                    <Network size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-[15px]">
                      {iface.name}
                    </h3>
                    <span className="text-[11px] font-mono text-zinc-500">{iface.mac}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 border border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {iface.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-[12px] border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
                  <span className="font-medium text-zinc-500">IP Address</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {iface.ip}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[12px] border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
                  <span className="font-medium text-zinc-500">Netmask</span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {iface.mask}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-zinc-50/50 dark:bg-[#1A1A1A] rounded-lg p-3 border border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-1">
                      <ArrowDown size={14} className="text-emerald-500" /> RX
                    </div>
                    <div className="text-[15px] tracking-tight font-bold text-zinc-900 dark:text-zinc-50">
                      {iface.rx}
                    </div>
                  </div>
                  <div className="bg-zinc-50/50 dark:bg-[#1A1A1A] rounded-lg p-3 border border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-1">
                      <ArrowUp size={14} className="text-blue-500" /> TX
                    </div>
                    <div className="text-[15px] tracking-tight font-bold text-zinc-900 dark:text-zinc-50">
                      {iface.tx}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
