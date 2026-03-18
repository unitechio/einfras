import { X, Activity, HardDrive, Cpu, Clock, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mockServerService } from "../shared/mockServerService";
import type { Service } from "../shared/mockServerService";
import { cn } from "@/lib/utils";

interface ServiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service;
}

export function ServiceDetailsModal({
  isOpen,
  onClose,
  service,
}: ServiceDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState(service.metrics);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Simulate live stats update
  useEffect(() => {
    if (!isOpen || service.status !== "active") return;

    const interval = setInterval(() => {
      setStats((prev) => {
        if (!prev) return undefined;
        return {
          ...prev,
          cpu: Math.max(0, prev.cpu + (Math.random() - 0.5)),
          memory: Math.max(10, prev.memory + (Math.random() * 10 - 5)),
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, service.status]);

  useEffect(() => {
    setStats(service.metrics);
  }, [service]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm",
                service.status === "active"
                  ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
                  : service.status === "inactive"
                    ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                    : "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600",
              )}
            >
              <Activity size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                {service.name}
                {service.bootStatus === "enabled" && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold">
                    Boot Enabled
                  </span>
                )}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {service.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
                <Cpu size={14} /> CPU Usage
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                {stats?.cpu ? `${stats.cpu.toFixed(1)}%` : "0%"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
                <HardDrive size={14} /> Memory
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                {stats?.memory ? `${stats.memory.toFixed(0)} MB` : "0 MB"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
                <Activity size={14} /> PID
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">
                {stats?.pid || "-"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
                <Clock size={14} /> Uptime
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-white">
                {stats?.uptime || "-"}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-500" />
              Configuration & Status
            </h4>
            <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <tr>
                    <td className="px-4 py-3 text-zinc-500 font-medium w-32 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50">
                      Unit File
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">
                      {service.unitFile}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-zinc-500 font-medium w-32 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50">
                      ExecStart
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">
                      {service.execStart}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-zinc-500 font-medium w-32 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50">
                      Dependencies
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {service.dependencies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {service.dependencies.map((dep) => (
                            <span
                              key={dep}
                              className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs"
                            >
                              {dep}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">
                          No dependencies
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-zinc-500 font-medium w-32 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50">
                      Open Ports
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {stats?.openPorts && stats.openPorts.length > 0 ? (
                        <div className="flex gap-2">
                          {stats.openPorts.map((port) => (
                            <span
                              key={port}
                              className="flex items-center gap-1 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                              {port}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">
                          No active ports
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
