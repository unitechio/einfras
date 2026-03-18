import { Outlet, NavLink, useParams, Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Settings, Save, Clock, Shield, Activity, ArrowLeft,
    Cpu, Users, Key, History, Network, Zap, HardDrive, Package, Info,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

export default function ServerDeepLayout() {
    const { serverId } = useParams();

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center gap-4">
                <Link to="/servers" className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <ArrowLeft size={20} className="text-zinc-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Production-DB</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm text-zinc-500">Online - 192.168.1.10</span>
                    </div>
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
                "flex items-center gap-2 px-3 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                    ? "border-blue-500 text-blue-600 dark:text-blue-400 font-bold"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
            )}
        >
            <Icon size={16} />
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
                    "flex items-center gap-2 px-3 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap h-full",
                    isActive
                        ? "border-blue-500 text-blue-600 dark:text-blue-400 font-bold"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
            >
                <Icon size={16} />
                {label}
                <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
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
                "flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors",
                isActive
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-bold"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
        >
            <Icon size={16} className="opacity-70" />
            {label}
        </NavLink>
    );
}
