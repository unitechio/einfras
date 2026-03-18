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
import { mockServerService } from "../shared/mockServerService";
import type { Service } from "../shared/mockServerService";
import { ServiceLogDrawer } from "../monitoring/ServiceLogDrawer";
import { ServiceDetailsModal } from "./ServiceDetailsModal";
import { AddServiceWizard } from "./AddServiceWizard";
// Removed Popover import
import { cn } from "@/lib/utils";

export default function ServerServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceLogs, setSelectedServiceLogs] = useState<string | null>(
    null,
  );
  const [selectedServiceDetails, setSelectedServiceDetails] =
    useState<Service | null>(null);
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

  const fetchServices = async () => {
    try {
      const data = await mockServerService.getServices();
      setServices(data);
    } catch (error) {
      console.error("Failed to fetch services", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    // Poll for status updates
    const interval = setInterval(fetchServices, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const handleAction = async (
    action: () => Promise<void>,
    serviceName: string,
    actionType: string,
  ) => {
    setActionLoading(`${serviceName}-${actionType}`);
    setActiveMenu(null); // Close menu on action
    try {
      await action();
      // Optimistic update or refetch
      await fetchServices();
    } catch (error) {
      console.error(`Failed to ${actionType} service ${serviceName}`, error);
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
    if (type === "stop") {
      handleAction(
        () => mockServerService.stopService(serviceName),
        serviceName,
        "stop",
      );
    } else {
      handleAction(
        () => mockServerService.restartService(serviceName),
        serviceName,
        "restart",
      );
    }
    setConfirmAction(null);
  };

  // Bulk Actions
  const handleBulkAction = async (
    actionType: "stop" | "restart" | "reload",
  ) => {
    // For bulk actions, we might want to confirm if any "dangerous" services are selected
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

  const executeBulkAction = async (
    actionType: "stop" | "restart" | "reload",
  ) => {
    const selectedList = Array.from(selectedServices);
    setConfirmAction(null);
    // Clear selection after action start? Maybe keep it. Let's keep it for now.

    const promises = selectedList.map((name) => {
      if (actionType === "stop")
        return handleAction(
          () => mockServerService.stopService(name),
          name,
          "stop",
        );
      if (actionType === "restart")
        return handleAction(
          () => mockServerService.restartService(name),
          name,
          "restart",
        );
      if (actionType === "reload")
        return handleAction(
          () => mockServerService.reloadService(name),
          name,
          "reload",
        );
    });

    await Promise.all(promises);
    setSelectedServices(new Set()); // Clear selection after completion
  };

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            System Services
            {isLoading && (
              <RefreshCcw size={16} className="animate-spin text-zinc-400" />
            )}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage system daemons, view logs, and monitor health.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={18} /> Add Service
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden transition-all">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/20 text-zinc-500 text-xs uppercase font-bold tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 w-12 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {isAllSelected ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : isIndeterminate ? (
                      <MinusSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">Service Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Boot</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading && services.length === 0
                ? // Skeleton Loader
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-5 w-5 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-48"></div>
                    </td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                    </td>
                  </tr>
                ))
                : services.map((service) => (
                  <tr
                    key={service.name}
                    onClick={(e) => {
                      // Allow clicking row to select, but not if clicking buttons
                      if ((e.target as HTMLElement).closest("button")) return;
                      toggleSelect(service.name);
                    }}
                    className={cn(
                      "group transition-colors cursor-pointer",
                      selectedServices.has(service.name)
                        ? "bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
                    )}
                  >
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(service.name);
                        }}
                        className={cn(
                          "flex items-center justify-center transition-colors",
                          selectedServices.has(service.name)
                            ? "text-blue-600"
                            : "text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400",
                        )}
                      >
                        {selectedServices.has(service.name) ? (
                          <CheckSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 dark:text-white">
                        {service.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm",
                          service.status === "active"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                            : service.status === "inactive"
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            service.status === "active"
                              ? "bg-green-500 animate-pulse"
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
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {service.bootStatus === "enabled" ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-md border border-green-100 dark:border-green-900/20">
                            <CheckCircle2 size={12} />
                            Enabled
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
                            <XCircle size={12} />
                            Disabled
                          </div>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 max-w-[300px] truncate"
                      title={service.description}
                    >
                      {service.description}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <div className="flex items-center justify-end gap-2 opacity-100">
                        {/* Primary Actions */}
                        {service.status === "active" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmAndExecute("stop", service.name);
                            }}
                            disabled={!!actionLoading}
                            className="p-2 rounded-lg bg-white dark:bg-zinc-800 cursor-pointer border border-zinc-200 dark:border-zinc-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-all shadow-sm active:scale-95"
                            title="Stop Service"
                          >
                            {actionLoading === `${service.name}-stop` ? (
                              <RefreshCcw
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Square size={16} fill="currentColor" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(
                                () =>
                                  mockServerService.startService(
                                    service.name,
                                  ),
                                service.name,
                                "start",
                              );
                            }}
                            disabled={!!actionLoading}
                            className="p-2 rounded-lg bg-white dark:bg-zinc-800 cursor-pointer border border-zinc-200 dark:border-zinc-700 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-800 transition-all shadow-sm active:scale-95"
                            title="Start Service"
                          >
                            {actionLoading === `${service.name}-start` ? (
                              <RefreshCcw
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Play size={16} fill="currentColor" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmAndExecute("restart", service.name);
                          }}
                          disabled={!!actionLoading}
                          className="p-2 rounded-lg bg-white dark:bg-zinc-800 border cursor-pointer border-zinc-200 dark:border-zinc-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 transition-all shadow-sm active:scale-95"
                          title="Restart Service"
                        >
                          {actionLoading === `${service.name}-restart` ? (
                            <RefreshCcw size={16} className="animate-spin" />
                          ) : (
                            <RotateCw size={16} />
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedServiceLogs(service.name);
                          }}
                          className="p-2 rounded-lg bg-white dark:bg-zinc-800 cursor-pointer border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all shadow-sm active:scale-95"
                          title="View Logs"
                        >
                          <FileText size={16} />
                        </button>

                        {/* Secondary Actions Dropdown */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === service.name ? null : service.name);
                            }}
                            className={cn(
                              "p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors active:scale-95",
                              activeMenu === service.name ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" : ""
                            )}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenu === service.name && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 p-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setSelectedServiceDetails(service);
                                  setActiveMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                              >
                                <Info size={14} /> View Details
                              </button>
                              <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                              <button
                                onClick={() =>
                                  handleAction(
                                    () =>
                                      mockServerService.reloadService(
                                        service.name,
                                      ),
                                    service.name,
                                    "reload",
                                  )
                                }
                                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                              >
                                <RefreshCcw size={14} /> Reload
                              </button>

                              {service.bootStatus === "disabled" ? (
                                <button
                                  onClick={() =>
                                    handleAction(
                                      () =>
                                        mockServerService.enableService(
                                          service.name,
                                        ),
                                      service.name,
                                      "enable",
                                    )
                                  }
                                  className="flex w-full items-center gap-2 px-2 py-1.5 cursor-pointer text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                                >
                                  <Power size={14} /> Enable on boot
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleAction(
                                      () =>
                                        mockServerService.disableService(
                                          service.name,
                                        ),
                                      service.name,
                                      "disable",
                                    )
                                  }
                                  className="flex w-full items-center gap-2 px-2 py-1.5 cursor-pointer text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                                >
                                  <Power size={14} /> Disable on boot
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedServices.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-2 py-2 rounded-full shadow-2xl border border-zinc-700 dark:border-zinc-200 z-50 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3 pl-4 pr-3 border-r border-zinc-700 dark:border-zinc-200/50 mr-2">
            <div className="flex items-center justify-center w-6 h-6 bg-blue-600 rounded-full text-[10px] font-bold">
              {selectedServices.size}
            </div>
            <span className="text-sm font-medium whitespace-nowrap">
              Selected
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleBulkAction("restart")}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-lg transition-colors text-sm font-medium"
            >
              <RotateCw size={14} /> Restart
            </button>
            <button
              onClick={() => handleBulkAction("stop")}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-900/50 dark:hover:bg-red-50 text-red-400 dark:text-red-500 rounded-lg transition-colors text-sm font-medium"
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
            <button
              onClick={() => handleBulkAction("reload")}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCcw size={14} /> Reload
            </button>
          </div>

          <div className="w-px h-6 bg-zinc-700 dark:bg-zinc-200/50 mx-2" />

          <button
            onClick={() => setSelectedServices(new Set())}
            className="p-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-full transition-colors"
            title="Clear Selection"
          >
            <XCircle size={18} className="text-zinc-500" />
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
      <AddServiceWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
      />

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <ShieldAlert size={24} />
              </div>
              <h3 className="text-lg font-bold">Confirm Action</h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {confirmAction.type.startsWith("bulk") ? (
                <>
                  Are you sure you want to{" "}
                  <span className="font-bold text-zinc-900 dark:text-white uppercase">
                    {confirmAction.type.replace("bulk-", "")}
                  </span>{" "}
                  {selectedServices.size} services?
                  <span className="block mt-2 text-red-500 text-sm font-medium flex items-center gap-1">
                    <AlertTriangle size={14} /> Warning: This includes critical
                    services like{" "}
                    {Array.from(selectedServices).find((s) =>
                      ["mysql", "ssh", "postgresql"].includes(s),
                    )}
                    .
                  </span>
                </>
              ) : (
                <>
                  Are you sure you want to{" "}
                  <span className="font-bold text-zinc-900 dark:text-white uppercase">
                    {confirmAction.type}
                  </span>{" "}
                  the service{" "}
                  <span className="font-bold text-zinc-900 dark:text-white font-mono">
                    {confirmAction.service}
                  </span>
                  ?
                  {["mysql", "postgresql"].includes(confirmAction.service) &&
                    confirmAction.type === "stop" && (
                      <span className="block mt-2 text-red-500 text-sm font-medium flex items-center gap-1">
                        <AlertTriangle size={14} /> Warning: This may affect
                        dependent applications.
                      </span>
                    )}
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type.startsWith("bulk")) {
                    executeBulkAction(
                      confirmAction.type.replace("bulk-", "") as any,
                    );
                  } else {
                    executeAction(
                      confirmAction.type as any,
                      confirmAction.service,
                    );
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
