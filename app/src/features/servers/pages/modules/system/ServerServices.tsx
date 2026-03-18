import {
  Play,
  Square,
  RotateCw,
  FileText,
  Info,
  MoreVertical,
  RefreshCcw,
  Power,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Plus,
  CheckSquare,
  MinusSquare,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useServerServices, useServiceAction } from "../../../api/useServerHooks";
import { ServiceLogDrawer } from "../monitoring/ServiceLogDrawer";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import { AddServiceWizard } from "./AddServiceWizard";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

export default function ServerServices() {
  const { serverId } = useParams<{ serverId: string }>();

  // Real Hooks
  const {
    data: servicesData,
    isLoading,
    refetch,
  } = useServerServices(serverId || "");

  const { mutateAsync: serviceAction } = useServiceAction(serverId || "");

  const services = servicesData || [];

  const [selectedServiceLogs, setSelectedServiceLogs] = useState<string | null>(
    null,
  );
  const [selectedServiceDetails, setSelectedServiceDetails] =
    useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Active Menu State
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Bulk Selection State
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(),
  );

  // Confirmation State
  const [confirmAction, setConfirmAction] = useState<{
    type: "stop" | "restart" | "bulk-stop" | "bulk-restart" | "bulk-reload";
    service: string; // 'bulk' for bulk actions
    isOpen: boolean;
  } | null>(null);

  const handleAction = async (
    action: "start" | "stop" | "restart" | "reload" | "enable" | "disable",
    serviceName: string,
  ) => {
    setActionLoading(`${serviceName}-${action}`);
    setActiveMenu(null);
    try {
      await serviceAction({ name: serviceName, action });
    } catch (error) {
      console.error(`Failed to ${action} service ${serviceName}`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmAndExecute = (type: "stop" | "restart", service: string) => {
    setActiveMenu(null);
    if (["mysql", "ssh", "postgresql", "docker", "nginx"].includes(service)) {
      setConfirmAction({ type, service, isOpen: true });
    } else {
      executeAction(type, service);
    }
  };

  const executeAction = (type: "stop" | "restart", serviceName: string) => {
    handleAction(type, serviceName);
    setConfirmAction(null);
  };

  const executeBulkAction = async (
    actionType: "stop" | "restart" | "reload",
  ) => {
    const selectedList = Array.from(selectedServices);
    setConfirmAction(null);
    const promises = selectedList.map((name) =>
      handleAction(actionType as any, name),
    );
    await Promise.all(promises);
    setSelectedServices(new Set());
  };

  const handleBulkAction = async (
    actionType: "stop" | "restart" | "reload",
  ) => {
    const selectedList = Array.from(selectedServices);
    const hasDangerous = selectedList.some((s) =>
      ["mysql", "ssh", "postgresql", "docker"].includes(s),
    );

    if (hasDangerous && (actionType === "stop" || actionType === "restart")) {
      setConfirmAction({
        type: `bulk-${actionType}` as any,
        service: "bulk",
        isOpen: true,
      });
      return;
    }

    await executeBulkAction(actionType);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Selection Logic
  const toggleSelectAll = () => {
    if (selectedServices.size === services.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(services.map((s) => s.name)));
    }
  };

  const toggleSelect = (name: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedServices(newSelected);
  };

  const isAllSelected =
    services.length > 0 && selectedServices.size === services.length;
  const isIndeterminate =
    selectedServices.size > 0 && selectedServices.size < services.length;

  return (
    <div className="space-y-6 relative pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            System Services
            {isLoading && (
              <RefreshCcw size={16} className="animate-spin text-zinc-400" />
            )}
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
            Manage system daemons, view logs, and monitor health.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowWizard(true)}
          className="shadow-sm"
        >
          <Plus size={16} className="mr-2" /> Add Service
        </Button>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden transition-all">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {isAllSelected ? (
                      <CheckSquare size={16} className="text-purple-600 dark:text-purple-400" />
                    ) : isIndeterminate ? (
                      <MinusSquare size={16} className="text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </TableHead>
                <TableHead>Service Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Boot</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && services.length === 0
                ? [
                    // Skeleton Loader
                    ...Array(5),
                  ].map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell>
                        <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto"></div>
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div>
                      </TableCell>
                      <TableCell>
                        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full w-20"></div>
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div>
                      </TableCell>
                      <TableCell>
                        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-48"></div>
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <div className="h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                      </TableCell>
                    </TableRow>
                  ))
                : services.map((service) => (
                    <TableRow
                      key={service.name}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button")) return;
                        toggleSelect(service.name);
                      }}
                      className={cn(
                        "group transition-colors cursor-pointer",
                        selectedServices.has(service.name)
                          ? "bg-purple-50/50 dark:bg-purple-900/10 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
                      )}
                    >
                      <TableCell className="text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(service.name);
                          }}
                          className={cn(
                            "flex items-center justify-center transition-colors",
                            selectedServices.has(service.name)
                              ? "text-purple-600 dark:text-purple-400"
                              : "text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400",
                          )}
                        >
                          {selectedServices.has(service.name) ? (
                            <CheckSquare size={16} />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {service.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border shadow-sm",
                            service.status === "active"
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50"
                              : service.status === "inactive"
                                ? "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-800/50",
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              service.status === "active"
                                ? "bg-emerald-500 animate-pulse"
                                : service.status === "inactive"
                                  ? "bg-zinc-400"
                                  : "bg-red-500",
                            )}
                          ></span>
                          {service.status === "active"
                            ? "Active"
                            : service.status === "inactive"
                              ? "Inactive"
                              : "Failed"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {service.boot_status === "enabled" ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 px-2.5 py-1 rounded border border-emerald-100/50 dark:border-emerald-900/30">
                              <CheckCircle2 size={12} />
                              Enabled
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1 rounded border border-zinc-200/50 dark:border-zinc-700/50">
                              <XCircle size={12} />
                              Disabled
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 max-w-[250px] truncate"
                        title={service.description}
                      >
                        {service.description}
                      </TableCell>
                      <TableCell className="text-right relative">
                        <div className="flex items-center justify-end gap-1 opacity-100">
                          {/* Primary Actions */}
                          {service.status === "active" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmAndExecute("stop", service.name);
                              }}
                              disabled={!!actionLoading}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              title="Stop Service"
                            >
                              {actionLoading === `${service.name}-stop` ? (
                                <RefreshCcw size={14} className="animate-spin" />
                              ) : (
                                <Square size={14} fill="currentColor" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction("start", service.name);
                              }}
                              disabled={!!actionLoading}
                              className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                              title="Start Service"
                            >
                              {actionLoading === `${service.name}-start` ? (
                                <RefreshCcw size={14} className="animate-spin" />
                              ) : (
                                <Play size={14} fill="currentColor" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmAndExecute("restart", service.name);
                            }}
                            disabled={!!actionLoading}
                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                            title="Restart Service"
                          >
                            {actionLoading === `${service.name}-restart` ? (
                              <RefreshCcw size={14} className="animate-spin" />
                            ) : (
                              <RotateCw size={14} />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedServiceLogs(service.name);
                            }}
                            className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                            title="View Logs"
                          >
                            <FileText size={14} />
                          </Button>

                          {/* Secondary Actions Dropdown */}
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(activeMenu === service.name ? null : service.name);
                              }}
                              className={cn(
                                "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800",
                                activeMenu === service.name
                                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                  : "",
                              )}
                            >
                              <MoreVertical size={14} />
                            </Button>

                            {activeMenu === service.name && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1A1A1A] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 p-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    setSelectedServiceDetails(service);
                                    setActiveMenu(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] font-medium rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                                >
                                  <Info size={14} className="text-zinc-400" /> View Details
                                </button>
                                <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800/60" />
                                <button
                                  onClick={() => handleAction("reload", service.name)}
                                  className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] font-medium cursor-pointer rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                                >
                                  <RefreshCcw size={14} className="text-zinc-400" /> Reload
                                </button>

                                {service.boot_status === "disabled" ? (
                                  <button
                                    onClick={() => handleAction("enable", service.name)}
                                    className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] cursor-pointer font-medium rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                                  >
                                    <Power size={14} className="text-zinc-400" /> Enable on boot
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleAction("disable", service.name)}
                                    className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] cursor-pointer font-medium rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                                  >
                                    <Power size={14} className="text-zinc-400" /> Disable on boot
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedServices.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-[#121212] dark:bg-white text-zinc-100 dark:text-zinc-900 px-2.5 py-2.5 rounded-full shadow-2xl border border-zinc-800 dark:border-zinc-200 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 pl-3 pr-4 border-r border-zinc-800 dark:border-zinc-200/50 mr-2">
            <div className="flex items-center justify-center w-6 h-6 bg-purple-600 text-white dark:bg-zinc-900 dark:text-white rounded-full text-[12px] font-bold shadow-sm">
              {selectedServices.size}
            </div>
            <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap opacity-90">
              Selected
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction("restart")}
              className="hover:bg-zinc-800 dark:hover:bg-zinc-100 text-zinc-300 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 font-medium"
            >
              <RotateCw size={14} className="mr-1.5" /> Restart
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction("stop")}
              className="hover:bg-red-500/20 text-red-400 hover:text-red-300 dark:hover:bg-red-50 dark:text-red-600 font-medium border-none"
            >
              <Square size={14} fill="currentColor" className="mr-1.5" /> Stop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkAction("reload")}
              className="hover:bg-zinc-800 dark:hover:bg-zinc-100 text-zinc-300 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 font-medium"
            >
              <RefreshCcw size={14} className="mr-1.5" /> Reload
            </Button>
          </div>

          <div className="w-px h-6 bg-zinc-800 dark:bg-zinc-200/50 mx-3" />

          <button
            onClick={() => setSelectedServices(new Set())}
            className="p-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-full transition-colors opacity-80 hover:opacity-100 mr-1"
            title="Clear Selection"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}

      {/* Log Drawer */}
      {selectedServiceLogs && (
        <ServiceLogDrawer
          isOpen={!!selectedServiceLogs}
          onClose={() => setSelectedServiceLogs(null)}
          serviceName={selectedServiceLogs}
        />
      )}

      {/* Details Modal */}
      {selectedServiceDetails && (
        <ServiceDetailsModal
          isOpen={!!selectedServiceDetails}
          onClose={() => setSelectedServiceDetails(null)}
          service={selectedServiceDetails}
        />
      )}

      {/* Add Service Wizard */}
      <AddServiceWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#121212] rounded-2xl shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl border border-red-100 dark:border-red-900/50">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Confirm Action
              </h3>
            </div>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              {confirmAction.type.startsWith("bulk") ? (
                <>
                  Are you sure you want to{" "}
                  <span className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    {confirmAction.type.replace("bulk-", "")}
                  </span>{" "}
                  {selectedServices.size} services?
                  <span className="block mt-3 text-red-500 font-semibold flex items-start gap-1.5 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/20">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      Warning: This includes critical services like{" "}
                      {Array.from(selectedServices).find((s) =>
                        ["mysql", "ssh", "postgresql", "docker"].includes(s),
                      )}
                      .
                    </span>
                  </span>
                </>
              ) : (
                <>
                  Are you sure you want to{" "}
                  <span className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    {confirmAction.type}
                  </span>{" "}
                  the service{" "}
                  <span className="font-mono font-medium text-zinc-900 dark:text-white px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                    {confirmAction.service}
                  </span>
                  ?
                  {["mysql", "postgresql", "docker"].includes(confirmAction.service) &&
                    confirmAction.type === "stop" && (
                      <span className="block mt-3 text-red-500 font-semibold flex items-center gap-1.5 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/20">
                        <AlertTriangle size={16} /> Warning: This may affect dependent applications.
                      </span>
                    )}
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20"
                onClick={() => {
                  if (confirmAction.type.startsWith("bulk")) {
                    executeBulkAction(confirmAction.type.replace("bulk-", "") as any);
                  } else {
                    executeAction(confirmAction.type as any, confirmAction.service);
                  }
                }}
              >
                Confirm Action
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
