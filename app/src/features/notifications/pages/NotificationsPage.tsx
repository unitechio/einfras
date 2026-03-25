"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  Filter,
  Inbox,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";
import { useNotification } from "@/core/NotificationContext";
import { getStoredSession } from "@/features/authentication/auth-session";
import { integrationsApi, notificationsApi, type NotificationItem } from "../api";

const typeIcon = {
  system: Shield,
  security: AlertTriangle,
  alert: AlertTriangle,
  user: Bell,
} as const;

const typeColor = {
  system: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  security: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  alert: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  user: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
} as const;

export default function NotificationsPage() {
  const { showNotification } = useNotification();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "system" | "security">("all");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isTestingIntegrations, setIsTestingIntegrations] = useState(false);
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState({
    title: "",
    description: "",
    priority: "medium",
    presentation: "modal",
  });
  const session = getStoredSession();
  const isAdmin = (session?.principal.roles || []).some((role) =>
    ["admin", "owner", "super-admin"].includes(role.toLowerCase()),
  );
  const [preferenceDraft, setPreferenceDraft] = useState({
    inApp: true,
    email: true,
    telegram: true,
    onlyHighPriority: false,
    digest: "realtime",
  });

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const items = await notificationsApi.list();
      setNotifications(items);
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load notifications",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await notificationsApi.getPreferences();
      setPreferenceDraft({
        inApp: prefs.in_app_enabled,
        email: prefs.email_enabled,
        telegram: prefs.telegram_enabled,
        onlyHighPriority: prefs.only_high_priority,
        digest: prefs.digest || "realtime",
      });
    } catch {
      // keep defaults
    }
  };

  useEffect(() => {
    void loadNotifications();
    void loadPreferences();
  }, []);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        `${item.title} ${item.description} ${JSON.stringify(item.metadata ?? {})}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesView =
        filter === "all" ? true : filter === "unread" ? !item.read : item.type === filter;
      const matchesPriority = !priorityFilter || item.priority === priorityFilter;
      const matchesChannel = !channelFilter || item.channel === channelFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      return matchesSearch && matchesView && matchesPriority && matchesChannel && matchesStatus;
    });
  }, [channelFilter, filter, notifications, priorityFilter, searchQuery, statusFilter]);

  const detailNotification = useMemo(
    () => notifications.find((item) => item.id === detailId) ?? null,
    [detailId, notifications],
  );
  const unreadCount = notifications.filter((item) => !item.read).length;

  const mutateLocal = (id: string, patch: Partial<NotificationItem>) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const markAsRead = async (id: string) => {
    await notificationsApi.markRead(id);
    mutateLocal(id, { read: true });
  };

  const markAsUnread = async (id: string) => {
    await notificationsApi.markUnread(id);
    mutateLocal(id, { read: false });
    setActiveNotificationId(null);
  };

  const updateStatus = async (id: string, status: "open" | "resolved") => {
    await notificationsApi.updateStatus(id, status);
    mutateLocal(id, { status });
    setActiveNotificationId(null);
  };

  const deleteNotification = async (id: string) => {
    await notificationsApi.remove(id);
    setNotifications((current) => current.filter((item) => item.id !== id));
    setActiveNotificationId(null);
  };

  const clearAll = async () => {
    await Promise.all(notifications.map((item) => notificationsApi.remove(item.id)));
    setNotifications([]);
    showNotification({ type: "success", message: "Inbox empty" });
  };

  const markAllAsRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    showNotification({ type: "success", message: "All notifications marked as read" });
  };

  const savePreferences = async () => {
    setIsSavingPreferences(true);
    try {
      await notificationsApi.savePreferences({
        in_app_enabled: preferenceDraft.inApp,
        email_enabled: preferenceDraft.email,
        telegram_enabled: preferenceDraft.telegram,
        whatsapp_enabled: false,
        only_high_priority: preferenceDraft.onlyHighPriority,
        digest: preferenceDraft.digest,
      });
      setPreferencesOpen(false);
      showNotification({ type: "success", message: "Notification preferences saved" });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save preferences",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const testSocialIntegrations = async () => {
    setIsTestingIntegrations(true);
    try {
      await Promise.allSettled([integrationsApi.test("telegram"), integrationsApi.test("whatsapp")]);
      showNotification({
        type: "info",
        message: "Integration test triggered",
        description: "Telegram and WhatsApp test webhooks were sent if configured.",
      });
    } finally {
      setIsTestingIntegrations(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilter("all");
    setPriorityFilter("");
    setChannelFilter("");
    setStatusFilter("");
  };

  const sendAnnouncement = async () => {
    setIsSendingAnnouncement(true);
    try {
      await notificationsApi.create({
        title: announcementDraft.title,
        description: announcementDraft.description,
        type: "system",
        channel: "in-app",
        priority: announcementDraft.priority,
        status: "open",
        metadata: {
          category: "maintenance",
          audience: "organization",
          presentation: announcementDraft.presentation,
          show_on_login: true,
          requires_ack: announcementDraft.presentation === "modal",
        },
      });
      setAnnouncementOpen(false);
      setAnnouncementDraft({
        title: "",
        description: "",
        priority: "medium",
        presentation: "modal",
      });
      await loadNotifications();
      showNotification({
        type: "success",
        message: "Maintenance notification created",
        description:
          "The announcement was saved to the notification backend for the current workspace.",
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to create maintenance notification",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20 mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Bell className="h-6 w-6 text-indigo-500" />
            Inbox & Notifications
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Live notification inbox backed by persisted API data and integration delivery settings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button variant="outline" onClick={() => setAnnouncementOpen(true)}>
              <Bell className="h-4 w-4 mr-2 text-zinc-400" />
              Maintenance Notice
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setPreferencesOpen(true)}>
            <Settings className="h-4 w-4 mr-2 text-zinc-400" />
            Preferences
          </Button>
          <Button variant="outline" onClick={() => void testSocialIntegrations()} isLoading={isTestingIntegrations}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Test Social Alerts
          </Button>
          <Button variant="primary" onClick={() => void markAllAsRead()} disabled={unreadCount === 0}>
            <Check className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>
      </div>

      {announcementOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Create maintenance / common notification
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Use this for maintenance windows, incident advisories or workspace-wide notices after users log in.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAnnouncementOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Title</label>
                <input value={announcementDraft.title} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, title: event.target.value }))} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]" placeholder="Scheduled maintenance tonight 23:00" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Message</label>
                <textarea value={announcementDraft.description} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-[140px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-[#121212]" placeholder="Tell operators what will happen, who is affected and when normal service should resume." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Priority</label>
                  <select value={announcementDraft.priority} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, priority: event.target.value }))} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Presentation</label>
                  <select value={announcementDraft.presentation} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, presentation: event.target.value }))} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <option value="modal">Modal after login</option>
                    <option value="banner">Banner / inbox only</option>
                  </select>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Current backend persists this notice in the notification system for the current workspace. Full multi-user broadcast rules can be expanded further in the backend if you want true org-wide fanout per account.
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void sendAnnouncement()} disabled={!announcementDraft.title.trim() || !announcementDraft.description.trim()} isLoading={isSendingAnnouncement}>
                Save notice
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm">
            <div className="mb-2 px-2 pt-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Views</div>
            <div className="space-y-1">
              {[
                { id: "all", label: "All Activity", icon: Inbox },
                { id: "unread", label: "Unread", icon: Bell, badge: unreadCount },
                { id: "system", label: "System Events", icon: Shield },
                { id: "security", label: "Security", icon: AlertTriangle },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id as typeof filter)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    filter === item.id
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon size={14} />
                    {item.label}
                  </span>
                  {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Maintenance</h4>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/40">
                <div className="text-zinc-500">Open</div>
                <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{notifications.filter((item) => item.status === "open").length}</div>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/40">
                <div className="text-zinc-500">Unread</div>
                <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{unreadCount}</div>
              </div>
            </div>
            <Button variant="outline" className="w-full text-red-600 border-dashed" onClick={() => void clearAll()} disabled={notifications.length === 0}>
              <Trash2 size={13} className="mr-2" />
              Clear All Logs
            </Button>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#121212] flex items-center justify-between gap-4">
              <div className="relative flex items-center w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 gap-2">
                <Search size={13} className="text-zinc-400 shrink-0" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notifications..." className="bg-transparent outline-none text-[13px] w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={resetFilters}><Filter size={14} /></Button>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                  <option value="">Priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
                <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                  <option value="">Channel</option><option value="in-app">In-app</option><option value="email">Email</option><option value="telegram">Telegram</option><option value="whatsapp">WhatsApp</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                  <option value="">Status</option><option value="open">Open</option><option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {isLoading ? (
                <div className="p-10 text-sm text-zinc-500">Loading notifications...</div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 text-center h-full">
                  <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center mb-4 text-zinc-300 dark:text-zinc-700">
                    <Inbox size={28} />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">No notifications found</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">The persisted inbox is empty for the current filters.</p>
                </div>
              ) : (
                filteredNotifications.map((item) => {
                  const Icon = typeIcon[item.type as keyof typeof typeIcon] ?? Bell;
                  const color = typeColor[item.type as keyof typeof typeColor] ?? typeColor.user;
                  return (
                    <div key={item.id} onClick={() => void (!item.read ? markAsRead(item.id) : Promise.resolve())} className={cn("p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group relative cursor-pointer", !item.read && "bg-blue-50/30 dark:bg-blue-500/[0.02]")}>
                      {!item.read ? <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" /> : null}
                      <div className="flex gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
                          <Icon size={18} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={cn("text-sm", item.read ? "font-semibold text-zinc-700 dark:text-zinc-300" : "font-bold text-zinc-900 dark:text-zinc-50")}>{item.title}</h4>
                            <span className="text-xs hidden sm:flex items-center gap-1.5 text-zinc-500"><Clock size={11} />{new Date(item.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{item.description}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                            <Badge variant="outline">{item.priority}</Badge>
                            <Badge variant="outline">{item.channel}</Badge>
                            <Badge variant={item.status === "open" ? "warning" : "success"}>{item.status}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setDetailId(item.id); }} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">View Details</button>
                            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            <button type="button" onClick={(e) => { e.stopPropagation(); setPreferencesOpen(true); }} className="text-xs font-semibold text-zinc-500">Configure Alerts</button>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        <div className="relative">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={(e) => { e.stopPropagation(); setActiveNotificationId(activeNotificationId === item.id ? null : item.id); }}>
                            <MoreHorizontal size={14} />
                          </Button>
                          {activeNotificationId === item.id ? (
                            <div className="absolute right-0 top-9 z-20 min-w-[190px] rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-[#121212]" onClick={(e) => e.stopPropagation()}>
                              <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60" onClick={() => setDetailId(item.id)}>Open details</button>
                              <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60" onClick={() => void (item.read ? markAsUnread(item.id) : markAsRead(item.id))}>{item.read ? "Mark as unread" : "Mark as read"}</button>
                              <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60" onClick={() => void updateStatus(item.id, item.status === "open" ? "resolved" : "open")}>{item.status === "open" ? "Resolve notification" : "Re-open notification"}</button>
                            </div>
                          ) : null}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-red-100 hover:text-red-600" onClick={(e) => { e.stopPropagation(); void deleteNotification(item.id); }}>
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

      {preferencesOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Notification Preferences</h3>
                <p className="text-sm text-zinc-500">Persisted preferences used by notifications and integrations delivery.</p>
              </div>
              <Button variant="outline" onClick={() => setPreferencesOpen(false)}><X className="mr-2 h-4 w-4" />Close</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"><span className="flex items-center gap-2 text-sm font-medium"><Bell size={14} />In-app notifications</span><input type="checkbox" checked={preferenceDraft.inApp} onChange={(e) => setPreferenceDraft((current) => ({ ...current, inApp: e.target.checked }))} /></label>
              <label className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"><span className="flex items-center gap-2 text-sm font-medium"><Mail size={14} />Email notifications</span><input type="checkbox" checked={preferenceDraft.email} onChange={(e) => setPreferenceDraft((current) => ({ ...current, email: e.target.checked }))} /></label>
              <label className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"><span className="flex items-center gap-2 text-sm font-medium"><MessageCircle size={14} />Telegram alerts</span><input type="checkbox" checked={preferenceDraft.telegram} onChange={(e) => setPreferenceDraft((current) => ({ ...current, telegram: e.target.checked }))} /></label>
              <label className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"><span className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal size={14} />High priority only</span><input type="checkbox" checked={preferenceDraft.onlyHighPriority} onChange={(e) => setPreferenceDraft((current) => ({ ...current, onlyHighPriority: e.target.checked }))} /></label>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">Delivery mode</label>
              <select value={preferenceDraft.digest} onChange={(e) => setPreferenceDraft((current) => ({ ...current, digest: e.target.value }))} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                <option value="realtime">Realtime</option>
                <option value="hourly">Hourly digest</option>
                <option value="daily">Daily digest</option>
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreferencesOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void savePreferences()} isLoading={isSavingPreferences}>Save Preferences</Button>
            </div>
          </div>
        </div>
      ) : null}

      {detailNotification ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{detailNotification.title}</h3>
                <p className="text-sm text-zinc-500">{new Date(detailNotification.created_at).toLocaleString()}</p>
              </div>
              <Button variant="outline" onClick={() => setDetailId(null)}><X className="mr-2 h-4 w-4" />Close</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-sm font-semibold">Summary</div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{detailNotification.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{detailNotification.type}</Badge>
                  <Badge variant="outline">{detailNotification.priority}</Badge>
                  <Badge variant="outline">{detailNotification.channel}</Badge>
                  <Badge variant={detailNotification.status === "open" ? "warning" : "success"}>{detailNotification.status}</Badge>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-sm font-semibold">Actions</div>
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="outline" onClick={() => void (detailNotification.read ? markAsUnread(detailNotification.id) : markAsRead(detailNotification.id))}>{detailNotification.read ? "Mark as unread" : "Mark as read"}</Button>
                  <Button variant="outline" onClick={() => void updateStatus(detailNotification.id, detailNotification.status === "open" ? "resolved" : "open")}>{detailNotification.status === "open" ? "Resolve notification" : "Re-open notification"}</Button>
                  <Button variant="outline" onClick={() => setPreferencesOpen(true)}>Configure alerts</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
