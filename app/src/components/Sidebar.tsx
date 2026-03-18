import { useState } from "react";
import { NavLink } from "react-router-dom";

import {
  Home,
  Cloud,
  Server,
  Cuboid,
  Settings,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Activity,
  Layers,
  Database,
  Box,
  FileCode,
  HardDrive,
  Share2,
  Terminal,
  Monitor,
  ChevronDown,
  X,
} from "lucide-react";
import { useEnvironment } from "@/core/EnvironmentContext";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MenuItem {
  icon?: any;
  label: string;
  path?: string;
  items?: MenuItem[];
  type?: "divider" | "header" | "item";
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { selectedEnvironment, setSelectedEnvironment, isEnvironmentMode } =
    useEnvironment();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev: string[]) =>
      prev.includes(label)
        ? prev.filter((i: string) => i !== label)
        : [...prev, label],
    );
  };

  const adminMenu: MenuItem[] = [
    { type: "header", label: "Administration" },
    {
      icon: Users,
      label: "User-related",
      items: [
        { label: "Users", path: "/users" },
        { label: "Teams", path: "/teams" },
        { label: "Roles", path: "/roles" },
      ],
    },
    {
      icon: Layers,
      label: "Environment-related",
      items: [
        { icon: Cloud, label: "Environments", path: "/environments" },
        { icon: Server, label: "Server Management", path: "/servers" },
        { icon: Cuboid, label: "Applications", path: "/applications" },
        { label: "Tags", path: "/tags" },
      ],
    },
    { icon: Database, label: "Registries", path: "/registries" },
    {
      icon: Activity,
      label: "Logs",
      items: [
        { label: "Authentication", path: "/logs/auth" },
        { label: "Activity", path: "/logs/activity" },
      ],
    },
    {
      icon: Settings,
      label: "Settings",
      items: [
        { label: "General", path: "/settings/general" },
        { label: "Authentication", path: "/settings/authentication" },
        { label: "Edge Compute", path: "/settings/edge-compute" },
      ],
    },
  ];

  const environmentMenu: MenuItem[] = [
    { type: "header", label: selectedEnvironment?.name || "Environment" },
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    {
      icon: FileCode,
      label: "Templates",
      items: [
        { label: "App Templates", path: "/templates" },
        { label: "Custom Templates", path: "/templates/custom" },
      ],
    },
    { icon: Layers, label: "Stacks", path: "/stacks" },
    { icon: Box, label: "Containers", path: "/containers" },
    { icon: Monitor, label: "Images", path: "/images" },
    { icon: Share2, label: "Networks", path: "/networks" },
    { icon: HardDrive, label: "Volumes", path: "/volumes" },
    { icon: Activity, label: "Events", path: "/events" },
    {
      icon: Terminal,
      label: "Host",
      items: [
        { label: "Setup", path: "/host/setup" },
        { label: "Security", path: "/host/security" },
      ],
    },
  ];

  const currentMenu = isEnvironmentMode ? environmentMenu : adminMenu;

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-300 bg-white dark:bg-[#2e2f33] border-r border-zinc-200 dark:border-zinc-800 z-50",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        {!collapsed && (
          <NavLink to="/" className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-2xl text-zinc-900 dark:text-white whitespace-nowrap tracking-tight">
              EINFRA.iO
            </span>
          </NavLink>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {isEnvironmentMode && !collapsed && (
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-blue-50/30 dark:bg-blue-900/10 transition-colors">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Box size={14} />
            <span className="text-xs font-bold uppercase tracking-wider truncate">
              {selectedEnvironment?.name}
            </span>
          </div>
          <button
            onClick={() => setSelectedEnvironment(null)}
            className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
            title="Disconnect"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <nav
        className={cn(
          "flex-1 p-2 space-y-1 custom-scrollbar",
          collapsed ? "overflow-visible" : "overflow-y-auto",
        )}
      >
        {!isEnvironmentMode && !collapsed && (
          <NavLink
            to="/"
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded transition-all group relative mb-1",
                isActive
                  ? "bg-blue-50 dark:bg-zinc-900 text-blue-600 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white",
              )
            }
          >
            <Home
              size={14}
              className="font-bold text-zinc-600 dark:text-zinc-100"
            />
            <span className="text-sm font-semibold">Home</span>
          </NavLink>
        )}
        {currentMenu.map((item, idx) => (
          <NavItem
            key={idx}
            item={item}
            collapsed={collapsed}
            isExpanded={expandedItems.includes(item.label)}
            onToggle={() => toggleExpand(item.label)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed ? "justify-center" : "",
          )}
        >
          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
            AD
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                Administrator
              </div>
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter truncate">
                admin@einfra.io
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  item,
  collapsed,
  isExpanded,
  onToggle,
}: {
  item: MenuItem;
  collapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (item.type === "header") {
    return !collapsed ? (
      <div className="px-3 pt-4 pb-2 text-[10px] uppercase font-black text-zinc-400 dark:text-white tracking-widest">
        {item.label}
      </div>
    ) : null;
  }

  const hasItems = item.items && item.items.length > 0;
  const Icon = item.icon;

  return (
    <div className="space-y-1">
      {hasItems ? (
        <div className="relative group">
          <button
            onClick={onToggle}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded transition-all group/btn",
              "text-zinc-600 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            <div className="flex items-center gap-3">
              {Icon && (
                <Icon size={14} className="group-hover/btn:text-white" />
              )}
              {!collapsed && (
                <span className="text-sm font-semibold">{item.label}</span>
              )}
            </div>
            {!collapsed && (
              <ChevronDown
                size={12}
                className={cn(
                  "transition-transform duration-200 hover:bg-black text-white cursor-pointer p-2 rounded-full",
                  isExpanded ? "rotate-180" : "",
                )}
              />
            )}
          </button>

          {collapsed && (
            <div className="absolute left-[calc(100%+8px)] top-0 bg-[#2e2f33] border border-zinc-800 rounded-md shadow-2xl invisible group-hover:visible min-w-[200px] z-[100] py-2 overflow-hidden transition-all animate-in fade-in slide-in-from-left-2 duration-200">
              {/* Triangle pointer */}
              <div className="absolute -left-1 top-4 w-2 h-2 bg-[#2e2f33] rotate-45 border-l border-b border-zinc-800" />

              <div className="px-4 py-1.5 text-sm font-black text-white/90 border-b border-zinc-800 mb-2">
                {item.label}
              </div>
              <div className="px-1 space-y-0.5">
                {item.items?.map((sub, i) => (
                  <NavLink
                    key={i}
                    to={sub.path || "#"}
                    className={({ isActive }: { isActive: boolean }) =>
                      cn(
                        "flex items-center p-4 text-xs font-bold rounded-md transition-colors",
                        isActive
                          ? "text-white bg-blue-600/20"
                          : "text-zinc-300 hover:text-white hover:bg-white/10",
                      )
                    }
                  >
                    {sub.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <NavLink
          to={item.path || "#"}
          className={({ isActive }: { isActive: boolean }) =>
            cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded transition-all group relative",
              isActive
                ? "bg-blue-50 dark:bg-zinc-900 text-blue-600 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white",
              collapsed ? "justify-center" : "",
            )
          }
        >
          {Icon && <Icon size={14} />}
          {!collapsed && (
            <span className="text-sm font-semibold">{item.label}</span>
          )}
          {collapsed && !hasItems && (
            <div className="absolute left-[calc(100%+8px)] bg-[#2e2f33] text-white text-[10px] font-bold px-2 py-1 rounded invisible group-hover:visible whitespace-nowrap z-50 shadow-xl border border-zinc-800">
              <div className="absolute -left-1 top-1.5 w-2 h-2 bg-[#2e2f33] rotate-45 border-l border-b border-zinc-800" />
              <span className="relative z-10">{item.label}</span>
            </div>
          )}
        </NavLink>
      )}

      {hasItems && isExpanded && !collapsed && (
        <div className="pl-9 space-y-1 animate-in slide-in-from-top-1 duration-200">
          {item.items?.map((sub, idx) => (
            <NavLink
              key={idx}
              to={sub.path || "#"}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  "block px-3 py-1.5 text-xs font-semibold rounded transition-all",
                  isActive
                    ? "text-blue-600 dark:text-white bg-blue-50 dark:bg-blue-900/20"
                    : "text-zinc-500 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                )
              }
            >
              {sub.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
