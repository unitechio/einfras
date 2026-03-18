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
  type?: "header";
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { selectedEnvironment, setSelectedEnvironment, isEnvironmentMode } =
    useEnvironment();
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (key: string) => {
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key],
    );
  };

  const adminMenu: MenuItem[] = [
    { type: "header", label: "Administration" },
    {
      icon: Users,
      label: "Users",
      items: [
        { label: "Users", path: "/users" },
        { label: "Teams", path: "/teams" },
        { label: "Roles", path: "/roles" },
      ],
    },
    {
      icon: Layers,
      label: "Infrastructure",
      items: [
        { icon: Cloud, label: "Environments", path: "/environments" },
        { icon: Server, label: "Servers", path: "/servers" },
        { icon: Cuboid, label: "Applications", path: "/applications" },
        { label: "Tags", path: "/tags" },
      ],
    },
    { icon: Database, label: "Registries", path: "/registries" },
    {
      icon: Activity,
      label: "Logs",
      items: [
        { label: "Auth Logs", path: "/logs/auth" },
        { label: "Activity Logs", path: "/logs/activity" },
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

  const envMenu: MenuItem[] = [
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
  ];

  const menu = isEnvironmentMode ? envMenu : adminMenu;

  return (
    <aside
      className={cn(
        "h-screen flex flex-col transition-all duration-300",
        "bg-white/70 dark:bg-[#0f1115]/80 backdrop-blur-xl",
        "border-r border-zinc-200/50 dark:border-white/5",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* HEADER */}
      <div className="h-14 px-4 flex items-center justify-between">
        {!collapsed && (
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">
              EINFRA
            </span>
          </NavLink>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ENV BAR */}
      {isEnvironmentMode && !collapsed && (
        <div className="px-4 py-2 text-xs text-blue-500 flex justify-between items-center">
          {selectedEnvironment?.name}
          <X
            size={14}
            className="cursor-pointer"
            onClick={() => setSelectedEnvironment(null)}
          />
        </div>
      )}

      {/* NAV */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {menu.map((item, idx) => (
          <NavItem
            key={idx}
            item={item}
            collapsed={collapsed}
            expanded={expanded.includes(item.label)}
            onToggle={() => toggle(item.label)}
          />
        ))}
      </nav>

      {/* FOOTER */}
      <div className="p-3 border-t border-zinc-200/50 dark:border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
            AD
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                Admin
              </div>
              <div className="text-xs text-zinc-400">admin@einfra.io</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item, collapsed, expanded, onToggle }: any) {
  if (item.type === "header") {
    return !collapsed ? (
      <div className="px-3 pt-4 pb-2 text-xs text-zinc-400 uppercase">
        {item.label}
      </div>
    ) : null;
  }

  const Icon = item.icon;
  const hasChildren = item.items;

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path || "#"}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition",
            isActive
              ? "bg-blue-500/10 text-blue-600 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
            "hover:bg-zinc-100/60 dark:hover:bg-white/5",
            collapsed && "justify-center",
          )
        }
      >
        {Icon && <Icon size={16} />}
        {!collapsed && <span className="text-sm">{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2.5 rounded-xl",
          "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
          "hover:bg-zinc-100/60 dark:hover:bg-white/5",
          collapsed && "justify-center",
        )}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon size={16} />}
          {!collapsed && <span className="text-sm">{item.label}</span>}
        </div>

        {!collapsed && (
          <ChevronDown
            size={14}
            className={cn("transition", expanded && "rotate-180")}
          />
        )}
      </button>

      {!collapsed && (
        <div
          className={cn(
            "pl-9 overflow-hidden transition-all duration-300",
            expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {item.items.map((sub: any, i: number) => (
            <NavLink
              key={i}
              to={sub.path}
              className={({ isActive }) =>
                cn(
                  "block px-3 py-1.5 text-sm rounded-md",
                  isActive
                    ? "text-blue-600 dark:text-white bg-blue-500/10"
                    : "text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
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
