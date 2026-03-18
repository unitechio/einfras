import { useState, useEffect } from "react";
import { mockSecurityService } from "../shared/mockServerService";
import { Package, RefreshCw } from "lucide-react";

export default function ServerPackages() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    const data = await (mockSecurityService as any).getInstalledPackages();
    setPackages(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Installed Packages
          </h2>
          <p className="text-zinc-500 text-sm">
            Manage system packages and updates.
          </p>
        </div>
        <button
          onClick={loadPackages}
          className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-blue-500/20 active:scale-95 shadow-sm"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Check Updates
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-4">Package Name</th>
              <th className="px-6 py-4">Version</th>
              <th className="px-6 py-4">Architecture</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                  Loading packages...
                </td>
              </tr>
            ) : (
              packages.map((pkg) => (
                <tr
                  key={pkg.name}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-sm"
                >
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                    <Package size={16} className="text-zinc-400" />
                    {pkg.name}
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                    {pkg.version}
                  </td>
                  <td className="px-6 py-4 font-medium text-zinc-500">
                    {pkg.arch}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Installed
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
