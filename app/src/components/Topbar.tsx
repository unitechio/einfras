"use client";

import {
  Bell,
  Search,
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  Shield,
  ChevronDown,
  Monitor,
  ChevronRight,
  LifeBuoy,
} from "lucide-react";
import { useTheme } from "@/core/ThemeContext";
import Popover from "@/components/ui/Popover";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { useEnvironment } from "@/core/EnvironmentContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { useLocation, useNavigate } from "react-router-dom";

interface TopbarProps {
  currentPage?: string;
  onLogout?: () => void;
}

export default function Topbar({
  currentPage = "Dashboard",
  onLogout,
}: TopbarProps) {
  const { theme, toggleTheme, setTheme } = useTheme();
  const { selectedEnvironment } = useEnvironment();
  const location = useLocation();
  const navigate = useNavigate();

  const getBreadcrumbs = () => {
    const crumbs = [];

    // Base root
    if (selectedEnvironment) {
      crumbs.push({ label: "Environments", path: "/environments" });
      crumbs.push({
        label: selectedEnvironment.name,
        path: "/dashboard",
        active: location.pathname === "/dashboard",
      });

      if (
        location.pathname !== "/dashboard" &&
        location.pathname !== "/environments"
      ) {
        crumbs.push({ label: currentPage, active: true });
      }
    } else {
      crumbs.push({ label: "Administration", path: "/" });

      // If in settings, add a "Settings" link
      if (location.pathname.startsWith("/settings/")) {
        crumbs.push({ label: "Settings", path: "/settings" });
      }

      if (location.pathname !== "/") {
        crumbs.push({ label: currentPage || "Dashboard", active: true });
      }
    }

    return crumbs;
  };

  return (
    <header className="h-[52px] border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between px-6 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-40 transition-all duration-300">
      <div className="flex items-center gap-4">
        <Breadcrumb items={getBreadcrumbs()} />
      </div>

      <div className="flex items-center gap-1.5">
        {/* Search */}
        <div className="relative group hidden md:flex items-center mr-1">
          <Search className="absolute left-3 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Search resources..."
            className="pl-9 pr-12 py-2 h-8 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs font-medium transition-all w-56 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          <div className="absolute right-2.5 flex items-center gap-0.5 opacity-40 select-none">
            <kbd className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-mono border border-zinc-300 dark:border-zinc-700">
              ⌘
            </kbd>
            <kbd className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-mono border border-zinc-300 dark:border-zinc-700">
              K
            </kbd>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all active:scale-95"
          title="Toggle theme"
        >
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        {/* Notifications */}
        <Popover
          popoverId="topbar-notifications"
          trigger={
            <button className="relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all active:scale-95">
              <Bell size={15} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-600 rounded-full border-[1.5px] border-white dark:border-[#0A0A0A]" />
            </button>
          }
          content={
            <div className="w-80 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-[#111] animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Notifications
                </span>
                <button
                  onClick={() => navigate("/notifications")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium transition-colors"
                >
                  Mark all read
                </button>
              </div>
              {/* Items */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 max-h-72 overflow-y-auto">
                <div className="px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors group">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Shield
                        size={14}
                        className="text-indigo-600 dark:text-indigo-400"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none mb-1">
                        Node scaling successful
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                        Autoscaler added 3 new nodes to cluster-prod-01.
                      </p>
                      <p className="text-[10px] text-zinc-400 font-medium mt-2">
                        3 mins ago
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                <button
                  onClick={() => navigate("/notifications")}
                  className="text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 w-full text-center transition-colors py-1"
                >
                  View all notifications
                </button>
              </div>
            </div>
          }
        />

        {/* Divider */}
        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        {/* User Account Trigger */}
        <Popover
          popoverId="topbar-user-menu"
          trigger={
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all group select-none">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 text-white flex items-center justify-center font-semibold text-[11px] shadow-sm shadow-indigo-500/20 shrink-0">
                AD
              </div>
              {/* Name block — hidden on small screens */}
              <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
                  Admin
                </span>
                <span className="text-[10px] text-zinc-400 leading-none">
                  root
                </span>
              </div>
              <ChevronDown
                size={12}
                className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors hidden sm:block"
              />
            </button>
          }
          content={
            <div className="w-64 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#111] overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Identity Header */}
              <div className="p-4 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 text-white flex items-center justify-center font-semibold text-sm shrink-0 shadow-sm shadow-indigo-500/20">
                  AD
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-none truncate">
                    Admin User
                  </p>
                  <p className="text-xs text-zinc-400 leading-none mt-1 truncate">
                    admin@einfra.io
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="ml-auto shrink-0 text-[9px] font-semibold px-1.5 py-0.5 uppercase tracking-wide bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
                >
                  Root
                </Badge>
              </div>

              {/* Menu Items */}
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => navigate("/profile")}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    location.pathname === "/profile"
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                  )}
                >
                  <User
                    size={14}
                    className={cn(
                      "transition-colors shrink-0",
                      location.pathname === "/profile"
                        ? "text-indigo-500"
                        : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200",
                    )}
                  />
                  Profile & Security
                  <ChevronRight
                    size={11}
                    className={cn(
                      "ml-auto transition-all",
                      location.pathname === "/profile"
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-60",
                    )}
                  />
                </button>

                <button
                  onClick={() => navigate("/settings/general")}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    location.pathname.startsWith("/settings")
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                  )}
                >
                  <Settings
                    size={14}
                    className={cn(
                      "transition-colors shrink-0",
                      location.pathname.startsWith("/settings")
                        ? "text-amber-500"
                        : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200",
                    )}
                  />
                  Cluster Settings
                  <ChevronRight
                    size={11}
                    className={cn(
                      "ml-auto transition-all",
                      location.pathname.startsWith("/settings")
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-60",
                    )}
                  />
                </button>

                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-all group">
                  <LifeBuoy
                    size={14}
                    className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors shrink-0"
                  />
                  Documentation
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
                    Ref
                  </span>
                </button>
              </div>

              {/* Theme Switcher */}
              <div className="px-3 pb-1.5">
                <div className="flex items-center gap-1 p-1 bg-zinc-100/70 dark:bg-zinc-900/60 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                  {[
                    { id: "light", icon: Sun, title: "Light" },
                    { id: "dark", icon: Moon, title: "Dark" },
                    {
                      id: "highcontrast",
                      icon: Monitor,
                      title: "High Contrast",
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      title={m.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTheme(m.id as any);
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center py-1.5 rounded-md transition-all",
                        theme === m.id
                          ? "bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-zinc-200 dark:border-zinc-700"
                          : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                      )}
                    >
                      <m.icon size={13} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Sign Out */}
              <div className="p-1.5 pt-0 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group"
                >
                  <LogOut
                    size={14}
                    className="group-hover:rotate-12 transition-transform shrink-0"
                  />
                  Sign Out
                </button>
              </div>
            </div>
          }
        />
      </div>
    </header>
  );
}
