import { Outlet, NavLink, useParams, Link, useLocation } from "react-router-dom";
import { useServerDetail, useServerHeartbeat } from "../api/useServerHooks";
import {
    LayoutDashboard, Settings, Save, Clock, Shield, Activity, ArrowLeft,
    Cpu, Users, Key, History, Network, Zap, HardDrive, Package, Info,
    ChevronDown, Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { AgentStatusBadge } from "../components/AgentStatusBadge";

export default function ServerDeepLayout() {
    const { serverId } = useParams();
    
    // Fetch server detail
    const { data: server, isLoading } = useServerDetail(serverId || "");
    
    // Poll for status heartbeat
    useServerHeartbeat(serverId || "");

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center gap-4 bg-white dark:bg-[#121212] p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
                <Link to="/servers" className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <ArrowLeft size={18} className="text-zinc-500" />
                </Link>
                <div>
                    {isLoading ? (
                        <div className="animate-pulse">
                            <div className="h-7 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mb-2"></div>
                            <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800/50 rounded"></div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                {server?.name || "Unknown Server"}
                            </h1>
                            <div className="flex items-center gap-2 mt-1.5">
                                <div className={cn(
                                    "w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#121212]",
                                    server?.status === 'online' ? "bg-green-500 animate-pulse" :
                                    server?.status === 'offline' ? "bg-red-500" : "bg-yellow-500"
                                )} />
                                <span className="text-[13px] font-medium text-zinc-500 capitalize">
                                    {server?.status || 'Unknown'} &bull; {server?.ip_address || 'No IP'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Top Navigation */}
            <div className="border-b border-zinc-200 dark:border-zinc-800">
                <nav className="flex gap-1 overflow-visible flex-wrap" aria-label="Tabs">
                    <NavItem to={`/servers/${serverId}/overview`} icon={LayoutDashboard} label="Overview" end />

                    <NavDropdown label="System" icon={Settings} activePrefix={`/servers/${serverId}/system`}>
                        <DropdownItem to={`/servers/${serverId}/system/info`} icon={Info} label="Info" />
                        <DropdownItem to={`/servers/${serverId}/system/monitoring`} icon={Activity} label="Monitoring" />
                        <DropdownItem to={`/servers/${serverId}/system/processes`} icon={Cpu} label="Processes" />
                    </NavDropdown>

                    <NavDropdown label="Access" icon={Shield} activePrefix={`/servers/${serverId}/access`}>
                        <DropdownItem to={`/servers/${serverId}/access/users`} icon={Users} label="Users" />
                        <DropdownItem to={`/servers/${serverId}/access/ssh-keys`} icon={Key} label="SSH Keys" />
                        <DropdownItem to={`/servers/${serverId}/access/audit-logs`} icon={History} label="Audit Logs" />
                    </NavDropdown>

                    <NavItem to={`/servers/${serverId}/network`} icon={Network} label="Network" />
                    <NavItem to={`/servers/${serverId}/firewall`} icon={Shield} label="Firewall" />
                    <NavItem to={`/servers/${serverId}/services`} icon={Zap} label="Services" />
                    <NavItem to={`/servers/${serverId}/cron`} icon={Clock} label="Cron Jobs" />
                    <NavItem to={`/servers/${serverId}/backup`} icon={Save} label="Backup" />
                    <NavItem to={`/servers/${serverId}/storage`} icon={HardDrive} label="Storage" />
                    <NavItem to={`/servers/${serverId}/packages`} icon={Package} label="Packages" />
                </nav>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <Outlet />
            </div>
        </div>
    );
}

function NavItem({ to, icon: Icon, label, end }: { to: string, icon: any, label: string, end?: boolean }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) => cn(
                "flex items-center gap-2 px-4 py-3 border-b-2 text-[13px] font-semibold transition-colors whitespace-nowrap outline-none",
                isActive
                    ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700"
            )}
        >
            <Icon size={16} className={cn(({ isActive }: any) => isActive ? "opacity-100" : "opacity-70")} />
            {label}
        </NavLink>
    );
}

function NavDropdown({ label, icon: Icon, children, activePrefix }: { label: string, icon: any, children: React.ReactNode, activePrefix: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    // Check if any child route is active
    const isActive = location.pathname.startsWith(activePrefix);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-4 py-3 border-b-2 text-[13px] font-semibold transition-colors whitespace-nowrap outline-none",
                    isActive
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
            >
                <Icon size={16} className={isActive ? "opacity-100" : "opacity-70"} />
                {label}
                <ChevronDown size={14} className={cn("transition-transform opacity-50 ml-1", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 min-w-[200px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-1 animate-in fade-in zoom-in-95 duration-150">
                    <div onClick={() => setIsOpen(false)}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

function DropdownItem({ to, icon: Icon, label }: { to: string, icon: any, label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors outline-none",
                isActive
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
        >
            <Icon size={16} className="opacity-70" />
            {label}
        </NavLink>
    );
}
