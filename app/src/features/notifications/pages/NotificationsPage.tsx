"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  X,
  Filter,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  Inbox,
  Settings,
  User,
  Activity,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";
import { useNotification } from "@/core/NotificationContext";

// Giả lập danh sách notifications thực tế
const mockNotifications = [
  {
    id: "notif_1",
    title: "Node scaling successful",
    description:
      "Autoscaler added 3 new nodes to cluster-prod-01 to handle load spikes.",
    time: "3 mins ago",
    read: false,
    type: "system",
    icon: Shield,
    color: "indigo",
  },
  {
    id: "notif_2",
    title: "Security Audit Required",
    description:
      "Scheduled quarterly security audit is pending for review. Please check the IAM roles.",
    time: "2 hours ago",
    read: false,
    type: "security",
    icon: AlertTriangle,
    color: "amber",
  },
  {
    id: "notif_3",
    title: "Database Backup Completed",
    description:
      "Daily snapshot of pg-main-cluster completed in 14 minutes without errors.",
    time: "Yesterday, 14:00",
    read: true,
    type: "system",
    icon: CheckCircle2,
    color: "emerald",
  },
  {
    id: "notif_4",
    title: "New Team Member Joined",
    description:
      "Sarah Jenkins has accepted the invitation and joined the DevSecOps team.",
    time: "Yesterday, 09:30",
    read: true,
    type: "user",
    icon: User,
    color: "blue",
  },
  {
    id: "notif_5",
    title: "API Rate limits approaching",
    description:
      "Project 'Alpha' has consumed 85% of its monthly API rate limits.",
    time: "Oct 12, 16:45",
    read: true,
    type: "alert",
    icon: Activity,
    color: "red",
  },
  {
    id: "notif_6",
    title: "Deployment Successful",
    description:
      "Auth Service v2.4.1 has been successfully deployed to the European region.",
    time: "Oct 11, 10:15",
    read: true,
    type: "system",
    icon: Globe,
    color: "indigo",
  },
];

