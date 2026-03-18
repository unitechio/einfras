import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Server,
  Search,
  Grid,
  List as ListIcon,
  Filter,
  RefreshCw,
  Settings,
  Power,
  Box,
  Layers,
  Cpu,
  Activity,
  Terminal,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useServers } from "../api/useServers";
import { useServerHealthCheck } from "../api/useServerHooks";
import { Button } from "@/shared/ui/Button";

// Mock Data removed - using real data via useServers

// Reusable Filter Dropdown Component
function FilterDropdown({
  label,
  options,
}: {
  label: string;
  options: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      setSelected(selected.filter((item) => item !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm cursor-pointer  border transition-all duration-200 select-none",
          isOpen || selected.length > 0
            ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
            : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-200",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex items-center justify-center bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full w-4 h-4 text-[9px] font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown
          size={12}
          className={cn(
            "transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm cursor-pointer  shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
            {options.map((option) => (
              <div
                key={option}
                onClick={() => toggleOption(option)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer  text-xs font-medium cursor-pointer transition-colors",
                  selected.includes(option)
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    selected.includes(option)
                      ? "bg-blue-600 border-blue-600"
                      : "border-zinc-300 dark:border-zinc-600",
                  )}
                >
                  {selected.includes(option) && (
                    <Check size={10} className="text-white" />
                  )}
                </div>
                {option}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const FILTER_OPTIONS = {
  Platform: ["Linux", "Windows", "Unix", "Other"],
  "Connection Type": ["Docker Socket", "Kubernetes", "SSH Agent", "WinRM"],
  Status: ["Up", "Down", "Maintenance", "Unknown"],
  Tags: ["production", "staging", "db", "web", "worker", "gpu"],
  Groups: ["Default", "AWS-East", "On-Prem", "Azure-West"],
  "Agent Version": ["2.19.4", "2.19.3", "2.16.0", "Legacy"],
};

const ServerHealthCheckButton = ({ serverId }: { serverId: string }) => {
  const { mutate, isPending } = useServerHealthCheck();

  return (
    <button
      onClick={() => mutate(serverId)}
      disabled={isPending}
      className={cn(
        "flex items-center justify-center gap-2 px-3 py-2 rounded-sm cursor-pointer  bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold transition-colors disabled:opacity-50",
      )}
      title="Run health check"
    >
      {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />}
    </button>
  );
};

export default function ServerListPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching
  } = useServers({
    page,
    page_size: pageSize,
    search: searchTerm
  });

  const servers = data?.data || [];

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading && !isRefetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-sm font-medium text-zinc-500">Loading infrastructure nodes...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center border border-red-100 dark:border-red-900/20 shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Failed to load servers</h2>
          <p className="text-sm text-zinc-500 max-w-[300px]">Please check your backend connection or infrastructure status and try again.</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => refetch()}
          className="mt-2"
        >
          <RefreshCw size={16} className="mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (servers.length === 0 && !searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative">
          <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800/50 rounded-3xl flex items-center justify-center border border-zinc-200/50 dark:border-zinc-700/50 shadow-inner">
            <Server className="w-12 h-12 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg border border-zinc-100 dark:border-zinc-800">
            <Plus className="w-5 h-5 text-blue-500" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">No Environments Found</h2>
          <p className="text-[15px] text-zinc-500 max-w-[350px] leading-relaxed">
            Every great journey starts with a single node. Link your first server to begin monitoring your infrastructure.
          </p>
        </div>
        <Link to="/servers/add">
          <Button variant="primary" className="px-8 h-11 text-sm font-bold shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
            <Plus size={18} className="mr-2" /> Add Your First Node
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-500 text-white rounded-sm cursor-pointer  flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Server size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white leading-none mb-1">
              Environments
            </h1>
            <p className="text-xs text-zinc-500 font-medium">
              Manage server & nodes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search environments..."
              className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm cursor-pointer  pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-zinc-900 transition-all w-64 md:w-72"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={handleRefresh}
            disabled={isRefetching}
            className="bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-sm cursor-pointer  text-xs font-bold flex items-center gap-2 transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(isRefetching && "animate-spin")} />
            <span>{isRefetching ? "Syncing..." : "Sync"}</span>
          </button>

          <Link to="/servers/add">
            <button className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-sm cursor-pointer  text-xs font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95">
              <Plus size={16} />
              <span>Add Node</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          {/* Filter Groups */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <div className="flex items-center gap-2 mr-2">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-sm cursor-pointer  text-zinc-500">
                <Filter size={14} />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                Filters
              </span>
            </div>

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-2 hidden md:block" />

            {Object.entries(FILTER_OPTIONS).map(([label, options]) => (
              <FilterDropdown key={label} label={label} options={options} />
            ))}

            <button className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-2 rounded-sm cursor-pointer  transition-colors ml-auto xl:ml-2">
              Clear all
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-3 w-full xl:w-auto justify-end border-t xl:border-none border-zinc-100 dark:border-zinc-800 pt-4 xl:pt-0">
            <span className="text-xs text-zinc-400 uppercase">View</span>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-sm cursor-pointer ">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 rounded-sm cursor-pointer  transition-all flex items-center gap-2",
                  viewMode === "list"
                    ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300",
                )}
              >
                <ListIcon size={16} />
                {viewMode === "list" && (
                  <span className="text-xs font-bold pr-1">List</span>
                )}
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 rounded-sm cursor-pointer  transition-all flex items-center gap-2",
                  viewMode === "grid"
                    ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300",
                )}
              >
                <Grid size={16} />
                {viewMode === "grid" && (
                  <span className="text-xs font-bold pr-1">Grid</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {viewMode === "list" ? (
          servers.map((server) => (
            <div
              key={server.id}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-s overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-blue-200 dark:hover:border-blue-800"
            >
              {/* Main Row */}
              <div className="flex flex-col md:flex-row items-center p-5 gap-6">
                {/* Icon */}
                <div className="shrink-0 relative">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                      server.os === "linux"
                        ? "bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400"
                        : "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400",
                    )}
                  >
                    {server.os === "linux" ? (
                      <Server size={28} />
                    ) : (
                      <Terminal size={28} />
                    )}
                  </div>
                  <div
                    className={cn(
                      "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center",
                      server.status === "online" ? "bg-green-500" : server.status === "error" ? "bg-red-500" : "bg-zinc-400",
                    )}
                  >
                    {server.status === "online" ? (
                      <Check size={10} className="text-white" />
                    ) : (
                      <X size={10} className="text-white" />
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 w-full space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/servers/${server.id}/overview`}
                        className="text-lg font-bold text-zinc-900 dark:text-white hover:text-blue-600 transition-colors"
                      >
                        {server.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
                          {server.ip_address}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                      <div
                        className="flex items-center gap-1.5"
                        title="Last Updated"
                      >
                        <Activity size={14} className="text-zinc-400" />
                        {server.updated_at ? new Date(server.updated_at).toLocaleString() : "Never"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-400">Type:</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-800">
                        {server.tunnel_enabled ? "Tunnel" : "Direct SSH"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-400">OS:</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {server.os} {server.os_version}
                      </span>
                    </div>
                    {server.tags && server.tags.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-400 absolute md:static opacity-0 md:opacity-100">
                          Tags:
                        </span>
                        <div className="flex gap-1.5">
                          {server.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-zinc-50 dark:bg-zinc-800/50 w-full" />

                  {/* Metrics Stripe */}
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      <Layers size={14} className="text-zinc-400 shrink-0" />
                      <span className="whitespace-nowrap">
                        0 stacks
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      <Box size={14} className="text-zinc-400 shrink-0" />
                      <span className="text-zinc-900 dark:text-white font-bold">
                        {server.metrics?.container_count || 0}
                      </span>
                      <span className="hidden sm:inline">containers</span>
                    </div>

                    <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700 hidden md:block" />

                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      <Cpu size={14} className="text-zinc-400 shrink-0" />
                      {server.cpu_cores} Cores
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      <Activity size={14} className="text-zinc-400 shrink-0" />
                      {server.memory_gb} GB RAM
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col gap-2 border-l border-zinc-100 dark:border-zinc-800/50 pl-4 md:pl-0 md:border-none min-w-[140px]">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <ServerHealthCheckButton serverId={server.id} />
                    <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-sm cursor-pointer  bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">
                      <Settings size={14} />
                    </button>
                  </div>
                  <Link
                    to={`/servers/${server.id}/overview`}
                    className="hidden md:flex items-center justify-center gap-2 px-3 py-2 rounded-sm cursor-pointer  bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors w-full"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
            </div>
          ))
        ) : (
          // GRID MODE
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servers.map((server) => (
              <div
                key={server.id}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all p-5 flex flex-col justify-between h-full hover:border-blue-200 dark:hover:border-blue-800"
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-sm cursor-pointer  bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                          {server.os === "linux" ? (
                            <Server size={22} />
                          ) : (
                            <Terminal size={22} />
                          )}
                        </div>
                        <div
                          className={cn(
                            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900",
                            server.status === "online"
                              ? "bg-green-500"
                              : server.status === "error" ? "bg-red-500" : "bg-zinc-400",
                          )}
                        />
                      </div>
                      <div>
                        <Link
                          to={`/servers/${server.id}/overview`}
                          className="text-base font-bold text-zinc-900 dark:text-white hover:text-blue-500 transition-colors block leading-tight mb-1"
                        >
                          {server.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                          {server.ip_address}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-xs items-center p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-sm cursor-pointer ">
                      <span className="text-zinc-500 font-bold">Status</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase rounded-md",
                          server.status === "online"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : server.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {server.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-zinc-500 font-medium">CPU</span>
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                          {server.cpu_cores} Cores
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full"
                          style={{ width: "0%" }}
                        ></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-zinc-500 font-medium">
                          Memory
                        </span>
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                          {server.memory_gb} GB RAM
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full"
                          style={{ width: "0%" }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium">
                        Containers
                      </span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-green-600 font-bold">
                          {server.metrics?.container_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/servers/${server.id}/overview`}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-700 dark:text-zinc-300 py-2.5 rounded-sm cursor-pointer  text-xs font-bold flex items-center justify-center gap-2 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white"
                  >
                    <Activity size={16} /> Open Dashboard
                  </Link>
                  <ServerHealthCheckButton serverId={server.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-end gap-4 dark:border-zinc-800 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">
            Rows per page
          </span>
          <select 
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-2 py-1.5 text-xs font-bold outline-none cursor-pointer hover:border-blue-500 transition-colors"
          >
            <option value={10}>10</option>
            <option value={20}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="text-xs text-zinc-500 font-medium">
          Showing{" "}
          <span className="text-zinc-900 dark:text-white font-bold">
            1-{servers.length}
          </span>{" "}
          of {servers.length}
        </div>
        <div className="flex gap-1">
          <button 
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 disabled:opacity-50"
          >
            <ChevronDown className="rotate-90" size={16} />
          </button>
          <button 
            disabled={!data?.total || page * pageSize >= data.total}
            onClick={() => setPage(p => p + 1)}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 disabled:opacity-50"
          >
            <ChevronDown className="-rotate-90" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
