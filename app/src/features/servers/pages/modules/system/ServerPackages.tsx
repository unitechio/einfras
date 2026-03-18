import { useState, useEffect } from "react";
import { mockSecurityService } from "../shared/mockServerService";
import { Package, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Installed Packages
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
            Manage system packages and updates.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={loadPackages}
          className="shadow-sm"
        >
          <RefreshCw size={16} className={loading ? "animate-spin mr-2" : "mr-2"} />
          Check Updates
        </Button>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden transition-all">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Architecture</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">
                  Loading packages...
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg: any) => (
                <TableRow
                  key={pkg.name}
                  className="group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg text-zinc-500">
                        <Package size={16} />
                      </div>
                      <span className="font-semibold text-[14px] text-zinc-900 dark:text-zinc-100">{pkg.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[13px] text-zinc-600 dark:text-zinc-400 w-[200px]">
                    {pkg.version}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium text-zinc-500 w-[150px]">
                    {pkg.arch}
                  </TableCell>
                  <TableCell className="w-[150px]">
                    <Badge variant="success">Installed</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