export default function NotificationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unread" | "system" | "security"
  >("all");
  const { showNotification } = useNotification();

  // Giả lập state nội bộ để mark-as-read/delete
  const [notifications, setNotifications] = useState(mockNotifications);

  const filteredNotifications = notifications.filter((notif) => {
    const matchesSearch =
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filter === "all"
        ? true
        : filter === "unread"
          ? !notif.read
          : notif.type === filter;

    return matchesSearch && matchesFilter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    showNotification({
      type: "success",
      message: "All clear",
      description: "All notifications have been marked as read.",
    });
  };

  const markAsRead = (id: string, currentReadState: boolean) => {
    if (currentReadState) return;
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering markAsRead
    setNotifications(notifications.filter((n) => n.id !== id));
    showNotification({
      type: "info",
      message: "Notification removed",
    });
  };

  const clearAll = () => {
    setNotifications([]);
    showNotification({
      type: "success",
      message: "Inbox empty",
      description: "All notifications were permanently deleted.",
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Bell className="h-6 w-6 text-indigo-500" />
            Inbox & Notifications
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Stay updated on infrastructure events, security alerts, and system
            health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md">
            <Settings className="h-4 w-4 mr-2 text-zinc-400" />
            Preferences
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <Check className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>
      </div>

      {/* Layout Grid: Sidebar + Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Sidebar Cards */}
        <div className="md:col-span-1 space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm">
            <div className="mb-2 px-2 pt-1">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Views
              </h3>
            </div>
            <div className="space-y-1">
              {[
                { id: "all", label: "All Activity", icon: Inbox },
                {
                  id: "unread",
                  label: "Unread",
                  icon: Bell,
                  badge: unreadCount,
                },
                { id: "system", label: "System Events", icon: Shield },
                { id: "security", label: "Security", icon: AlertTriangle },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    filter === f.id
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <f.icon
                      size={14}
                      className={cn(
                        "transition-colors",
                        filter === f.id
                          ? "text-indigo-500 dark:text-indigo-400"
                          : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300",
                      )}
                    />
                    {f.label}
                  </span>
                  {f.badge !== undefined && f.badge > 0 && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 border-0 h-5 flex items-center justify-center font-bold",
                        filter === f.id
                          ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                          : "bg-blue-600 text-white",
                      )}
                    >
                      {f.badge}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
            <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
              Maintenance
            </h4>
            <Button
              variant="outline"
              size="md"
              className="w-full text-red-600 border-dashed dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-900/50"
              onClick={clearAll}
              disabled={notifications.length === 0}
            >
              <Trash2 size={13} className="mr-2" />
              Clear All Logs
            </Button>
          </div>
        </div>

        {/* Main List */}
        <div className="md:col-span-3">
          <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            {/* List Toolbar */}
            <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#121212] flex items-center justify-between gap-4">
              <div className="relative flex items-center w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 gap-2 transition-colors focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10">
                <Search size={13} className="text-zinc-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search in notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-[13px] text-zinc-700 dark:text-zinc-300 w-full placeholder:text-zinc-400 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg h-8 w-8"
                >
                  <Filter size={14} />
                </Button>
              </div>
            </div>

            {/* List Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 text-center h-full">
                  <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mb-4 text-zinc-300 dark:text-zinc-700">
                    <Inbox size={28} />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
                    Catch up on everything!
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
                    You have no new notifications right now. Enjoy your peaceful
                    inbox.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const Icon = n.icon;

                  // Assign colors dynamically based on icon types
                  let bgClass =
                    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
                  let textClass = "text-zinc-900 dark:text-white";
                  let activeBg = "bg-white dark:bg-[#121212]";

                  if (n.color === "indigo")
                    bgClass =
                      "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
                  if (n.color === "emerald")
                    bgClass =
                      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                  if (n.color === "amber")
                    bgClass =
                      "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400";
                  if (n.color === "red")
                    bgClass =
                      "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400";
                  if (n.color === "blue")
                    bgClass =
                      "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400";

                  if (!n.read)
                    activeBg = "bg-blue-50/30 dark:bg-blue-500-[0.02]";

                  return (
                    <div
                      key={n.id}
                      // Handle marking as read via click
                      onClick={() => markAsRead(n.id, n.read)}
                      className={cn(
                        "p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group relative cursor-pointer",
                        activeBg,
                      )}
                    >
                      {/* Unread indicator line */}
                      {!n.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 dark:bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                      )}

                      <div className="flex gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-transparent shadow-sm",
                            bgClass,
                            n.color === "amber" &&
                              !n.read &&
                              "border-amber-200 dark:border-amber-900/50 shadow-amber-500/10",
                          )}
                        >
                          <Icon size={18} strokeWidth={2.5} />
                        </div>

                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4
                              className={cn(
                                "text-sm transition-colors",
                                n.read
                                  ? "font-semibold text-zinc-700 dark:text-zinc-300"
                                  : "font-bold text-zinc-900 dark:text-zinc-50",
                              )}
                            >
                              {n.title}
                            </h4>
                            <span
                              className={cn(
                                "text-xs whitespace-nowrap hidden sm:flex items-center gap-1.5",
                                n.read
                                  ? "text-zinc-400"
                                  : "text-zinc-500 font-medium dark:text-zinc-400",
                              )}
                            >
                              <Clock
                                size={11}
                                className={n.read ? "opacity-50" : ""}
                              />
                              {n.time}
                            </span>
                          </div>

                          <p
                            className={cn(
                              "text-[13px] leading-relaxed",
                              n.read
                                ? "text-zinc-500 dark:text-zinc-500"
                                : "text-zinc-600 dark:text-zinc-300 font-medium",
                            )}
                          >
                            {n.description}
                          </p>

                          {/* Quick Actions (Hover revealed) */}
                          <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer">
                              View Details
                            </span>
                            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                            <span className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer">
                              Configure Alerts
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Top Right Action Button */}
                      <div className="absolute top-5 right-5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          <MoreHorizontal size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          onClick={(e) => deleteNotification(n.id, e)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
