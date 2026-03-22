import { Activity, CheckCircle2, Cpu, HardDrive, Info, Power, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import type { ServiceDTO } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";

interface ServiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceDTO;
}

export function ServiceDetailsModal({ isOpen, onClose, service }: ServiceDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
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

  if (!isOpen) return null;

  const statusTone =
    service.status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30"
      : service.status === "failed"
        ? "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30"
        : "bg-zinc-100 text-zinc-700 border-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-6 py-5 dark:border-zinc-800/70 dark:bg-zinc-800/15">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{service.display_name || service.name}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Real service metadata from the control plane. Live CPU and memory for individual units will be added when the backend exposes per-service metrics.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard icon={<Activity size={16} />} label="Status" value={service.status || "unknown"} tone={statusTone} />
            <MetricCard
              icon={<Power size={16} />}
              label="Boot"
              value={service.boot_status || "unknown"}
              tone={
                service.boot_status === "enabled"
                  ? "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30"
                  : "bg-zinc-100 text-zinc-700 border-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
              }
            />
            <MetricCard icon={<Cpu size={16} />} label="PID" value={service.pid ? String(service.pid) : "-"} tone="bg-zinc-100 text-zinc-700 border-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" />
            <MetricCard icon={<HardDrive size={16} />} label="Port" value={service.port ? String(service.port) : "-"} tone="bg-zinc-100 text-zinc-700 border-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" />
          </div>

          <div className="rounded-2xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-zinc-800/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Info size={16} className="text-blue-500" />
                Service information
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-0 divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
              <DetailRow label="Name" value={service.name} mono />
              <DetailRow label="Display Name" value={service.display_name || service.name} />
              <DetailRow label="Description" value={service.description || "No description returned by the node."} />
              <DetailRow label="Status" value={service.status || "unknown"} />
              <DetailRow label="Boot Status" value={service.boot_status || "unknown"} />
              <DetailRow label="Enabled" value={service.enabled === undefined ? "unknown" : service.enabled ? "true" : "false"} />
              <DetailRow label="PID" value={service.pid ? String(service.pid) : "Not reported"} mono />
              <DetailRow label="Port" value={service.port ? String(service.port) : "Not reported"} mono />
              <DetailRow label="Config Path" value={service.config_path || "No config path available"} mono />
              <DetailRow label="Log Path" value={service.log_path || "No log path available"} mono />
              <DetailRow label="Last Checked" value={service.last_checked_at || "No timestamp reported yet"} mono />
            </dl>
          </div>

          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={16} />
              Newbie note
            </div>
            <div className="mt-2">
              If you just installed a package and do not see the expected service fields yet, run <span className="font-semibold">Refresh / Service discovery</span> from the Services page first. Some services only appear after the package post-install scripts register a system unit.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-80">{icon}{label}</div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 px-5 py-3">
      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`text-sm text-zinc-800 dark:text-zinc-200 ${mono ? "font-mono text-[12px]" : ""}`}>{value}</dd>
    </div>
  );
}
