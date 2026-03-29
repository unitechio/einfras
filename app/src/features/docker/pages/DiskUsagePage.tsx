import { useMemo } from "react";
import { HardDrive, Info, Trash2, RefreshCw } from "lucide-react";
import { useDockerDiskUsage } from "../api/useDockerHooks";
import { useEnvironment } from "@/core/EnvironmentContext";
import { Card } from "@/shared/ui/Card";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/Table";

export default function DiskUsagePage() {
  const { selectedEnvironment } = useEnvironment();
  const { data, isLoading, refetch, isFetching } = useDockerDiskUsage(
    selectedEnvironment?.id || ""
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "kB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const donutData = useMemo(() => {
    if (!data?.objects) return [];
    
    const colors: Record<string, string> = {
      Images: "#10b981", // emerald-500
      Containers: "#3b82f6", // blue-500
      "Local Volumes": "#f59e0b", // amber-500
      "Build Cache": "#8b5cf6", // violet-500
      Dangling: "#94a3b8", // slate-400
    };

    let total = data.total_size || 0;
    if (total === 0) return [];

    let currentAngle = 0;
    return data.objects.map((obj) => {
      const percentage = (obj.size / total) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return {
        ...obj,
        percentage,
        color: colors[obj.type] || "#cbd5e1",
        startAngle,
        endAngle: currentAngle,
      };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Disk Usage
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Optimize your disk space by removing unused objects from the Docker engine.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-8 flex flex-col items-center justify-center min-h-[400px]">
          <div className="relative w-64 h-64">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {donutData.length === 0 ? (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-zinc-100 dark:text-zinc-800"
                />
              ) : (
                donutData.map((obj, i) => {
                  const r = 40;
                  const c = 2 * Math.PI * r;
                  const offset = (obj.startAngle / 360) * c;
                  const dash = (obj.percentage / 100) * c;
                  
                  return (
                    <circle
                      key={i}
                      cx="50"
                      cy="50"
                      r={r}
                      fill="none"
                      stroke={obj.color}
                      strokeWidth="12"
                      strokeDasharray={`${dash} ${c - dash}`}
                      strokeDashoffset={-offset}
                      className="transition-all duration-1000"
                    />
                  );
                })
              )}
              <circle
                cx="50"
                cy="50"
                r="30"
                className="fill-white dark:fill-zinc-900"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-zinc-500 uppercase font-medium">Total Size</span>
              <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                {formatBytes(data?.total_size || 0)}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-6">
            {donutData.map((obj, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: obj.color }}
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {obj.type}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatBytes(obj.size)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-center items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
            <HardDrive className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <span className="text-3xl font-bold text-zinc-900 dark:text-white">
              {formatBytes(data?.reclaimable || 0)}
            </span>
            <p className="text-sm text-zinc-500 mt-1 font-medium">
              ≈ Reclaimable space
            </p>
          </div>
          <p className="text-xs text-zinc-400 max-w-[200px]">
            Removing unused containers, images, and networks can free up significant disk space.
          </p>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
            <Trash2 className="w-4 h-4 mr-2" />
            Reclaim space
          </Button>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Objects</TableHead>
              <TableHead>Total Count</TableHead>
              <TableHead>Active Count</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Est. Reclaimable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.objects || []).map((obj, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                  {obj.type}
                </TableCell>
                <TableCell>{obj.total_count}</TableCell>
                <TableCell>{obj.active_count}</TableCell>
                <TableCell className="font-mono text-xs">
                  {formatBytes(obj.size)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {formatBytes(obj.reclaimable)}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {obj.reclaim_pct}%
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-zinc-50/50 dark:bg-white/5 font-semibold">
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="font-mono text-xs">
                {formatBytes(data?.total_size || 0)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {formatBytes(data?.reclaimable || 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/5">
        <Info className="w-5 h-5 text-blue-500 mt-0.5" />
        <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">About Reclaimable Space</p>
          Space is reclaimable from unused images (dangling or not used by any container), 
          stopped containers, and volumes not attached to any container. 
          Running 'Reclaim space' will execute a safe system prune to remove these objects.
        </div>
      </div>
    </div>
  );
}
