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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Network Interfaces
          </h2>
          <p className="text-zinc-500 text-sm">
            Monitor network activity and configuration.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div>Loading network data...</div>
        ) : (
          interfaces.map((iface) => (
            <div
              key={iface.name}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Network size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-lg">
                      {iface.name}
                    </h3>
                    <span className="text-xs text-zinc-500">{iface.mac}</span>
                  </div>
                </div>
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold uppercase rounded">
                  {iface.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-zinc-500">IP Address</span>
                  <span className=" text-zinc-900 dark:text-white">
                    {iface.ip}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-zinc-500">Netmask</span>
                  <span className=" text-zinc-700 dark:text-zinc-300">
                    {iface.mask}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-zinc-400 mb-1">
                      <ArrowDown size={12} /> RX
                    </div>
                    <div className="text-lg font-bold text-zinc-900 dark:text-white">
                      {iface.rx}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs text-zinc-400 mb-1">
                      <ArrowUp size={12} /> TX
                    </div>
                    <div className="text-lg font-bold text-zinc-900 dark:text-white">
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
